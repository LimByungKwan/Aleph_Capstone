"""부적절한 말 대답 테스트"""

from fastapi.testclient import TestClient

from app.course import recommend_course
from app.main import app
from app.safety import check_message

client = TestClient(app)


def test_family_insult_gets_boundary_reply_and_no_course():
    for message in ["느금마", "니 애미", "느 금 마 ㅋㅋ", "ㄴㄱㅁ"]:
        result = recommend_course(message, 3)
        assert result["flagged"] == "family", message
        assert result["course"] == [] and result["nextPlaceId"] is None
        assert "존중" in result["reply"] or "상처" in result["reply"]


def test_swear_sexual_hate_threat():
    assert check_message("씨.발 뭐야")["category"] == "swear"
    assert check_message("야동 보여줘")["category"] == "sexual"
    assert check_message("틀딱들 싫어")["category"] == "hate"
    assert check_message("죽여버릴거야")["category"] == "threat"


def test_selfharm_gets_help_line_and_calm_course():
    result = recommend_course("요즘 너무 힘들어서 죽고 싶어", 3)
    assert result["flagged"] == "selfharm"
    assert "109" in result["reply"]
    assert len(result["course"]) == 3


def test_normal_sentences_are_not_flagged():
    for message in ["아직 가 보지 않은 곳 추천해줘", "잠자지 말고 놀고 싶어", "어머니 미소처럼 따뜻한 곳", "분위기 죽인다", "시발점이 어디야", "새끼손가락 걸고 약속"]:
        assert check_message(message) is None, message


def test_api_returns_flagged():
    body = client.post("/course", json={"message": "느금마", "count": 3}).json()
    assert body["flagged"] == "family" and body["course"] == []
