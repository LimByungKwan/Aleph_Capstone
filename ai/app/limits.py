"""비용 안전장치 (배포했을 때 OpenAI 요금이 늘지 않게).

1) 사람(IP)마다 요청 횟수 제한 → 넘으면 429 (루미가 "잠시 후 다시" 안내)
2) 하루 LLM 호출 수 제한 → 넘으면 그날은 키워드 규칙으로만 추천 (요금 0원, 서버는 계속 응답)
   기본값 0 = OpenAI를 아예 부르지 않음 (요금 0원). 쓰고 싶을 때만 LLM_DAILY_LIMIT을 1 이상으로 직접 켬

숫자는 환경변수로 바꿀 수 있음:
  RATE_PER_MINUTE   한 사람이 1분에 보낼 수 있는 추천 요청 (기본 5)
  RATE_PER_DAY      한 사람이 하루에 보낼 수 있는 추천 요청 (기본 40)
  LLM_DAILY_LIMIT   서버 전체가 하루에 OpenAI를 부를 수 있는 횟수 (기본 0 = LLM 안 씀, 요금 0원)

기록은 서버 메모리에만 둠 (서버가 다시 켜지면 0부터). 무료 서버 1대라 이걸로 충분.
"""

from __future__ import annotations

import os
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
_lock = threading.Lock()


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def _today() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


# ── 1. 사람(IP)마다 ──────────────────────────────
_recent: dict[str, deque] = defaultdict(deque)  # ip → 최근 1분 요청 시각
_daily: dict[str, int] = defaultdict(int)  # (날짜, ip) → 오늘 요청 수
_daily_day = _today()


def allow_request(ip: str) -> bool:
    """이번 요청을 받아도 되면 True (받으면 횟수에 셈)"""
    global _daily_day
    now = time.monotonic()
    with _lock:
        today = _today()
        if today != _daily_day:  # 날이 바뀌면 하루 기록 초기화
            _daily.clear()
            _daily_day = today
        window = _recent[ip]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= _env_int("RATE_PER_MINUTE", 5) or _daily[ip] >= _env_int("RATE_PER_DAY", 40):
            return False
        window.append(now)
        _daily[ip] += 1
        return True


# ── 2. 하루 LLM 호출 수 ───────────────────────────
_llm_day = _today()
_llm_used = 0


def llm_daily_limit() -> int:
    return max(0, _env_int("LLM_DAILY_LIMIT", 0))


def take_llm_call() -> bool:
    """오늘 LLM을 한 번 더 불러도 되면 True (부르면 횟수에 셈)"""
    global _llm_day, _llm_used
    with _lock:
        today = _today()
        if today != _llm_day:
            _llm_day, _llm_used = today, 0
        if _llm_used >= llm_daily_limit():
            return False
        _llm_used += 1
        return True


def llm_calls_today() -> int:
    with _lock:
        return _llm_used if _llm_day == _today() else 0


def reset() -> None:
    """테스트용: 기록 지우기"""
    global _llm_used
    with _lock:
        _recent.clear()
        _daily.clear()
        _llm_used = 0
