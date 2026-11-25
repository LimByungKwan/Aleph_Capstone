"""외부 API 키 받아 두기 (확장 계획용 — 지금은 키를 읽기만 하고 어디에도 호출하지 않음).

- 한국관광공사 국문 관광정보 서비스(TourAPI): TOUR_API_KEY (공공데이터포털 Decoding 키)
- 카카오 맵 REST API: KAKAO_REST_API_KEY

왜 지금 안 부르나 (기획서 규칙): 작품·가게는 모두 가상, 실제 위치 인증은 만들지 않음.
나중에 "실제 성지 연결" 단계에서 이 파일의 키로 서버에서만 호출한다 (키가 브라우저로 나가지 않게).
키 값은 절대 로그·응답에 넣지 않는다. /health에는 "있음/없음"만 보여 준다.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

_HERE = os.path.dirname(__file__)
for _env in (os.path.join(_HERE, "..", ".env"), os.path.join(_HERE, "..", "..", ".env")):
    load_dotenv(_env)


def _read(*names: str) -> str | None:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return None


def tour_api_key() -> str | None:
    """한국관광공사 TourAPI 키 (없으면 None)"""
    return _read("TOUR_API_KEY")


def kakao_rest_key() -> str | None:
    """카카오 REST API 키 (없으면 None)"""
    return _read("KAKAO_REST_API_KEY", "KAKAO_API_KEY")


def key_status() -> dict:
    """키가 들어 있는지만 (값은 절대 안 보여 줌)"""
    return {"tourApi": bool(tour_api_key()), "kakao": bool(kakao_rest_key())}
