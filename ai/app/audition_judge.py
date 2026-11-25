"""노래·키보드 분석 → 공통 심사 → 검증, 실패 시 한 번 재심사."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from typing import TypedDict

import openai
from langgraph.graph import END, START, StateGraph

from .audition_keys import analyze as analyze_keyboard
from .audition_pitch import analyze as analyze_pitch
from .limits import take_llm_call
from .llm_pick import DEFAULT_MODEL, _get_client, llm_enabled
from .promo import check_rules

log = logging.getLogger("scenewalk.audition")
MAX_ATTEMPTS = 2
ROLES = ["프로듀서", "보컬 트레이너", "안무가"]


class JudgeState(TypedDict, total=False):
    mode: str
    wav: bytes
    presses: list[dict]
    melody: list[dict]
    result: dict
    feedback: dict | None
    attempts: int
    problems: list[str]
    source: str


def analyze_sing(state: JudgeState) -> JudgeState:
    return {"result": {"mode": "sing", **analyze_pitch(state["wav"], state["melody"])}, "attempts": 0}


def analyze_keys(state: JudgeState) -> JudgeState:
    return {"result": analyze_keyboard(state["presses"], state["melody"]), "attempts": 0}


SYSTEM = """가상 오디션의 세 심사위원으로서 코드가 채점한 결과표만 해석한다.
프로듀서: 제작자 시선으로 스타성·무대와 데뷔 가능성을 기대하되 냉정하게 합격 또는 보류 의견을 낸다.
보컬 트레이너: 다정하고 구체적으로 코칭한다. 노래는 음표 번호와 낮음·높음·삑사리,
키보드는 멜로디의 오르내림을 따라가는 방향 정확도를 근거로 삼는다.
안무가: 에너지 있게 박자와 리듬을 코칭한다. 노래는 시작 차이와 소리가 유지된 비율,
키보드는 빠름·늦음과 최대 콤보를 근거로 삼는다.
judges에 프로듀서, 보컬 트레이너, 안무가가 정확히 한 번씩 등장한다.
각 line은 한국어 1~2문장, 90자 이내. tips는 한국어 연습 조언 1~3개, 각각 100자 이내.
점수·판정을 바꾸거나 결과표에 없는 사실(음색·외모·표정·감정·호흡 상태)을 지어내지 않는다.
기술 조언은 제안으로 쓰고 관찰하지 않은 사실을 단정하지 않는다. 음표는 존재하는 번호만 말한다.
실존 가수·아이돌·노래 이름을 절대 쓰지 않는다. 영어는 Perfect, Good, Miss 판정어만 허용한다.
키보드 오차의 양수는 늦음, 음수는 빠름이다. 방향 정확도는 해당 방향 음표 중 성공 비율이며
평균 오차는 방향 오답을 포함한 판정 창 안 입력만 집계한다. 자료가 없으면 추측하지 않는다."""

SCHEMA = {
    "type": "object",
    "properties": {
        "judges": {"type": "array", "minItems": 3, "maxItems": 3, "items": {
            "type": "object",
            "properties": {"role": {"type": "string", "enum": ROLES}, "line": {"type": "string", "minLength": 1, "maxLength": 90}},
            "required": ["role", "line"], "additionalProperties": False,
        }},
        "tips": {"type": "array", "minItems": 1, "maxItems": 3, "items": {"type": "string", "minLength": 1, "maxLength": 100}},
    },
    "required": ["judges", "tips"],
    "additionalProperties": False,
}


def _table(result: dict) -> str:
    # 원본 입력이나 자유 텍스트 대신 서버가 만든 수치와 판정만 보낸다.
    return "결과표 (dt·offset은 초, 통계의 ms는 밀리초)\n" + json.dumps(result, ensure_ascii=False, allow_nan=False)


def ask_llm(table: str, problems: list[str]) -> dict | None:
    if not llm_enabled() or not take_llm_call():
        return None
    retry = f"\n\n지난 답의 문제: {'; '.join(problems)}. 고쳐서 다시 써." if problems else ""
    try:
        response = _get_client().chat.completions.create(
            model=os.environ.get("LLM_MODEL", DEFAULT_MODEL),
            messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": table + retry}],
            response_format={"type": "json_schema", "json_schema": {"name": "audition_feedback", "strict": True, "schema": SCHEMA}},
            max_completion_tokens=800,
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


def find_problems(feedback: dict, result: dict) -> list[str]:
    if not isinstance(feedback, dict):
        return ["심사평은 객체여야 함"]
    judges, tips = feedback.get("judges"), feedback.get("tips")
    problems, lines = [], []
    if set(feedback) != {"judges", "tips"}:
        problems.append("심사평은 judges와 tips만 포함")
    if not isinstance(judges, list) or len(judges) != 3 or not all(isinstance(j, dict) for j in judges):
        problems.append("심사위원은 세 명")
    else:
        if sorted(str(j.get("role")) for j in judges) != sorted(ROLES):
            problems.append("프로듀서, 보컬 트레이너, 안무가는 정확히 한 번씩")
        for j in judges:
            line = j.get("line")
            if set(j) != {"role", "line"} or not isinstance(line, str) or not line.strip() or len(line) > 90:
                problems.append("대사는 비어 있지 않은 90자 이내")
            if isinstance(line, str):
                lines.append(line)
                sentences = re.split(r"(?<!\d)\.|\.(?!\d)|[!?。！？]+", line.strip())
                if len([s for s in sentences if s.strip()]) > 2:
                    problems.append("대사는 한두 문장")
    if not isinstance(tips, list) or not 1 <= len(tips) <= 3 or not all(isinstance(t, str) and t.strip() and len(t) <= 100 for t in tips):
        problems.append("조언은 1~3개, 각각 비어 있지 않은 100자 이내")
    else:
        lines.extend(tips)
    text = " ".join(lines)
    if any(not re.search(r"[가-힣]", line) for line in lines):
        problems.append("대사와 조언은 한국어 문장")
    indices = {r["index"] for r in result["notes"]}
    for group in re.findall(r"(\d+(?:\s*[,~·및과와-]\s*\d+)*)\s*(?:번|번째|번?\s*음표)", text):
        if any(int(n) not in indices for n in re.findall(r"\d+", group)):
            problems.append("음표 번호는 결과표에 있는 번호만")
    if any(float(n) != result["score"] for n in re.findall(r"(-?\d+(?:\.\d+)?)\s*점", text)):
        problems.append(f"점수는 {result['score']}점 그대로")
    if any(word not in {"Perfect", "Good", "Miss"} for word in re.findall(r"[A-Za-z]+", text)):
        problems.append("영어는 Perfect, Good, Miss 판정어만 허용")
    problems += check_rules(text)
    return problems


def rule_feedback(result: dict) -> dict:
    score, notes = result["score"], result["notes"]
    band = 0 if score >= 90 else 1 if score >= 70 else 2 if score >= 50 else 3
    # 같은 결과표는 재시작 후에도 같은 대사를 고른다.
    seed = int(hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()[:8], 16)
    producer = [
        ["가능성은 봤어요. 이 점수라면 데뷔 무대를 위한 다음 심사에 올리고 싶네요.", "합격 쪽으로 마음이 기울어요. 이 정확도를 무대에서도 이어 가길 기대해요."],
        ["가능성은 봤어요. 다음 심사에 앞서 정확도를 조금 더 다져 주세요.", "무대에 설 가능성은 보여요. 합격 결정은 한 번 더 도전한 뒤 내릴게요."],
        ["아직은 연습생 느낌이에요. 이 점수에서 한 단계 올라오면 다시 보고 싶어요.", "오늘은 보류예요. 정확도를 다듬으면 무대의 가능성도 다시 볼 수 있겠어요."],
        ["지금 점수로는 데뷔 판단을 보류할게요. 기본기를 채운 다음 도전을 기다릴게요.", "아직은 연습이 더 필요해요. 오늘은 보류지만 다음 심사에서 가능성을 보여 주세요."],
    ][band][seed % 2]
    tips = []
    if result.get("mode") == "keyboard":
        stats = result["stats"]
        wrong = stats["wrong_direction"]
        if wrong:
            vocal = f"방향을 {wrong}회 다르게 눌렀어요. 멜로디가 오르고 내리는 곳을 천천히 따라가 봐요."
            tips.append("틀린 방향의 음표 앞뒤를 이어 들으며 화살표를 천천히 눌러 보세요.")
        else:
            hits = sum(r["result"] != "miss" for r in notes)
            vocal = f"{hits}개 음표의 방향과 타이밍을 맞췄어요. 멜로디의 오르내림을 들으며 이어 가 봐요."
        mean = stats["mean_error_ms"]
        timing = "판정 창 안 입력이 없어요" if mean is None else "평균 시간 차이는 0밀리초예요" if mean == 0 else f"평균 {abs(mean):g}밀리초 {'늦어요' if mean > 0 else '빨라요'}"
        dance = f"{timing}, 최대 콤보는 {stats['max_combo']}예요! " + ("그 리듬을 끝까지 이어 가요!" if band < 2 else "한 음씩 박자부터 잡아 봐요!")
        if stats["after_rest_accuracy"] is not None and stats["after_rest_accuracy"] < 100:
            tips.append("쉬는 구간에도 박자를 세며 다음 화살표를 기다려 보세요.")
        tips.append("화살표가 고리에 닿는 순간에 맞춰 눌러 보세요." if mean is None or mean != 0 else "지금의 타이밍을 유지하며 멜로디를 한 번 더 따라가 보세요.")
    else:
        by = lambda status: [r["index"] for r in notes if r["status"] == status]
        if by("crack"):
            vocal = f"{by('crack')[0]}번 음에서 삑사리가 났어요. 숨을 편하게 채우고 힘을 덜어 다시 불러 봐요."
        elif by("flat"):
            vocal = f"{by('flat')[0]}번 음이 낮았어요. 그 음을 조금 높게 생각하며 편하게 불러 봐요."
        elif by("sharp"):
            vocal = f"{by('sharp')[0]}번 음이 높았어요. 힘을 조금 빼고 기준음을 따라 불러 봐요."
        elif by("missed"):
            vocal = f"{by('missed')[0]}번 음이 잘 들리지 않았어요. 마이크 가까이에서 편하게 소리를 이어 봐요."
        else:
            vocal = ["모든 음정이 정확했어요. 편안한 발성으로 이 감각을 이어 가 봐요.", "낮거나 높은 음 없이 잘 맞췄어요. 숨을 편하게 채우며 다시 불러 봐요."][seed % 2]
        tips.append(vocal)
        offset = result.get("offset")
        if offset is None:
            dance = "시작 소리를 찾지 못했어요! 카운트다운 뒤 첫 박자부터 함께 잡아 봐요."
        else:
            timing = "시작이 기준과 맞았어요" if offset == 0 else f"시작이 {abs(offset):g}초 {'늦었어요' if offset > 0 else '빨랐어요'}"
            sustain = result.get("stats", {}).get("voiced_ratio")
            ending = f"음 길이 중 소리가 잡힌 비율은 {sustain:g}퍼센트, 끝까지 이어 가요!" if sustain is not None else "음 길이를 끝까지 유지해 봐요!"
            dance = f"{timing}! {ending}"
        tips.append("시작 박자를 세고, 음표 막대가 끝날 때까지 편하게 소리를 이어 보세요.")
    return {"judges": [{"role": role, "line": line} for role, line in zip(ROLES, [producer, vocal, dance])], "tips": tips[:3]}


def verify(state: JudgeState) -> JudgeState:
    feedback = state.get("feedback")
    if feedback is None:
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
    graph.add_node("analyze_sing", analyze_sing)
    graph.add_node("analyze_keys", analyze_keys)
    graph.add_node("judge", judge)
    graph.add_node("verify", verify)
    graph.add_conditional_edges(START, lambda state: state["mode"], {"sing": "analyze_sing", "keyboard": "analyze_keys"})
    graph.add_edge("analyze_sing", "judge")
    graph.add_edge("analyze_keys", "judge")
    graph.add_edge("judge", "verify")
    graph.add_conditional_edges("verify", after_verify, ["judge", END])
    return graph.compile()


_graph = build_graph()


def judge_take(wav: bytes, melody: list[dict]) -> dict:
    state = _graph.invoke({"mode": "sing", "wav": wav, "melody": melody})
    return {**state["result"], "feedback": state["feedback"], "source": state["source"]}


def judge_keyboard(presses: list[dict], melody: list[dict]) -> dict:
    state = _graph.invoke({"mode": "keyboard", "presses": presses, "melody": melody})
    return {**state["result"], "feedback": state["feedback"], "source": state["source"]}
