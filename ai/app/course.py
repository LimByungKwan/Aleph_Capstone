"""AI 가이드 '루미'의 코스 추천 (LangGraph).

흐름 (노드 5개, 한 줄로 이어짐):
  understand → pick → validate → order → reply

- understand: 취향 문장에서 테마(애니·드라마·K-POP·데이트·카페·사진)와 키워드를 찾음
- pick:       몇 곳을 고름. API 키가 있으면 LLM(llm_pick.py, OpenAI), 없거나 실패하면 키워드 규칙
- validate:   맵에 있는 장소 id인지, 중복은 없는지 다시 확인 (LLM이 와도 없는 장소를 못 지어내게)
- order:      광장에서 출발해 전체 걷는 거리가 가장 짧은 순서로 정렬 (카페는 마지막)
- reply:      루미가 말할 문장 만들기

키가 없거나 LLM 호출이 실패해도 규칙으로 대신해서, 서버는 항상 응답한다.

다른 그래프가 이 그래프를 그대로 불러 쓸 수도 있다 (커플 타로 tarot.py의 plan_course 노드):
  zones(이 구역 안에서만) · must(꼭 넣을 장소) · start_xz(출발점)를 주면 그 조건으로 규칙만 써서 고른다.
"""

from __future__ import annotations

import itertools
import math
import re
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from .llm_pick import pick_with_llm
from .places import START_XZ, ZONE_NAMES, course_candidates, place_by_id
from .safety import check_message
from .smalltalk import bridge_line, detect_talk, offtopic_line, talk_effects, talk_line

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

# 기분·상황 → (찾을 단어들, 루미의 첫마디, 고르는 방식)
# 취향(THEMES)이 아니라 "귀찮아", "배고파"처럼 지금 상태를 말해도 동문서답하지 않고 맞춰서 추천
MOODS: dict[str, dict] = {
    "tired": {
        "words": ["귀찮", "피곤", "힘들", "지쳤", "지친", "지쳐", "졸려", "졸리", "집에 가", "집에가", "집 가고", "집가고", "쉬고 싶", "쉬고싶", "다리 아", "걷기 싫", "걷기싫", "멀리 가기 싫"],
        "opening": "많이 지치셨군요! 그럼 멀리 걷지 않고 광장 근처에서 가볍게 들렀다가 쉬어 갈 수 있는 짧은 코스로 골라 봤어요.",
    },
    "hungry": {
        "words": ["배고", "배가 고", "출출", "먹고 싶", "먹고싶", "뭐 먹", "뭐먹", "밥", "간식", "목말라", "목 말라", "커피 마시", "달달한"],
        "opening": "출출하시군요! 맛있는 걸 먹으며 쉬어 갈 수 있는 가게 위주로 골라 봤어요.",
    },
    "bored": {
        "words": ["심심", "지루", "재미없", "재미 없", "놀거리", "놀 거리", "놀고 싶", "놀고싶", "게임", "신나는"],
        "opening": "심심하셨군요! 구경하고 놀 거리가 있는 곳으로 골라 봤어요.",
        "tags": ["인형뽑기", "분수", "소원", "무대", "콘서트"],  # 직접 해 볼 수 있는 것 (미니게임·공연)
        "tags_more": ["굿즈", "팝업스토어", "스포츠", "벽화"],
    },
    "sad": {
        "words": ["우울", "슬퍼", "슬프", "외로", "속상", "기분이 안", "기분 안", "울적", "꿀꿀", "힘든 하루", "위로"],
        "opening": "마음이 조금 무거운 날이군요. 천천히 걸으며 기분 전환하기 좋은 곳으로 골라 봤어요.",
        "tags": ["벚꽃", "산책로", "산책", "야경", "전망대", "바다", "휴식", "소원", "등대"],
    },
    "greeting": {
        "words": ["안녕", "하이", "hello", "hi", "반가", "처음 왔", "처음왔"],
        "opening": "안녕하세요, 반가워요! 처음 오셨다면 구역마다 대표 촬영지를 하나씩 골고루 둘러보는 코스를 추천해요.",
    },
    "thanks": {
        "words": ["고마", "감사", "땡큐", "thank"],
        "opening": "천만에요! 이번에도 걸어 볼 만한 곳을 골고루 골라 드릴게요.",
    },
}
# 먹고 쉴 수 있는 가게 (굿즈 팝업스토어처럼 먹을 게 없는 가게는 빼고)
FOOD_TAGS = ["카페", "분식", "커피", "디저트", "생일카페", "휴식"]
# "추천해줘", "아무거나"처럼 코스를 달라는 말 (취향은 없음) → "처음이시라면"
GENERIC_WORDS = ["추천", "아무", "코스", "골라", "어디", "모르", "뭐 하", "뭐하", "가볼", "가 볼", "둘러"]
FIRST_OPENING = "처음이시라면 골고루 둘러보는 코스를 추천해요!"


class CourseState(TypedDict, total=False):
    rules_only: bool  # True면 LLM을 부르지 않음 (오늘의 코스처럼 항상 같은 결과가 필요할 때)
    message: str
    count: int
    themes: list[str]
    talk: str  # 잡담 종류 (smalltalk.TALKS의 키), 없으면 ''
    short: bool  # 짧은 2곳 코스 (지쳤거나 곧 갈 때)
    mood: str  # MOODS의 키, 'generic'(추천만 원함), 'offtopic'(코스와 관련 없는 말), 없으면 ''
    keywords: list[str]
    picks: list[dict]  # [{id, score, reason}]
    greeting: str  # LLM이 만든 첫 문장 (규칙일 때는 없음)
    source: str  # 'llm' | 'rules'
    course: list[dict]  # 최종 코스 (순서대로)
    reply: str
    # 다른 그래프에서 부를 때만 (없으면 평소 루미 코스)
    zones: list[str]  # 이 구역 장소만 고름 (예: ['BK'])
    must: list[dict]  # 꼭 넣을 장소 [{id, reason}] (예: 타로 미션 장소)
    start_xz: tuple[float, float]  # 걷는 순서를 정할 출발점 (기본: 중앙 광장)


# ── 1. 취향 이해 ─────────────────────────────────
def understand(state: CourseState) -> CourseState:
    text = (state.get("message") or "").lower()
    themes = [key for key, theme in THEMES.items() if any(word in text for word in theme["words"])]
    # 2글자 이상 단어 (장소 이름·작품명·태그와 맞춰 볼 키워드)
    keywords = [w for w in re.findall(r"[0-9a-zA-Z가-힣]+", text) if len(w) >= 2]
    count = max(MIN_COUNT, min(MAX_COUNT, int(state.get("count") or DEFAULT_COUNT)))
    talk = detect_talk(text)
    effects = talk_effects(talk)
    if talk == "compliment":
        themes = [t for t in themes if t != "romance"]  # "루미 사랑해"는 로맨스 취향이 아님
    themes += [t for t in effects.get("themes", []) if t not in themes]
    mood = detect_mood(text, themes, keywords)
    if talk:
        if mood in ("offtopic", "generic") or (talk == "bye" and mood == "greeting"):
            mood = ""  # 잡담에 대답했으니 "잘 모르지만…"은 빼기
        mood = mood or effects.get("mood", "")
    short = mood == "tired" or bool(effects.get("short"))
    if short:
        count = MIN_COUNT  # 짧게: 가까운 촬영지 1곳 + 쉬어 갈 가게
    return {"themes": themes, "talk": talk, "short": short, "mood": mood, "keywords": keywords, "count": count}


def detect_mood(text: str, themes: list[str], keywords: list[str]) -> str:
    for key, mood in MOODS.items():
        if any(word in text for word in mood["words"]):
            return key
    if themes:
        return ""
    # 장소 이름·태그와 맞는 단어가 있으면 취향으로 봄 (예: "벚꽃", "등대")
    for place in course_candidates():
        if any(score_place(place, [], [w])[0] > 0 for w in keywords):
            return ""
    if any(word in text for word in GENERIC_WORDS):
        return "generic"
    return "offtopic"


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


def mood_bonus(place: dict, mood: str, score: float, reasons: list[str]) -> tuple[float, list[str]]:
    """기분에 맞춰 점수 더하기 (지침 → 가까운 곳, 배고픔 → 가게, 심심·우울 → 맞는 태그)"""
    tags = place.get("tags", [])
    food = place["type"] == "cafe" and any(t in FOOD_TAGS for t in tags)
    if mood == "tired":
        if place["type"] == "cafe" and not food:
            return score - 5, reasons  # 앉아 쉴 수 없는 가게(굿즈 팝업 등)는 빼기
        dist = math.dist(START_XZ, (place["position"][0], place["position"][2]))
        bonus = max(0.0, 4 - dist / 30)  # 광장에서 가까울수록
        if bonus > 0:
            score += bonus
            reasons = (["잠깐 앉아 쉬어 가기 좋은 가게"] if food else ["광장에서 가까워 금방 다녀올 수 있는 곳"]) + reasons
    elif mood == "hungry":
        if food:
            score += 4
            kind = next((t for t in tags if t in ("분식", "생일카페", "디저트", "커피")), "카페")
            reasons = [f"{kind}에서 출출함을 달래기 좋은 곳"] + reasons
        elif place["type"] == "cafe":
            score -= 5  # 먹을 게 없는 가게는 빼기
    elif mood in ("bored", "sad"):
        hits = [t for t in tags if t in MOODS[mood]["tags"]]
        more = [t for t in tags if t in MOODS[mood].get("tags_more", [])]
        if hits or more:
            score += 3.5 if hits else 1.5
            tag = (hits or more)[0]
            reasons = ([f"{tag}(으)로 놀 거리가 있는 곳"] if mood == "bored" else [f"{tag} 덕분에 기분 전환하기 좋은 곳"]) + reasons
    return score, reasons


def _short_course(ranked: list[dict]) -> list[dict]:
    """지쳤을 때: 가장 알맞은 촬영지 1곳 + 그 바로 옆에서 앉아 쉴 수 있는 가게 1곳"""
    known = place_by_id()
    xz = lambda s: (known[s["id"]]["position"][0], known[s["id"]]["position"][2])  # noqa: E731
    spot = next(s for s in ranked if s["type"] != "cafe")
    cafes = [s for s in ranked if s["type"] == "cafe" and any(t in FOOD_TAGS for t in known[s["id"]].get("tags", []))]
    picks = [spot]
    if cafes:
        cafe = min(cafes, key=lambda c: math.dist(xz(spot), xz(c)))
        near = math.dist(xz(spot), xz(cafe)) < 40
        picks.append({**cafe, "reasons": ["바로 근처라 잠깐 앉아 쉬어 가기 좋은 가게" if near else "가까운 가게 중에 앉아 쉬어 가기 좋은 곳"]})
    return [{"id": p["id"], "score": p["score"], "reason": (p["reasons"] or ["광장에서 가까워 금방 다녀올 수 있는 곳"])[0]} for p in picks]


def pick_with_rules(state: CourseState) -> CourseState:
    themes = state.get("themes", [])
    keywords = state.get("keywords", [])
    count = state["count"]
    scored = []
    mood = state.get("mood", "")
    zones_only = state.get("zones") or []
    musts = [m for m in state.get("must", []) if m.get("id") in place_by_id()]
    must_ids = {m["id"] for m in musts}
    for place in course_candidates():
        if (zones_only and place["zone"] not in zones_only) or place["id"] in must_ids:
            continue
        score, reasons = score_place(place, themes, keywords)
        score, reasons = mood_bonus(place, mood, score, reasons)
        scored.append({"id": place["id"], "score": score, "reasons": reasons, "zone": place["zone"], "type": place["type"]})
    # 점수 높은 순, 같으면 맵 데이터 순서 (항상 같은 결과)
    ranked = sorted(scored, key=lambda s: -s["score"])

    if state.get("short"):
        return {"picks": _short_course(ranked), "source": "rules"}

    picks: list[dict] = [{"id": m["id"], "score": 99, "reasons": [m.get("reason") or "꼭 들를 곳"], "zone": place_by_id()[m["id"]]["zone"], "type": place_by_id()[m["id"]]["type"]} for m in musts]
    # 취향을 하나도 못 찾은 "골고루" 코스인지 (아무거나·처음 왔어요·모르는 말 등)
    mixed = not (ranked and ranked[0]["score"] > 0)
    if not mixed:
        picks += [s for s in ranked if s["score"] > 0][: max(0, count - len(picks))]
    # 취향을 못 알아들었거나 부족하면: 구역마다 대표 촬영지 하나씩 고르게 섞어서 채움
    if len(picks) < count:
        taken = {p["id"] for p in picks}
        zones_used = {p["zone"] for p in picks}
        for s in scored:
            if len(picks) >= count:
                break
            # 구역을 정해 준 경우(zones)는 같은 구역에서 채움, 평소엔 구역마다 하나씩
            if s["id"] in taken or s["type"] != "spot" or (s["zone"] in zones_used and not zones_only):
                continue
            picks.append({**s, "reasons": s["reasons"] or ["처음 오셨다면 꼭 들러 볼 대표 촬영지"]})
            taken.add(s["id"])
            zones_used.add(s["zone"])
    # 3곳 이상이면(지쳤을 때는 2곳이어도) 마지막에 쿠폰을 쓸 카페 하나는 넣기 (스탬프 → 쿠폰 흐름)
    if (count >= 3 or mood == "tired") and not any(p["type"] == "cafe" for p in picks):
        zones = [p["zone"] for p in picks]
        cafes = [s for s in ranked if s["type"] == "cafe"]
        if mood == "tired":
            # 지쳤으면 방금 고른 곳 바로 옆 가게로 (멀리 걷지 않게)
            known = place_by_id()
            anchors = [(known[p["id"]]["position"][0], known[p["id"]]["position"][2]) for p in picks[: count - 1]] or [START_XZ]
            cafes = [c for c in cafes if c["score"] > -5]
            cafes.sort(key=lambda s: min(math.dist(a, (known[s["id"]]["position"][0], known[s["id"]]["position"][2])) for a in anchors))
        elif mixed:
            # 골고루 코스: 이미 고른 곳과 다른 구역의 (먹고 쉴 수 있는) 가게로 → 바로 옆 가게로 끝나지 않게
            known = place_by_id()
            kept = {p["zone"] for p in picks[: count - 1]}
            is_food = lambda c: any(t in FOOD_TAGS for t in known[c["id"]].get("tags", []))  # noqa: E731
            cafes.sort(key=lambda c: (c["zone"] in kept, not is_food(c), -c["score"]))
        else:
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
    if state.get("zones") or state.get("must"):
        return pick_with_rules(state)  # 다른 그래프가 조건을 정해 부를 때는 규칙만 (같은 입력 → 같은 코스)
    result = None if state.get("rules_only") else pick_with_llm(state.get("message", ""), state["count"])
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
def _walk_length(route: list[dict], known: dict, start: tuple[float, float] = START_XZ) -> float:
    here, total = start, 0.0
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
    start = tuple(state.get("start_xz") or START_XZ)
    best = min(routes, key=lambda r: _walk_length(r, known, start), default=[])
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
    mood = state.get("mood", "")
    talk = state.get("talk", "")
    message = state.get("message", "")
    if talk and not state.get("greeting"):
        # 잡담에 먼저 대답 → (기분·취향이 있으면 그 말, 없으면 넘어가는 말) → 코스
        line = talk_line(talk, message)
        if talk_effects(talk).get("bridged"):
            rest = ""
        elif mood in MOODS:
            rest = MOODS[mood]["opening"]
        elif labels:
            rest = f"{'·'.join(labels[:2])} 좋아하시는군요! 그쪽으로 골라 봤어요."
        else:
            rest = bridge_line(message)
        opening = f"{line} {rest} ".replace("  ", " ")
    elif state.get("greeting"):
        opening = state["greeting"].rstrip() + " "
    elif mood in ("greeting", "thanks") and labels:
        hello = "안녕하세요, 반가워요!" if mood == "greeting" else "천만에요!"
        opening = f"{hello} {'·'.join(labels[:2])} 좋아하시는군요! "
    elif mood in MOODS:
        opening = MOODS[mood]["opening"] + " "
        labels = [l for l in labels if not (mood == "hungry" and l == "카페")]
        if labels:
            opening += f"{'·'.join(labels[:2])} 취향도 같이 담았어요. "
    elif labels:
        opening = f"{'·'.join(labels[:2])} 좋아하시는군요! "
    elif mood == "offtopic":
        opening = offtopic_line(message) + " "
    else:
        opening = FIRST_OPENING + " "
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


def recommend_course(message: str, count: int = DEFAULT_COUNT, rules_only: bool = False) -> dict:
    """취향 문장 → { reply, course, nextPlaceId, themes }"""
    # 부적절한 말은 코스 추천보다 먼저 (LLM이 켜져 있어도 이런 말은 밖으로 보내지 않음) — safety.py
    flagged = check_message(message)
    if flagged and not flagged["course"]:
        return {"reply": flagged["reply"], "course": [], "nextPlaceId": None, "themes": [], "source": "rules", "flagged": flagged["category"]}
    if flagged:  # 힘든 마음: 상담 안내 + 조용히 걸을 코스
        calm = recommend_course("기분 전환하고 싶어 우울해", count, rules_only=True)
        steps = " → ".join(f"{n + 1}. {c['name']}" for n, c in enumerate(calm["course"]))
        return {**calm, "reply": f"{flagged['reply']} {steps}.", "flagged": flagged["category"]}
    result = _GRAPH.invoke({"message": message, "count": count, "rules_only": rules_only})
    course = result.get("course", [])
    return {
        "reply": result.get("reply", ""),
        "course": course,
        "nextPlaceId": course[0]["placeId"] if course else None,
        "themes": result.get("themes", []),
        "source": result.get("source", "rules"),
    }
