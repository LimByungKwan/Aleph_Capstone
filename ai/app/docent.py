"""[3. 개발 > AI] 장소 ID로 공식 자료 요약을 찾아 도슨트 해설을 생성한다."""
from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from pathlib import Path
from threading import Lock

import openai

from .limits import take_llm_call
from .llm_pick import DEFAULT_MODEL, _get_client, llm_enabled

log = logging.getLogger("scenewalk.docent")

# 프런트 관람 카드와 AI 서버가 같은 자료집에서 장소를 조회합니다.
DATASET_PATH = Path(__file__).resolve().parents[2] / "frontend" / "src" / "data" / "specialLocations.json"


@lru_cache(maxsize=1)
def load_docent_spots() -> dict[str, dict]:
    with DATASET_PATH.open(encoding="utf-8-sig") as file:
        dataset = json.load(file)
    return {spot["id"]: spot for spot in dataset["spots"]}


PERSONAS = ("drama", "history", "en")
SCHEMA = {
    "type": "object",
    "properties": {persona: {"type": "string"} for persona in PERSONAS},
    "required": list(PERSONAS),
    "additionalProperties": False,
}
SYSTEM = (
    "SceneWalk 가상 전시의 도슨트입니다. 제공된 자료 요약에 있는 사실만 사용하세요. "
    "실제 역사, 방문지, 게임 연출을 구분하고 근거가 없는 작품 촬영이나 현재 예약 가능 여부를 단정하지 마세요. "
    "관점마다 두 문장 이내로 작성하세요. drama는 한국어로 장면과 공간에 주목하고, history는 한국어로 자료의 "
    "역사적 배경이나 구조를 설명하며, en은 해외 관광객이 이해할 수 있는 쉬운 영어로 설명하세요. "
    "배우 이름, 대사 인용, URL은 작성하지 마세요."
)
_cache: dict[str, dict[str, str]] = {}
_in_progress: set[str] = set()
_lock = Lock()


def narrate(spot: dict) -> dict[str, str] | None:
    """생성된 세 관점을 함께 반환한다. 생성이 어려우면 프런트의 출처 기반 해설을 사용한다."""
    location_id = spot["id"]
    with _lock:
        if location_id in _cache:
            return _cache[location_id]
        if location_id in _in_progress or not llm_enabled() or not take_llm_call():
            return None
        _in_progress.add(location_id)

    try:
        evidence = {key: spot[key] for key in ("title", "sources", "grounding_facts")}
        response = _get_client().with_options(timeout=9, max_retries=0).chat.completions.create(
            model=os.environ.get("LLM_MODEL", DEFAULT_MODEL),
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": json.dumps(evidence, ensure_ascii=False)},
            ],
            response_format={"type": "json_schema", "json_schema": {"name": "docent", "strict": True, "schema": SCHEMA}},
            max_completion_tokens=550,
        )
        choice = next(iter(response.choices), None)
        if not choice or choice.finish_reason != "stop" or choice.message.refusal:
            return None
        result = json.loads(choice.message.content or "null")
        if not isinstance(result, dict) or any(
            not isinstance(result.get(persona), str) or not 1 <= len(result[persona].strip()) <= 650
            for persona in PERSONAS
        ):
            return None
        narration = {persona: result[persona].strip() for persona in PERSONAS}
        with _lock:
            _cache[location_id] = narration
        return narration
    except (openai.APIError, ValueError):
        log.info("도슨트 생성 실패 · %s", location_id)
        return None
    finally:
        with _lock:
            _in_progress.discard(location_id)
