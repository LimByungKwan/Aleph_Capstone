"""오늘의 코스 (GET /daily) — 날짜마다 다른 테마, 같은 날엔 누구에게나 같은 코스.

요일(한국 시간)마다 테마를 정하고, 규칙 추천(rules_only, LLM 안 씀 → 요금 0원·항상 같은 결과)으로 코스를 만든다.
프론트는 이 코스를 완주하면 "오늘의 코스 완주" 배지를 날짜와 함께 준다 (frontend/src/store/badges.js).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from .course import recommend_course

KST = timezone(timedelta(hours=9))

# 월요일(0) ~ 일요일(6)
DAILY_THEMES = [
    {"title": "월요일 야경 데이트", "emoji": "🌃", "message": "연인이랑 야경 보는 데이트"},
    {"title": "화요일 애니 성지순례", "emoji": "🌸", "message": "애니메이션 성지순례 하고 싶어"},
    {"title": "수요일 드라마 촬영지 산책", "emoji": "🎬", "message": "드라마 촬영지 가 보고 싶어"},
    {"title": "목요일 K-POP 투어", "emoji": "🎤", "message": "케이팝 무대랑 굿즈 보고 싶어"},
    {"title": "금요일 골목 한 바퀴", "emoji": "🧭", "message": "아무거나 골고루 추천해줘"},
    {"title": "토요일 놀거리 코스", "emoji": "🎮", "message": "너무 심심해"},
    {"title": "일요일 힐링 산책", "emoji": "🍃", "message": "오늘 좀 우울해"},
]


def today_kst() -> date:
    return datetime.now(KST).date()


def daily_course(day: date | None = None) -> dict:
    day = day or today_kst()
    theme = DAILY_THEMES[day.weekday()]
    result = recommend_course(theme["message"], 3, rules_only=True)
    return {
        **result,
        "date": day.isoformat(),
        "title": theme["title"],
        "emoji": theme["emoji"],
        "reply": _daily_reply(theme, result["course"]),
    }


def _daily_reply(theme: dict, course: list[dict]) -> str:
    """기분·취향 인사("처음이시라면…") 대신 오늘의 코스 소개로 시작"""
    intro = f"{theme['emoji']} 오늘의 코스는 '{theme['title']}'예요! 완주하면 오늘의 배지를 드려요."
    if not course:
        return intro
    steps = " → ".join(f"{i + 1}. {c['name']}" for i, c in enumerate(course))
    first = course[0]
    return f"{intro} {steps}. 먼저 {first['zoneName']}의 '{first['name']}'부터 가 볼까요? 지도에 표시해 둘게요."
