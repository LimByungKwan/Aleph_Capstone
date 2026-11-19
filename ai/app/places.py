"""맵 안의 장소 목록 (shared/places.json) 읽기.

코스 추천은 반드시 이 목록 안의 장소만 고른다 → 없는 장소를 지어내지 않게.
프론트와 같은 파일을 읽으므로 장소를 추가하면 서버도 자동으로 알게 된다.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

# 기본 위치: 저장소 루트의 shared/places.json (ai/app/ 에서 두 칸 위)
DEFAULT_PLACES_PATH = Path(__file__).resolve().parents[2] / "shared" / "places.json"

ZONE_NAMES = {
    "HUB": "중앙 광장",
    "JM": "애니메이션 구역",
    "BK": "데이트 코스 구역",
    "HJ": "영화·드라마 구역",
    "SG": "K-POP 구역",
}

# 게임 시작 지점 (중앙 광장, x·z) — 코스 순서를 정할 때 출발점
START_XZ = (0.0, 14.0)


@lru_cache(maxsize=1)
def load_places() -> tuple[dict, ...]:
    """전체 장소 (NPC 포함). 파일은 한 번만 읽어서 재사용."""
    path = Path(os.environ.get("PLACES_PATH", DEFAULT_PLACES_PATH))
    with path.open(encoding="utf-8") as f:
        places = json.load(f)
    return tuple(places)


def course_candidates() -> list[dict]:
    """코스에 넣을 수 있는 장소 (안내 NPC는 제외)."""
    return [p for p in load_places() if p.get("type") != "npc"]


def place_by_id() -> dict[str, dict]:
    return {p["id"]: p for p in load_places()}
