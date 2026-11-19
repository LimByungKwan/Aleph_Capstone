"""AI 가이드 '루미'의 코스 추천 (LangGraph).

흐름 (노드 5개, 한 줄로 이어짐):
  understand → pick → validate → order → reply

- understand: 취향 문장에서 테마(애니·드라마·K-POP·데이트·카페·사진)와 키워드를 찾음
- pick:       몇 곳을 고름. API 키가 있으면 LLM(llm_pick.py, OpenAI), 없거나 실패하면 키워드 규칙
- validate:   맵에 있는 장소 id인지, 중복은 없는지 다시 확인 (LLM이 와도 없는 장소를 못 지어내게)
- order:      광장에서 출발해 전체 걷는 거리가 가장 짧은 순서로 정렬 (카페는 마지막)
- reply:      루미가 말할 문장 만들기

키가 없거나 LLM 호출이 실패해도 규칙으로 대신해서, 서버는 항상 응답한다.
"""

from __future__ import annotations

import itertools
import math
import re
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from .llm_pick import pick_with_llm
from .places import START_XZ, ZONE_NAMES, course_candidates, place_by_id

MIN_COUNT = 2
MAX_COUNT = 5
DEFAULT_COUNT = 3

# 테마 → (찾을 단어들, 구역 코드, 장소 종류)
THEMES: dict[str, dict] = {
    "anime": {"label": "애니메이션", "zone": "JM", "words": ["애니", "애니메이션", "만화", "일본", "신사", "요괴", "벚꽃", "성지"]},
    "drama": {"label": "영화·드라마", "zone": "HJ", "words": ["드라마", "영화", "웹드라마", "배우", "촬영지", "레트로", "바다", "등대"]},
    "kpop": {"label": "K-POP", "zone": "SG", "words": ["케이팝", "kpop", "k-pop", "아이돌", "콘서트", "무대", "굿즈", "앨범", "생일카페", "팬"]},
    "date": {"label": "데이트", "zone": "BK", "words": ["데이트", "커플", "연인", "애인", "여자친구", "남자친구", "기념일", "전망대", "야경", "산책"]},
    "cafe": {"label": "카페", "type": "cafe", "words": ["카페", "커피", "디저트", "분식", "먹", "배고", "쿠폰", "쉬"]},
    "photo": {"label": "사진", "words": ["사진", "포토", "인생샷", "벽화", "인증샷"]},
    "romance": {"label": "로맨스", "words": ["로맨스", "로맨틱", "설레", "고백", "사랑"]},
}


class CourseState(TypedDict, total=False):
    message: str
    count: int
    themes: list[str]
    keywords: list[str]
    picks: list[dict]  # [{id, score, reason}]
    greeting: str  # LLM이 만든 첫 문장 (규칙일 때는 없음)
    source: str  # 'llm' | 'rules'
    course: list[dict]  # 최종 코스 (순서대로)
    reply: str


# ── 1. 취향 이해 ─────────────────────────────────
def understand(state: CourseState) -> CourseState:
    text = (state.get("message") or "").lower()
    themes = [key for key, theme in THEMES.items() if any(word in text for word in theme["words"])]
    # 2글자 이상 단어 (장소 이름·작품명·태그와 맞춰 볼 키워드)
    keywords = [w for w in re.findall(r"[0-9a-zA-Z가-힣]+", text) if len(w) >= 2]
    count = max(MIN_COUNT, min(MAX_COUNT, int(state.get("count") or DEFAULT_COUNT)))
    return {"themes": themes, "keywords": keywords, "count": count}


# ── 2. 장소 고르기 (규칙) ──────────────────────────
def _place_text(place: dict) -> str:
    return " ".join([place["name"], place.get("work") or "", place.get("description") or "", " ".join(place.get("tags", []))]).lower()


def score_place(place: dict, themes: list[str], keywords: list[str]) -> tuple[float, list[str]]:
    """점수와 고른 이유(짧은 문장들)."""
    score = 0.0
    reasons: list[str] = []
    text = _place_text(place)
    tags = [t.lower() for t in place.get("tags", [])]
    for key in themes:
        theme = THEMES[key]
        if theme.get("zone") == place["zone"]:
            score += 3
            reasons.append(f"{theme['label']} 취향에 딱 맞는 {ZONE_NAMES[place['zone']]}")
        if theme.get("type") == place["type"]:
            score += 2.5
            reasons.append("잠깐 쉬어 가기 좋은 가게")
        hits = [w for w in theme["words"] if w in text]
        if hits:
            score += 1.5
            if theme.get("zone") != place["zone"] and theme.get("type") != place["type"]:
                reasons.append(f"{theme['label']} 분위기가 나는 곳 ({hits[0]})")
    for word in keywords:
        if any(word in tag or tag in word for tag in tags) or word in place["name"].lower():
            score += 2
            reasons.append(f"'{word}' 키워드")
    return score, reasons


def pick_with_rules(state: CourseState) -> CourseState:
    themes = state.get("themes", [])
    keywords = state.get("keywords", [])
    count = state["count"]
    scored = []
    for place in course_candidates():
        score, reasons = score_place(place, themes, keywords)
        scored.append({"id": place["id"], "score": score, "reasons": reasons, "zone": place["zone"], "type": place["type"]})
    # 점수 높은 순, 같으면 맵 데이터 순서 (항상 같은 결과)
    ranked = sorted(scored, key=lambda s: -s["score"])

    picks: list[dict] = []
    if ranked and ranked[0]["score"] > 0:
        picks = [s for s in ranked if s["score"] > 0][:count]
    # 취향을 못 알아들었거나 부족하면: 구역마다 대표 촬영지 하나씩 고르게 섞어서 채움
    if len(picks) < count:
        taken = {p["id"] for p in picks}
        zones_used = {p["zone"] for p in picks}
        for s in scored:
            if len(picks) >= count:
                break
            if s["id"] in taken or s["type"] != "spot" or s["zone"] in zones_used:
                continue
            picks.append({**s, "reasons": s["reasons"] or ["처음 오셨다면 꼭 들러 볼 대표 촬영지"]})
            taken.add(s["id"])
            zones_used.add(s["zone"])
    # 3곳 이상이면 마지막에 쿠폰을 쓸 카페 하나는 넣기 (스탬프 → 쿠폰 흐름)
    if count >= 3 and not any(p["type"] == "cafe" for p in picks):
        zones = [p["zone"] for p in picks]
        cafes = [s for s in ranked if s["type"] == "cafe"]
        cafes.sort(key=lambda s: (s["zone"] not in zones, -s["score"]))
        if cafes:
            picks = picks[: count - 1] + [{**cafes[0], "reasons": cafes[0]["reasons"] or ["스탬프를 모은 뒤 쿠폰을 쓰기 좋은 가게"]}]
    return {"picks": [{"id": p["id"], "score": p["score"], "reason": (p["reasons"] or ["추천 장소"])[0]} for p in picks], "source": "rules"}


def _xz(place: dict) -> tuple[float, float]:
    return (place["position"][0], place["position"][2])


def prefer_theme_zone(picks: list[dict], state: CourseState) -> list[dict]:
    """취향과 맞는 구역(데이트 → BK 등)의 장소가 빠졌으면 채워 넣고, 다른 구역 장소는 그 구역에서 가까운 것만 남김.

    LLM이 '바다 야경' 같은 이유로 먼 구역을 골라도, 코스가 맵을 가로질러 오가지 않게 서버에서 한 번 더 정리한다.
    """
    zones = [THEMES[k]["zone"] for k in state.get("themes", []) if THEMES[k].get("zone")]
    if not zones:
        return picks
    known = place_by_id()
    count = state["count"]
    in_zone = [p for p in picks if known.get(p["id"], {}).get("zone") in zones]
    taken = {p["id"] for p in picks}
    # 1) 맞는 구역에서 빠진 장소를 규칙 점수 순으로 추가
    for p in pick_with_rules({**state, "count": MAX_COUNT})["picks"]:
        place = known[p["id"]]
        if place["zone"] in zones and p["id"] not in taken and len(in_zone) < count:
            in_zone.append(p)
            taken.add(p["id"])
    # 2) 남은 자리는 LLM이 고른 다른 구역 장소 중 맞는 구역과 가까운 순으로
    others = [p for p in picks if p not in in_zone and p["id"] in known]
    if in_zone:
        anchors = [_xz(known[p["id"]]) for p in in_zone]
        others.sort(key=lambda p: min(math.dist(_xz(known[p["id"]]), a) for a in anchors))
    result = in_zone[:count] + others[: max(0, count - len(in_zone))]
    # 3) 3곳 이상인데 카페가 빠졌으면 마지막 자리에 카페: LLM이 골랐던 카페, 없으면 맞는 구역과 가장 가까운 카페
    if count >= 3 and not any(known[p["id"]]["type"] == "cafe" for p in result):
        cafes = [p for p in picks if known.get(p["id"], {}).get("type") == "cafe"]
        if not cafes:
            anchors = [_xz(known[p["id"]]) for p in result]
            nearest = min(
                (c for c in course_candidates() if c["type"] == "cafe"),
                key=lambda c: (c["zone"] not in zones, min(math.dist(_xz(c), a) for a in anchors)),
            )
            cafes = [{"id": nearest["id"], "score": 0, "reason": "스탬프를 모은 뒤 쿠폰을 쓰며 쉬어 가기 좋은 가게"}]
        result = result[: count - 1] + [cafes[0]]
    return result


def pick(state: CourseState) -> CourseState:
    """LLM으로 먼저 고르고, 안 되면 규칙으로. 너무 적게 골랐으면 규칙 결과로 채움"""
    result = pick_with_llm(state.get("message", ""), state["count"])
    if not result or not result["picks"]:
        return pick_with_rules(state)
    picks = [{"id": p["id"], "score": 0, "reason": p["reason"]} for p in result["picks"]][: state["count"]]
    if len({p["id"] for p in picks}) < min(2, state["count"]):
        taken = {p["id"] for p in picks}
        extra = [p for p in pick_with_rules(state)["picks"] if p["id"] not in taken]
        picks += extra[: state["count"] - len(picks)]
    return {"picks": prefer_theme_zone(picks, state), "greeting": result["greeting"], "source": "llm"}


# ── 3. 검증 (맵에 있는 장소만, 중복 없이) ─────────────────
def validate(state: CourseState) -> CourseState:
    known = place_by_id()
    seen: set[str] = set()
    picks = []
    for p in state.get("picks", []):
        place = known.get(p["id"])
        if not place or place["type"] == "npc" or p["id"] in seen:
            continue
        seen.add(p["id"])
        picks.append(p)
    return {"picks": picks}


# ── 4. 걷는 순서 (전체 걷는 거리가 가장 짧게) ─────────────────
def _walk_length(route: list[dict], known: dict) -> float:
    here, total = START_XZ, 0.0
    for p in route:
        nxt = _xz(known[p["id"]])
        total += math.dist(here, nxt)
        here = nxt
    return total


def order(state: CourseState) -> CourseState:
    known = place_by_id()
    remaining = list(state.get("picks", []))
    # 쿠폰 카페는 마지막에 (스탬프를 다 모은 뒤 들르도록). 최대 5곳이라 모든 순서를 다 재 봐도 빠름
    cafes = [p for p in remaining if known[p["id"]]["type"] == "cafe"]
    spots = [p for p in remaining if p not in cafes]
    routes = (list(a) + list(b) for a in itertools.permutations(spots) for b in itertools.permutations(cafes))
    best = min(routes, key=lambda r: _walk_length(r, known), default=[])
    course = []
    for nxt in best:
        place = known[nxt["id"]]
        course.append(
            {
                "placeId": place["id"],
                "name": place["name"],
                "zone": place["zone"],
                "zoneName": ZONE_NAMES.get(place["zone"], place["zone"]),
                "type": place["type"],
                "position": place["position"],
                "reason": nxt["reason"],
            }
        )
    return {"course": course}


# ── 5. 루미의 말 ──────────────────────────────────
def reply(state: CourseState) -> CourseState:
    course = state.get("course", [])
    if not course:
        return {"reply": "음… 지금은 추천할 장소를 찾지 못했어요. 좋아하는 작품이나 분위기를 조금 더 알려 주세요!"}
    labels = [THEMES[k]["label"] for k in state.get("themes", [])]
    if state.get("greeting"):
        opening = state["greeting"].rstrip() + " "
    else:
        opening = f"{'·'.join(labels[:2])} 좋아하시는군요! " if labels else "처음이시라면 골고루 둘러보는 코스를 추천해요! "
    steps = " → ".join(f"{i + 1}. {c['name']}" for i, c in enumerate(course))
    first = course[0]
    closing = f"먼저 {first['zoneName']}의 '{first['name']}'부터 가 볼까요? 지도에 표시해 둘게요."
    return {"reply": f"{opening}{steps}. {closing}"}


def build_graph():
    graph = StateGraph(CourseState)
    graph.add_node("understand", understand)
    graph.add_node("pick", pick)
    graph.add_node("validate", validate)
    graph.add_node("order", order)
    graph.add_node("reply", reply)
    graph.add_edge(START, "understand")
    graph.add_edge("understand", "pick")
    graph.add_edge("pick", "validate")
    graph.add_edge("validate", "order")
    graph.add_edge("order", "reply")
    graph.add_edge("reply", END)
    return graph.compile()


_GRAPH = build_graph()


def recommend_course(message: str, count: int = DEFAULT_COUNT) -> dict:
    """취향 문장 → { reply, course, nextPlaceId, themes }"""
    result = _GRAPH.invoke({"message": message, "count": count})
    course = result.get("course", [])
    return {
        "reply": result.get("reply", ""),
        "course": course,
        "nextPlaceId": course[0]["placeId"] if course else None,
        "themes": result.get("themes", []),
        "source": result.get("source", "rules"),
    }
