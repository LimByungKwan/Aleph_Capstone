"""오늘의 코스 테스트"""

from datetime import date, timedelta

from fastapi.testclient import TestClient

import app.course as course
from app.daily import DAILY_THEMES, daily_course
from app.main import app

client = TestClient(app)
MONDAY = date(2026, 11, 16)


def test_same_day_same_course():
    a = daily_course(MONDAY)
    b = daily_course(MONDAY)
    assert [c["placeId"] for c in a["course"]] == [c["placeId"] for c in b["course"]]
    assert a["date"] == "2026-11-16" and a["title"] == DAILY_THEMES[0]["title"]


def test_each_weekday_has_its_own_theme_and_course():
    courses = {tuple(c["placeId"] for c in daily_course(MONDAY + timedelta(days=i))["course"]) for i in range(7)}
    assert len(courses) >= 5  # 요일마다 대부분 다른 코스
    monday = daily_course(MONDAY)
    assert all(c["zone"] == "BK" for c in monday["course"])  # 월요일 = 야경 데이트


def test_daily_never_calls_llm(monkeypatch):
    def boom(*args, **kwargs):
        raise AssertionError("오늘의 코스는 LLM을 부르면 안 됨")

    monkeypatch.setattr(course, "pick_with_llm", boom)
    result = daily_course(MONDAY)
    assert result["source"] == "rules" and len(result["course"]) == 3


def test_daily_api():
    body = client.get("/daily").json()
    assert len(body["course"]) == 3 and body["date"] and body["emoji"]
    assert body["reply"].startswith(body["emoji"])
