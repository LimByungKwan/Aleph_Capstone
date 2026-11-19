import os

# 테스트는 실제 LLM API를 부르지 않음 (비용·키 없이 항상 같은 결과)
os.environ["SCENEWALK_DISABLE_LLM"] = "1"

import pytest


@pytest.fixture(autouse=True)
def _fresh_limits():
    """테스트마다 요청 횟수 기록을 비움 (테스트끼리 횟수 제한에 걸리지 않게)"""
    from app import limits

    limits.reset()
    yield
    limits.reset()
