"""홍보문구 테스트 (ai/ 폴더에서: python -m pytest)"""

from fastapi.testclient import TestClient

from app.main import app
from app.promo import TARGETS, TONES, check_rules, generate_promo

client = TestClient(app)
SHOP = dict(shop_name="소란 커피", work_title="드라마 「여름이 머무는 정류장」", offer="아메리카노 10% 할인", menu="흑당 라떼")


def test_three_captions_with_shop_info_for_every_tone_and_target():
    for tone in TONES:
        for target in TARGETS:
            result = generate_promo(**SHOP, target=target, tone=tone, seed=1)
            assert len(result["captions"]) == 3
            assert len(set(result["captions"])) == 3  # 세 안이 서로 다름
            assert all("소란 커피" in c for c in result["captions"])
            assert any("아메리카노 10% 할인" in c for c in result["captions"])
            assert result["tag"] == TONES[tone]["tag"]
            assert result["warnings"] == []
            assert result["reels"] is None


def test_hashtags_and_reels():
    result = generate_promo(**SHOP, target="couple", include_reels=True, seed=2)
    tags = result["hashtags"]
    assert "#소란커피" in tags and "#여름이머무는정류장" in tags and "#데이트코스" in tags and "#스탬프쿠폰" in tags
    assert len(tags) == len(set(tags))
    assert result["reels"].count("\n") == 3 and "흑당 라떼" in result["reels"]


def test_different_seed_gives_different_copy():
    a = generate_promo(**SHOP, seed=1)["captions"]
    b = generate_promo(**SHOP, seed=5)["captions"]
    assert a != b


def test_rules_catch_actor_quote_logo():
    assert check_rules("배우 김철수 방문") and check_rules("방송사 로고 포함") and check_rules("“너를 처음 만난 그날을 기억해”")
    assert check_rules("소란 커피, 「여름이 머무는 정류장」 촬영지") == []  # 작품명 「」은 통과
    assert generate_promo(shop_name="배우 김철수 카페")["warnings"]


def test_promo_api():
    res = client.post("/promo", json={"shopName": "소란 커피", "offer": "10% 할인", "tone": "bright", "target": "worker", "includeReels": True})
    assert res.status_code == 200
    body = res.json()
    assert len(body["captions"]) == 3 and body["reels"] and body["source"] == "template"
    assert client.post("/promo", json={"shopName": ""}).status_code == 422
    assert client.post("/promo", json={"shopName": "   "}).status_code == 422
