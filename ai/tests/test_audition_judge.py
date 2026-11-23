"""오디션 분석·심사 테스트 — 사인파로 만든 '가짜 노래'로 시간 보정·음정·삑사리·옥타브, LLM 답 검증 확인"""

import io
import json
import wave
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest

import app.audition_judge as judge
from app.audition_pitch import SR, check_melody, singing_start

MELODY = json.loads((Path(__file__).parents[2] / "frontend/public/audition/sungray-01.json").read_text(encoding="utf-8"))["notes"]


def sing(delay=0.0, shift=None, crack=None, octave=0, rate=SR):
    """멜로디를 사인파로 부른 wav. shift={음표 번호: 반음}, crack=삑사리 낼 음표 번호"""
    shift = shift or {}
    end = delay + MELODY[-1]["start"] + MELODY[-1]["duration"] + 0.5
    t = np.arange(int(end * rate)) / rate
    midi = np.full(len(t), np.nan)
    for i, n in enumerate(MELODY, 1):
        a, b = n["start"] + delay, n["start"] + n["duration"] + delay
        midi[(t >= a) & (t < b)] = n["midi"] + shift.get(i, 0) + 12 * octave
        if i == crack:
            mid = (a + b) / 2
            midi[(t >= mid - 0.075) & (t < mid + 0.075)] += 7  # 0.15초 동안 5도 위로 튐
    hz = np.where(np.isnan(midi), 0, 440 * 2 ** ((np.nan_to_num(midi) - 69) / 12))
    y = 0.5 * np.sin(2 * np.pi * np.cumsum(hz) / rate) * (hz > 0)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes((y * 32767).astype("<i2").tobytes())
    return buf.getvalue()


def statuses(result):
    return {n["index"]: n["status"] for n in result["notes"]}


def test_late_start_is_corrected_and_flat_note_found():
    result = judge.judge_take(sing(delay=0.4, shift={4: -1}, rate=48000), MELODY)
    assert result["offset"] == pytest.approx(0.4, abs=0.06)
    assert statuses(result)[4] == "flat"
    assert [i for i, s in statuses(result).items() if s != "ok"] == [4]
    assert result["score"] == round(100 * (len(MELODY) - 1) / len(MELODY)) and result["source"] == "rule"


def test_crack_is_found():
    result = judge.judge_take(sing(crack=7), MELODY)
    assert [i for i, s in statuses(result).items() if s != "ok"] == [7]
    assert statuses(result)[7] == "crack"


def test_octave_lower_counts_as_correct():
    assert judge.judge_take(sing(octave=-1), MELODY)["score"] == 100


def test_short_noise_is_not_start():
    voiced = np.zeros(100, bool)
    voiced[5:10] = True  # 0.1초 기침
    voiced[30:50] = True  # 0.4초 노래
    assert singing_start(voiced) == pytest.approx(30 * 0.02)  # 조건을 채운 시각이 아니라 구간 시작


def test_broken_melody_is_rejected():
    with pytest.raises(ValueError):
        check_melody([{"midi": 60, "start": 1.0, "duration": 0.5}, {"midi": 62, "start": 0.5, "duration": 0.5}])
    with pytest.raises(ValueError):
        check_melody([{"midi": 60.5, "start": 0, "duration": 0.5}])


RESULT = {"score": 92, "notes": [{"index": i} for i in range(1, 13)]}


def feedback(line="4번 음만 다듬으면 좋아요.", tips=None):
    return {"judges": [{"role": r, "line": line} for r in judge.ROLES], "tips": ["천천히 연습해요."] if tips is None else tips}


@pytest.mark.parametrize("feedback, ok", [
    (feedback(), True),
    (feedback("15번 음이 낮아요."), False),
    (feedback("15, 4번 음을 연습해요."), False),
    (feedback("100점이에요!"), False),
    (feedback("92.5점이에요!"), False),
    (feedback("92점이에요!"), True),
    (feedback(tips=[]), False),
    (feedback(""), False),
    (feedback("가" * 91), False),
    (feedback("좋아요. 다시 해요. 도전해요."), False),
    (feedback("Great 실력이에요."), False),
    (feedback("Perfect 판정이에요."), True),
    (feedback("Perfect!"), False),
    (feedback("92점이에요. 시작이 0.4초 늦었어요."), True),
    (feedback("로고를 써 봐요."), False),
    ({"judges": [{"role": "프로듀서", "line": "좋아요."}] * 3, "tips": ["연습해요."]}, False),
    ({"judges": [], "tips": ["연습해요."]}, False),
    # 한 역할 누락 + 다른 역할 중복 (개수는 3개로 맞음)
    ({"judges": [{"role": "프로듀서", "line": "좋아요."}, {"role": "프로듀서", "line": "좋아요."}, {"role": "안무가", "line": "좋아요."}], "tips": ["연습해요."]}, False),
    ({"judges": [None] * 3, "tips": ["연습해요."]}, False),
    (feedback(tips=[" "]), False),
    (feedback(tips=["가" * 101]), False),
    ([], False),
])
def test_find_problems(feedback, ok):
    assert (judge.find_problems(feedback, RESULT) == []) is ok


def test_bad_llm_answer_is_retried_once_then_rule(monkeypatch):
    calls = []

    def fake_llm(table, problems):
        calls.append(problems)
        return feedback("99번 음이 낮아요.")

    monkeypatch.setattr(judge, "ask_llm", fake_llm)
    result = judge.judge_take(sing(), MELODY)
    assert len(calls) == 2 and calls[0] == [] and calls[1]  # 두 번째엔 문제점을 같이 보냄
    assert result["source"] == "rule"


def test_good_llm_answer_is_used(monkeypatch):
    answer = feedback("음정이 정확해요.", ["지금처럼 불러 보세요."])
    monkeypatch.setattr(judge, "ask_llm", lambda table, problems: answer)
    result = judge.judge_take(sing(), MELODY)
    assert result["source"] == "llm" and result["feedback"] == answer


def test_llm_disabled_does_not_spend_quota(monkeypatch):
    monkeypatch.setattr(judge, "llm_enabled", lambda: False)
    monkeypatch.setattr(judge, "take_llm_call", lambda: pytest.fail("꺼진 LLM의 횟수 사용"))
    assert judge.ask_llm("결과표", []) is None


def test_llm_quota_blocks_client_creation(monkeypatch):
    monkeypatch.setattr(judge, "llm_enabled", lambda: True)
    monkeypatch.setattr(judge, "take_llm_call", lambda: False)
    monkeypatch.setattr(judge, "_get_client", lambda: pytest.fail("한도 소진 뒤 호출"))
    assert judge.ask_llm("결과표", []) is None


@pytest.mark.parametrize("kind", ["good", "invalid_json", "refusal", "length", "api_error"])
def test_llm_strict_schema_and_failure_fallback(monkeypatch, kind):
    monkeypatch.setattr(judge, "llm_enabled", lambda: True)
    monkeypatch.setattr(judge, "take_llm_call", lambda: True)
    answer = feedback()
    def create(**kwargs):
        assert kwargs["response_format"]["json_schema"]["strict"] is True
        assert kwargs["response_format"]["json_schema"]["schema"] == judge.SCHEMA
        assert "지난 답의 문제" in kwargs["messages"][1]["content"]
        if kind == "api_error":
            raise judge.openai.OpenAIError("offline")
        message = SimpleNamespace(content="{" if kind == "invalid_json" else json.dumps(answer), refusal="거절" if kind == "refusal" else None)
        return SimpleNamespace(choices=[SimpleNamespace(finish_reason="length" if kind == "length" else "stop", message=message)])
    monkeypatch.setattr(judge, "_get_client", lambda: SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create))))
    assert judge.ask_llm("결과표", ["대사 길이"]) == (answer if kind == "good" else None)
