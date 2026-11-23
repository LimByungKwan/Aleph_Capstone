"""커플 타로 LangGraph (담당: 병관) — docs/bk-couple-tarot-plan.md 2장

두 사람이 한 기기에서 번갈아 고른 질문 카드 답(보기 번호)을 받아
서로 얼마나 잘 아는지 비교한다. 요금 0원 규칙 방식 (LLM 안 부름).

    START ─┬─ analyze_a ─┐
           └─ analyze_b ─┴─ compare ─ draw ─ retrieve ─ interpret ─ guard ─┬─ 통과 ─────────────── mission ─ END
                                                             ▲             ├─ 걸림 (2번까지) ─┐
                                                             └─────────────┼──────────────────┘
                                                                           └─ 3번째도 걸림 ─ fallback ─ mission

- analyze_a / analyze_b: 병렬. 각자 이름 정리(부적절한 말이면 A·B로) + 답 번호 검사 + 보기 글로 바꾸기
- compare: 두 결과를 합쳐 일치도(%) · 서로 몰랐던 점 · 취향이 같은 질문 · 다음 단계(RAG)에 쓸 카테고리
- draw: 메이저 아르카나 22장 중 3장 (지나온 우리 · 지금의 우리 · 다음 데이트), 정/역방향. seed가 같으면 같은 카드
- retrieve: RAG — 카드 의미 + 서로 몰랐던 카테고리로 근거 문단 찾기 (tarot_rag.py, 태그·키워드 점수)
- interpret: 카드 의미 + 근거 문단으로 해석 문장 (템플릿) + 요약 + 커플문답 대화 질문
- guard: 관계를 단정·겁주는 말 검사 (safety.check_reading). 걸리면 걸린 조각을 빼고 interpret가 다음 후보로 다시 조합
- fallback: 2번 다시 해도 걸리면 카드 키워드로 만든 안전한 기본 문장
- mission: '다음 데이트' 카드 → 데이트 코스(BK) 장소 + 해 볼 행동 (화면 미니맵 안내에 그대로 씀)

답 원문은 어디에도 저장하지 않는다 (요청 안에서만 씀). 질문 데이터는 화면과 같이 쓰는 shared/bk_tarot/questions.json
"""

from __future__ import annotations

import random
import secrets
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from .places import ZONE_NAMES, place_by_id
from .safety import check_message, check_reading
from .tarot_rag import category_names, load_cards, load_data, positions, retrieve as rag_retrieve, talk_cards

NAME_MAX = 8
FALLBACK_NAMES = {"a": "A", "b": "B"}


class TarotInputError(ValueError):
    """두 사람 답이 질문 수·보기 범위와 맞지 않을 때 (API에서는 400으로 돌려줌)"""


MAX_RETRIES = 2  # guard에 걸렸을 때 interpret를 다시 하는 최대 횟수
FALLBACK_PLACE = "spot_bk_fountain"  # 미션 장소를 못 찾을 때 (소원 분수)
REVERSED_RATE = 0.3  # 역방향이 나올 확률 (역방향은 '조언'으로만 읽음)
SPREAD = ["past", "present", "next"]


def load_questions() -> list[dict]:
    return load_data("questions.json")["questions"]


class TarotState(TypedDict, total=False):
    # 입력
    seed: str  # 같은 seed면 같은 카드·대화 질문 (다시 보기용)
    a: dict  # { name, self: [보기 번호 x 질문 수], guess: [...] }
    b: dict
    # analyze_a / analyze_b (병렬 노드가 서로 다른 키에 씀 → 합칠 때 충돌 없음)
    person_a: dict  # { name, answers: [{ questionId, category, self, guess }] } — self·guess는 보기 번호
    person_b: dict
    # compare
    match: int  # 서로 맞힌 비율 0~100
    hits: dict  # { a: A가 B를 맞힌 수, b: B가 A를 맞힌 수, total: 질문 수 }
    mismatches: list[dict]
    same_taste: list[str]  # 두 사람 "나는?" 답이 같은 질문 id
    focus: list[str]  # 서로 몰랐던 점이 많은 카테고리 순 → 다음 단계 RAG 검색에 씀
    # draw / retrieve / interpret
    drawn: list[dict]  # [{ id, position, reversed }]
    evidence: list[dict]  # RAG 근거 [{ cardId, position, tip, score, why }]
    cards: list[dict]  # 화면에 보일 카드 3장 + 해석
    summary: str  # 한 단락 요약 (saveTarotReading의 summary, 1000자 이하)
    talk: list[dict]  # 커플문답 대화 질문 [{ category, text }]
    # guard 반복 (노드가 돌려준 목록이 통째로 바뀌므로 매번 누적해서 돌려줌)
    retries: int  # interpret를 다시 한 횟수
    passed: bool
    blocked_tips: list[str]  # 걸린 조언 id → 다음엔 다음 후보
    blocked_cards: list[str]  # 카드 의미 글이 걸린 카드 id → 키워드 기본 문장
    blocked_talk: list[str]  # 걸린 대화 질문 글
    guard_log: list[dict]  # [{ try, problems: [{ part, words }] }] — 면접·디버그용
    fallback: bool
    mission: dict


def _clean_name(raw, key: str) -> str:
    name = " ".join(str(raw or "").split())[:NAME_MAX]
    if not name or check_message(name):  # 비었거나 부적절한 말 → A·B
        return FALLBACK_NAMES[key]
    return name


def _check_picks(picks, questions: list[dict], who: str, part: str) -> list[int]:
    if not isinstance(picks, list) or len(picks) != len(questions):
        raise TarotInputError(f"{who}.{part}: 답이 {len(questions)}개여야 해요")
    out = []
    for q, pick in zip(questions, picks):
        # bool은 int의 한 종류라 따로 막음 (True가 1번 보기로 들어가지 않게)
        if isinstance(pick, bool) or not isinstance(pick, int) or not 0 <= pick < len(q["options"]):
            raise TarotInputError(f"{who}.{part}: {q['id']}의 보기 번호가 맞지 않아요")
        out.append(pick)
    return out


def _analyze(state: TarotState, key: str) -> dict:
    questions = load_questions()
    raw = state.get(key) or {}
    if not isinstance(raw, dict):
        raise TarotInputError(f"{key}: 답 형식이 맞지 않아요")
    selfs = _check_picks(raw.get("self"), questions, key, "self")
    guesses = _check_picks(raw.get("guess"), questions, key, "guess")
    answers = [
        {"questionId": q["id"], "category": q["category"], "self": s, "guess": g}
        for q, s, g in zip(questions, selfs, guesses)
    ]
    return {"name": _clean_name(raw.get("name"), key), "answers": answers}


def analyze_a(state: TarotState) -> TarotState:
    return {"person_a": _analyze(state, "a")}


def analyze_b(state: TarotState) -> TarotState:
    return {"person_b": _analyze(state, "b")}


def compare(state: TarotState) -> TarotState:
    """A의 "상대는?" ↔ B의 "나는?", B의 "상대는?" ↔ A의 "나는?" 을 맞춰 봄"""
    questions = load_questions()
    a, b = state["person_a"], state["person_b"]
    hits = {"a": 0, "b": 0, "total": len(questions)}
    mismatches: list[dict] = []
    same_taste: list[str] = []
    missed_by_category: dict[str, int] = {}

    for q, ans_a, ans_b in zip(questions, a["answers"], b["answers"]):
        if ans_a["self"] == ans_b["self"]:
            same_taste.append(q["id"])
        # (맞히는 사람, 답한 사람, hits 키)
        for guesser, owner, own_ans, guess_ans, hit_key in (
            (a, b, ans_b, ans_a, "a"),
            (b, a, ans_a, ans_b, "b"),
        ):
            if guess_ans["guess"] == own_ans["self"]:
                hits[hit_key] += 1
                continue
            missed_by_category[q["category"]] = missed_by_category.get(q["category"], 0) + 1
            mismatches.append({
                "questionId": q["id"],
                "category": q["category"],
                "question": q["self"],
                "about": owner["name"],  # 이 사람의 실제 답을
                "guesser": guesser["name"],  # 이 사람이 다르게 짐작함
                "answer": q["options"][own_ans["self"]],
                "guessed": q["options"][guess_ans["guess"]],
            })

    match = round(100 * (hits["a"] + hits["b"]) / (2 * hits["total"])) if hits["total"] else 0
    # 몰랐던 점이 많은 카테고리 먼저, 같으면 질문 순서대로
    order = {q["category"]: i for i, q in enumerate(questions)}
    focus = sorted(missed_by_category, key=lambda c: (-missed_by_category[c], order[c]))
    return {"match": match, "hits": hits, "mismatches": mismatches, "same_taste": same_taste, "focus": focus}


def _rng(state: TarotState, step: str) -> random.Random:
    # 노드마다 따로 섞어서, 한 노드를 고쳐도 다른 노드 결과가 바뀌지 않게
    return random.Random(f"{state['seed']}:{step}")


def draw(state: TarotState) -> TarotState:
    rng = _rng(state, "draw")
    ids = rng.sample([c["id"] for c in load_cards()], len(SPREAD))
    return {"drawn": [{"id": i, "position": p, "reversed": rng.random() < REVERSED_RATE} for i, p in zip(ids, SPREAD)]}


def retrieve(state: TarotState) -> TarotState:
    return {"evidence": rag_retrieve(state["drawn"], state.get("focus", []))}


def _match_line(match: int) -> str:
    if match >= 80:
        return "서로를 정말 잘 알고 있는 두 사람이에요."
    if match >= 50:
        return "많이 알고 있지만, 아직 알아 가는 재미가 남아 있어요."
    return "서로 새로 알게 될 이야기가 많은 두 사람이에요. 오늘 답이 좋은 대화 거리가 될 거예요."


def _safe_meaning(card: dict) -> str:
    words = "', '".join(card["keywords"][:2])
    return f"{card['name']} 카드는 '{words}'의 기운을 담고 있어요. 두 사람의 속도로 천천히 읽어 보세요."


SAFE_ADVICE = "오늘은 서로에게 고마웠던 점을 하나씩 말해 보세요."


def interpret(state: TarotState) -> TarotState:
    """카드 의미 + 근거 조언 → 해석. guard에 걸렸던 조각은 다음 후보로 바꿔서 다시 조합"""
    cards = {c["id"]: c for c in load_cards()}
    names = category_names()
    labels = positions()
    blocked_tips = set(state.get("blocked_tips", []))
    blocked_cards = set(state.get("blocked_cards", []))
    used: set[str] = set()
    out = []
    for pick, ev in zip(state["drawn"], state["evidence"]):
        card = cards[pick["id"]]
        meaning = card["reversed"] if pick["reversed"] else card["upright"]
        if card["id"] in blocked_cards:
            meaning = _safe_meaning(card)
        tip = next((t for t in ev["candidates"] if t["id"] not in blocked_tips and t["id"] not in used), None)
        advice = tip["text"] if tip else SAFE_ADVICE
        if tip:
            used.add(tip["id"])
        out.append({
            "id": card["id"],
            "no": card["no"],
            "name": card["name"],
            "emoji": card["emoji"],
            "position": pick["position"],
            "positionName": labels[pick["position"]],
            "reversed": pick["reversed"],
            "keywords": card["keywords"],
            "meaning": meaning,
            "advice": advice,
            "reading": f"{meaning} {advice}",
            "evidence": tip["id"] if tip else None,
        })

    a, b = state["person_a"]["name"], state["person_b"]["name"]
    focus = state.get("focus", [])
    nxt = out[-1]
    parts = [f"{a}님과 {b}님은 서로의 답을 {state['match']}% 맞혔어요.", _match_line(state["match"])]
    if focus:
        parts.append(f"'{names.get(focus[0], focus[0])}' 이야기는 오늘 새로 알게 된 부분이에요.")
    parts.append(f"다음 데이트 카드는 {nxt['emoji']} {nxt['name']}{' (역방향)' if nxt['reversed'] else ''} — {nxt['advice']}")
    summary = " ".join(parts)[:1000]

    # 대화 질문: 서로 몰랐던 카테고리 먼저, 모자라면 지금·다음 카드의 카테고리
    topics = list(focus) + [t for c in reversed(state["drawn"]) for t in cards[c["id"]]["tags"]]
    talk = talk_cards(topics, _rng(state, "talk"), exclude=set(state.get("blocked_talk", [])))
    return {"cards": out, "summary": summary, "talk": talk}


def guard(state: TarotState) -> TarotState:
    """해석 검사. 걸린 조각(조언·카드 의미·대화 질문)을 기록해서 interpret가 다음엔 피하게 함"""
    blocked_tips = list(state.get("blocked_tips", []))
    blocked_cards = list(state.get("blocked_cards", []))
    blocked_talk = list(state.get("blocked_talk", []))
    problems = []
    for c in state["cards"]:
        words = check_reading(c["meaning"])
        if words:
            problems.append({"part": f"meaning:{c['id']}", "words": words})
            blocked_cards.append(c["id"])
        words = check_reading(c["advice"]) if c["evidence"] else []
        if words:
            problems.append({"part": f"advice:{c['evidence']}", "words": words})
            blocked_tips.append(c["evidence"])
    for t in state["talk"]:
        words = check_reading(t["text"])
        if words:
            problems.append({"part": "talk", "words": words})
            blocked_talk.append(t["text"])
    if not problems:  # 조각은 괜찮은데 요약에만 걸린 경우 (예: 별명) → 카드 의미를 기본 문장으로
        words = check_reading(state["summary"])
        if words:
            problems.append({"part": "summary", "words": words})
            blocked_cards.extend(c["id"] for c in state["cards"])
    tries = state.get("retries", 0)
    log = list(state.get("guard_log", [])) + [{"try": tries, "problems": problems}]
    if not problems:
        return {"passed": True, "guard_log": log}
    return {
        "passed": False,
        "retries": tries + 1,
        "blocked_tips": blocked_tips,
        "blocked_cards": blocked_cards,
        "blocked_talk": blocked_talk,
        "guard_log": log,
    }


def after_guard(state: TarotState) -> str:
    """조건 분기: 통과 → mission / 걸림 → interpret 다시 (최대 2번) / 그래도 걸림 → fallback"""
    if state.get("passed"):
        return "mission"
    if state.get("retries", 0) <= MAX_RETRIES:
        return "interpret"
    return "fallback"


def fallback(state: TarotState) -> TarotState:
    """3번째도 걸리면 카드 키워드로 만든 기본 문장만 씀 (데이터에 문제가 있어도 결과는 항상 나옴)"""
    cards = {c["id"]: c for c in load_cards()}
    safe = []
    for c in state["cards"]:
        meaning = _safe_meaning(cards[c["id"]])
        safe.append({**c, "meaning": meaning, "advice": SAFE_ADVICE, "reading": f"{meaning} {SAFE_ADVICE}", "evidence": None})
    nxt = safe[-1]
    summary = f"서로의 답을 {state['match']}% 맞혔어요. 다음 데이트 카드는 {nxt['emoji']} {nxt['name']} — {SAFE_ADVICE}"
    talk = [t for t in state["talk"] if not check_reading(t["text"])]
    return {"cards": safe, "summary": summary, "talk": talk, "fallback": True}


def mission(state: TarotState) -> TarotState:
    """'우리의 다음 데이트' 카드 → 데이트 코스 장소 + 해 볼 행동 (코스 안내와 같은 모양이라 미니맵 안내에 바로 씀)"""
    nxt = state["drawn"][-1]
    card = next(c for c in load_cards() if c["id"] == nxt["id"])
    places = place_by_id()
    place_id = card["mission"]["placeId"] if card["mission"]["placeId"] in places else FALLBACK_PLACE
    place = places[place_id]
    return {"mission": {
        "placeId": place_id,
        "name": place["name"],
        "zone": place["zone"],
        "zoneName": ZONE_NAMES.get(place["zone"], place["zone"]),
        "type": place.get("type", ""),
        "position": place["position"],
        "text": card["mission"]["text"],
        "reason": f"{card['emoji']} {card['name']} 카드의 데이트 미션",
        "cardId": card["id"],
    }}


def build_graph():
    graph = StateGraph(TarotState)
    graph.add_node("analyze_a", analyze_a)
    graph.add_node("analyze_b", analyze_b)
    graph.add_node("compare", compare)
    graph.add_node("draw", draw)
    graph.add_node("retrieve", retrieve)
    graph.add_node("interpret", interpret)
    graph.add_node("guard", guard)
    graph.add_node("fallback", fallback)
    graph.add_node("mission", mission)
    # START에서 두 갈래로 동시에 → 둘 다 끝나야 compare (리스트로 묶으면 기다렸다 합침)
    graph.add_edge(START, "analyze_a")
    graph.add_edge(START, "analyze_b")
    graph.add_edge(["analyze_a", "analyze_b"], "compare")
    graph.add_edge("compare", "draw")
    graph.add_edge("draw", "retrieve")
    graph.add_edge("retrieve", "interpret")
    graph.add_edge("interpret", "guard")
    # 조건 분기 + 반복: guard 결과에 따라 interpret로 돌아가거나 앞으로 감
    graph.add_conditional_edges("guard", after_guard, {"interpret": "interpret", "fallback": "fallback", "mission": "mission"})
    graph.add_edge("fallback", "mission")
    graph.add_edge("mission", END)
    return graph.compile()


_GRAPH = build_graph()


def read_tarot(a: dict, b: dict, seed: str | None = None) -> dict:
    """두 사람 답 → { names, match, hits, mismatches, sameTaste, focus, cards, summary, talk, mission,
                     retries, guard: { retries, fallback, log }, evidence, seed, source }

    잘못된 답이면 TarotInputError. seed를 다시 보내면 같은 카드가 나옴.
    """
    seed = str(seed)[:64] if seed else secrets.token_hex(8)
    result = _GRAPH.invoke({"a": a, "b": b, "seed": seed})
    return {
        "names": {"a": result["person_a"]["name"], "b": result["person_b"]["name"]},
        "match": result["match"],
        "hits": result["hits"],
        "mismatches": result["mismatches"],
        "sameTaste": result["same_taste"],
        "focus": result["focus"],
        "cards": result["cards"],
        "summary": result["summary"],
        "talk": result["talk"],
        "mission": result["mission"],
        "retries": result.get("retries", 0),
        "guard": {"retries": result.get("retries", 0), "fallback": result.get("fallback", False), "log": result["guard_log"]},
        "evidence": [{k: e[k] for k in ("cardId", "position", "score", "why")} | {"tipId": e["tip"]["id"]} for e in result["evidence"]],
        "seed": seed,
        "source": "rules",
    }
