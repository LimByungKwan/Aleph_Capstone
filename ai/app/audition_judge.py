"""썬그레이 오디션 심사 (LangGraph 3노드). 담당: 성근(SG)

analyze(분석, 코드) → judge(심사, LLM) → verify(검증, 코드) ─┬→ 끝
                          ↑                                  │
                          └──── 검증 실패 & 1번만 다시 ───────┘
- 점수와 음표별 판정은 분석 노드(librosa·규칙)가 정함. LLM은 점수를 바꿀 수 없고, 결과표를 해석해 말로 풀어 줌
- LLM이 꺼져 있거나(기본, 요금 0원) 두 번 다 검증에 실패하면 규칙 문장으로 대신함 (source="rule")
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import TypedDict

import openai
from langgraph.graph import END, START, StateGraph

from .audition_pitch import analyze as analyze_pitch
from .limits import take_llm_call
from .llm_pick import DEFAULT_MODEL, _get_client, llm_enabled
from .promo import check_rules

log = logging.getLogger("scenewalk.audition")

MAX_ATTEMPTS = 2
NOTE_NAMES = ["도", "도#", "레", "레#", "미", "파", "파#", "솔", "솔#", "라", "라#", "시"]


class JudgeState(TypedDict, total=False):
    wav: bytes
    melody: list[dict]
    result: dict  # {score, offset, notes:[{index, target, sung, deviation, status}]}
    feedback: dict | None  # {comment, tips}
    attempts: int
    problems: list[str]
    source: str


# ── 1. 분석 ─────────────────────────────────────
def analyze(state: JudgeState) -> JudgeState:
    return {"result": analyze_pitch(state["wav"], state["melody"]), "attempts": 0}


# ── 2. 심사 (LLM) ───────────────────────────────
SYSTEM = """너는 가상 아이돌 그룹 '썬그레이'의 보컬 오디션 심사위원이야.
지원자가 짧은 멜로디를 불렀고, 프로그램이 음표마다 음정을 이미 판정했어. 그 결과표만 보고 피드백을 써.

규칙
- 점수와 판정은 바꾸지 않는다. 결과표에 없는 내용(박자·음색·감정 등)은 지어내지 않는다.
- 음표는 결과표의 번호로만 말한다 (예: 4번 음).
- 여러 음표에 걸친 패턴(예: 높은 음에서 계속 낮음, 끝부분에서 흔들림)을 먼저 찾고, 가장 중요한 것부터 말한다.
- comment: 심사위원 총평 한국어 2문장 이내 (120자 안팎), 따뜻하지만 솔직하게.
- tips: 바로 연습할 수 있는 조언 1~3개, 각각 한국어 한 문장 (60자 안팎).
- 실존 가수·아이돌·노래 이름은 쓰지 않는다. 영어를 섞지 않는다."""

SCHEMA = {
    "type": "object",
    "properties": {"comment": {"type": "string"}, "tips": {"type": "array", "items": {"type": "string"}}},
    "required": ["comment", "tips"],
    "additionalProperties": False,
}

STATUS_TEXT = {"ok": "정확", "flat": "낮음", "sharp": "높음", "crack": "삑사리", "missed": "안 들림"}


def _table(result: dict) -> str:
    lines = [f"점수 {result['score']}점 (정확한 음 비율)"]
    for r in result["notes"]:
        name = NOTE_NAMES[r["target"] % 12] + str(r["target"] // 12 - 1)
        dev = "" if r["deviation"] is None else f", 차이 {r['deviation']:+.2f}반음"
        lines.append(f"{r['index']}번 음 {name}: {STATUS_TEXT[r['status']]}{dev}")
    return "\n".join(lines)


def ask_llm(table: str, problems: list[str]) -> dict | None:
    """{comment, tips} 또는 실패 시 None. 다시 쓰는 경우 지난 문제점을 같이 알려 줌"""
    if not llm_enabled() or not take_llm_call():
        return None
    retry = f"\n\n지난 답의 문제: {'; '.join(problems)}. 고쳐서 다시 써." if problems else ""
    try:
        response = _get_client().chat.completions.create(
            model=os.environ.get("LLM_MODEL", DEFAULT_MODEL),
            messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": table + retry}],
            response_format={"type": "json_schema", "json_schema": {"name": "audition_feedback", "strict": True, "schema": SCHEMA}},
            max_completion_tokens=400,
        )
        choice = response.choices[0]
        if choice.finish_reason != "stop" or getattr(choice.message, "refusal", None):
            return None
        return json.loads(choice.message.content or "")
    except (openai.OpenAIError, json.JSONDecodeError) as e:
        log.warning("오디션 LLM 실패 (%s) → 규칙 문장으로 대신함", type(e).__name__)
        return None


def judge(state: JudgeState) -> JudgeState:
    feedback = ask_llm(_table(state["result"]), state.get("problems", []))
    return {"feedback": feedback, "attempts": state["attempts"] + 1}


# ── 3. 검증 ─────────────────────────────────────
def find_problems(feedback: dict, result: dict) -> list[str]:
    """LLM 답을 그대로 믿지 않고 형식·내용 규칙을 코드로 검사"""
    comment, tips = feedback.get("comment", ""), feedback.get("tips", [])
    problems = []
    if not isinstance(comment, str) or not comment.strip() or len(comment) > 200:
        problems.append("총평은 비어 있지 않은 200자 이내")
    if not isinstance(tips, list) or not 1 <= len(tips) <= 3 or not all(isinstance(t, str) and 0 < len(t) <= 100 for t in tips):
        problems.append("조언은 1~3개, 각각 100자 이내")
        tips = []
    text = " ".join([str(comment), *tips])
    count = len(result["notes"])
    if any(not 1 <= int(n) <= count for n in re.findall(r"(\d+)\s*번", text)):
        problems.append(f"음표 번호는 1~{count}번만")
    if any(int(n) != result["score"] for n in re.findall(r"(\d+)\s*점", text)):
        problems.append(f"점수는 {result['score']}점 그대로")
    problems += check_rules(text)  # 실명·로고 등 (promo.py 규칙 재사용)
    return problems


def rule_feedback(result: dict) -> dict:
    notes = result["notes"]
    by = lambda s: [r["index"] for r in notes if r["status"] == s]  # noqa: E731
    if len(by("missed")) == len(notes):
        return {"comment": "노래가 잘 들리지 않았어요.", "tips": ["마이크에 조금 더 가까이 대고, 카운트다운이 끝나면 바로 불러 보세요."]}
    tips = []
    if by("crack"):
        tips.append(f"{', '.join(map(str, by('crack')))}번 음에서 소리가 튀었어요. 그 음 앞에서 숨을 충분히 채워 보세요.")
    if len(by("flat")) >= len(by("sharp")) and by("flat"):
        tips.append(f"{', '.join(map(str, by('flat')))}번 음이 낮았어요. 그 음을 조금 더 높게 생각하고 불러 보세요.")
    elif by("sharp"):
        tips.append(f"{', '.join(map(str, by('sharp')))}번 음이 높았어요. 힘을 조금 빼고 불러 보세요.")
    if by("missed"):
        tips.append(f"{', '.join(map(str, by('missed')))}번 음이 잘 들리지 않았어요. 끝까지 소리를 이어 보세요.")
    score = result["score"]
    comment = "음정이 아주 안정적이에요!" if score >= 90 else "좋은 출발이에요. 몇 음만 다듬으면 돼요." if score >= 60 else "음을 하나씩 천천히 맞춰 보며 연습해 봐요."
    return {"comment": comment, "tips": tips[:3] or ["지금처럼 편하게 한 번 더 불러 보세요."]}


def verify(state: JudgeState) -> JudgeState:
    feedback = state.get("feedback")
    if feedback is None:  # LLM 꺼짐·실패 → 다시 불러도 같으므로 바로 규칙 문장
        return {"feedback": rule_feedback(state["result"]), "problems": [], "source": "rule"}
    problems = find_problems(feedback, state["result"])
    if not problems:
        return {"problems": [], "source": "llm"}
    log.info("오디션 LLM 답 검증 실패 %s (시도 %d)", problems, state["attempts"])
    if state["attempts"] >= MAX_ATTEMPTS:
        return {"feedback": rule_feedback(state["result"]), "problems": problems, "source": "rule"}
    return {"problems": problems}


def after_verify(state: JudgeState) -> str:
    return "judge" if state.get("problems") and "source" not in state else END


def build_graph():
    graph = StateGraph(JudgeState)
    graph.add_node("analyze", analyze)
    graph.add_node("judge", judge)
    graph.add_node("verify", verify)
    graph.add_edge(START, "analyze")
    graph.add_edge("analyze", "judge")
    graph.add_edge("judge", "verify")
    graph.add_conditional_edges("verify", after_verify, ["judge", END])
    return graph.compile()


_graph = build_graph()


def judge_take(wav: bytes, melody: list[dict]) -> dict:
    state = _graph.invoke({"wav": wav, "melody": melody})
    return {**state["result"], "feedback": state["feedback"], "source": state["source"]}
