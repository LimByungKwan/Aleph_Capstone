"""코스 추천 테스트 — LLM 없이 규칙만으로 돌아가는지 확인 (ai/ 폴더에서: python -m pytest)"""

from fastapi.testclient import TestClient

from app.course import recommend_course
from app.main import app
from app.places import place_by_id

client = TestClient(app)
KNOWN = place_by_id()


def ids(result):
    return [c["placeId"] for c in result["course"]]


def test_only_real_places_no_npc_no_duplicates():
    for message in ["애니 좋아해요", "케이팝 아이돌 굿즈", "아무거나", "데이트 코스 추천해줘", "ㅁㄴㅇㄹ"]:
        result = recommend_course(message, 4)
        course_ids = ids(result)
        assert course_ids, message
        assert all(i in KNOWN for i in course_ids), message
        assert all(KNOWN[i]["type"] != "npc" for i in course_ids), message
        assert len(course_ids) == len(set(course_ids)), message
        assert result["nextPlaceId"] == course_ids[0]


def test_anime_request_goes_to_anime_zone():
    result = recommend_course("애니메이션 성지순례 하고 싶어", 3)
    zones = [c["zone"] for c in result["course"]]
    assert zones.count("JM") >= 2
    assert "anime" in result["themes"]


def test_kpop_request_prefers_sg_and_ends_with_cafe():
    result = recommend_course("케이팝 아이돌 콘서트랑 굿즈 보고 싶어요", 3)
    assert all(c["zone"] == "SG" for c in result["course"])
    assert result["course"][-1]["type"] == "cafe"  # 쿠폰 쓰는 가게는 마지막


def test_unknown_taste_gives_mixed_course_with_cafe():
    result = recommend_course("잘 모르겠어요", 3)
    zones = {c["zone"] for c in result["course"]}
    assert len(zones) >= 2
    assert any(c["type"] == "cafe" for c in result["course"])
    assert "골고루" in result["reply"]


def test_count_is_clamped():
    assert len(recommend_course("드라마", 2)["course"]) == 2
    assert len(recommend_course("드라마", 99)["course"]) <= 5


def test_api_endpoints():
    assert client.get("/health").json()["ok"] is True
    res = client.post("/course", json={"message": "데이트하기 좋은 곳", "count": 3})
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "rules"
    assert body["course"] and body["reply"]
    assert client.post("/course", json={"message": ""}).status_code == 422  # 빈 문장은 거절


def test_llm_path_uses_only_real_places_and_keeps_order(monkeypatch):
    """LLM이 고른 결과를 흉내 내서 흐름 확인: 없는 id는 버리고, 순서는 서버가 정함"""
    import app.course as course

    def fake_llm(message, count):
        return {
            "greeting": "벚꽃 좋아하시는군요!",
            "picks": [
                {"id": "cafe_soran", "reason": "마지막에 쉬어 가기"},
                {"id": "spot_jm_sakura_river", "reason": "벚꽃 강변"},
                {"id": "made_up_place", "reason": "없는 장소"},
            ],
        }

    monkeypatch.setattr(course, "pick_with_llm", fake_llm)
    result = course.recommend_course("벚꽃 보고 싶어", 3)
    assert result["source"] == "llm"
    assert "made_up_place" not in ids(result)
    assert ids(result)[0] == "spot_jm_sakura_river"  # 촬영지 먼저, 카페는 마지막
    assert ids(result)[-1] == "cafe_soran"
    assert result["reply"].startswith("벚꽃 좋아하시는군요!")


def test_llm_failure_falls_back_to_rules(monkeypatch):
    import app.course as course

    monkeypatch.setattr(course, "pick_with_llm", lambda message, count: None)
    result = course.recommend_course("애니 좋아해요", 3)
    assert result["source"] == "rules"
    assert result["course"]


def test_llm_far_pick_is_pulled_back_to_theme_zone(monkeypatch):
    """데이트 요청인데 LLM이 먼 구역만 골라도, 데이트 구역 장소를 채우고 카페는 마지막"""
    import app.course as course

    def fake_llm(message, count):
        return {
            "greeting": "데이트 좋아요!",
            "picks": [
                {"id": "spot_hj_breakwater", "reason": "바다 야경"},
                {"id": "spot_jm_shrine", "reason": "신사"},
                {"id": "cafe_soran", "reason": "마무리 카페"},
            ],
        }

    monkeypatch.setattr(course, "pick_with_llm", fake_llm)
    result = course.recommend_course("여자친구랑 데이트하고 싶어", 3)
    assert all(c["zone"] == "BK" for c in result["course"])  # 데이트 구역 장소로 다 채워짐 (먼 구역은 빠짐)
    assert ids(result)[-1] == "cafe_soran"


def test_rate_limit_per_person(monkeypatch):
    from app import limits

    limits.reset()
    monkeypatch.setenv("RATE_PER_MINUTE", "2")
    ok = [client.post("/course", json={"message": "드라마", "count": 2}).status_code for _ in range(3)]
    assert ok == [200, 200, 429]
    limits.reset()


def test_llm_daily_limit_falls_back_to_rules(monkeypatch):
    from app import limits

    limits.reset()
    monkeypatch.setenv("LLM_DAILY_LIMIT", "1")
    assert limits.take_llm_call() is True
    assert limits.take_llm_call() is False  # 한도를 넘으면 LLM 안 부름 → 규칙으로
    limits.reset()


def test_llm_off_by_default(monkeypatch):
    """키가 있어도 LLM_DAILY_LIMIT을 켜지 않으면 OpenAI를 부르지 않음 (요금 0원)"""
    from app import llm_pick

    monkeypatch.setenv("LLM_API_Key", "sk-test-not-real")
    monkeypatch.delenv("LLM_DAILY_LIMIT", raising=False)
    monkeypatch.delenv("SCENEWALK_DISABLE_LLM", raising=False)
    assert llm_pick.llm_enabled() is False
    assert llm_pick.pick_with_llm("데이트", 3) is None


def test_tired_gives_short_course_with_rest_stop():
    """'귀찮아 집에 가고 싶어' → 동문서답 대신 짧은 코스 (촬영지 1곳 + 바로 옆 가게)"""
    result = recommend_course("귀찮아 집에 가고 싶어", 4)
    assert "지치셨군요" in result["reply"] and "처음이시라면" not in result["reply"]
    assert len(result["course"]) == 2
    assert result["course"][0]["type"] == "spot" and result["course"][-1]["type"] == "cafe"
    assert result["course"][0]["zone"] == result["course"][1]["zone"]  # 멀리 걷지 않게 같은 구역


def test_hungry_picks_food_places_only():
    result = recommend_course("배고파", 3)
    assert "출출하시군요" in result["reply"]
    assert all(c["type"] == "cafe" for c in result["course"])
    assert "shop_sg_goods" not in ids(result)  # 굿즈 팝업스토어는 먹을 곳이 아님


def test_bored_picks_minigame_places():
    result = recommend_course("너무 심심해", 3)
    assert "심심하셨군요" in result["reply"]
    assert {"spot_bk_claw", "spot_bk_fountain"} <= set(ids(result))


def test_sad_and_greeting_and_offtopic_replies():
    assert "마음이 조금 무거운" in recommend_course("오늘 좀 우울해", 3)["reply"]
    assert recommend_course("안녕", 3)["reply"].startswith("안녕하세요")
    assert recommend_course("안녕 케이팝 좋아해", 3)["reply"].startswith("안녕하세요, 반가워요! K-POP 좋아하시는군요")
    offtopic = recommend_course("오늘 점심 뭐였지", 3)["reply"]
    assert "골고루" in offtopic and "처음이시라면" not in offtopic
    assert recommend_course("아무거나 추천해줘", 3)["reply"].startswith("처음이시라면")


def test_mood_with_taste_keeps_both():
    result = recommend_course("피곤한데 애니 보고 싶어", 3)
    assert "지치셨군요" in result["reply"] and "애니메이션 취향도" in result["reply"]
    assert result["course"][0]["zone"] == "JM" and len(result["course"]) == 2


def test_small_talk_is_answered_before_course():
    """아무 말이나 해도 그 말에 먼저 대답하고 코스를 추천"""
    cases = {
        "넌 누구야?": "루미",
        "너 AI야?": "AI 가이드",
        "스탬프는 어떻게 모아?": "E를 누르면",
        "여기 어디야": "중앙 광장",
        "오늘 날씨 어때": "날씨",
        "루미 너무 귀엽다": "",
        "웃긴 얘기 해줘": "",
    }
    for message, expected in cases.items():
        result = recommend_course(message, 3)
        assert expected in result["reply"], message
        assert "처음이시라면" not in result["reply"] and "잘 모르지만" not in result["reply"], message
        assert len(result["course"]) == 3, message


def test_small_talk_effects():
    bye = recommend_course("잘 가", 4)
    assert "벌써 가시게요" in bye["reply"] and len(bye["course"]) == 2
    assert recommend_course("안녕히 계세요", 3)["reply"].startswith("벌써 가시게요")  # '안녕'이지만 작별 인사
    angry = recommend_course("너 바보야", 3)
    assert "마음에 안 드셨나요" in angry["reply"] and "spot_bk_tower" in ids(angry)  # 기분 전환 코스
    solo = recommend_course("나 솔로야", 3)
    assert any(c["zone"] == "BK" for c in solo["course"])  # 데이트 구역
    assert recommend_course("예쁜 곳 추천해줘", 3)["reply"].startswith("처음이시라면")  # 루미 칭찬이 아님
    both = recommend_course("넌 누구야? 배고파", 3)
    assert "루미" in both["reply"] and "출출하시군요" in both["reply"]


def test_health_shows_external_key_status_but_never_values(monkeypatch):
    monkeypatch.setenv("TOUR_API_KEY", "tour-secret-value")
    monkeypatch.delenv("KAKAO_REST_API_KEY", raising=False)
    monkeypatch.delenv("KAKAO_API_KEY", raising=False)
    res = client.get("/health")
    assert res.json()["externalKeys"] == {"tourApi": True, "kakao": False}
    assert "tour-secret-value" not in res.text
