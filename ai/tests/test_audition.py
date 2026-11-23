"""오디션 녹음 업로드 테스트 — 메모리에서 만든 wav로 검사 순서별 상태 코드 확인"""

import io
import json
import wave
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.audition as audition
from app.main import app

client = TestClient(app)
MELODY = json.loads((Path(__file__).parents[2] / "frontend/public/audition/sungray-01.json").read_text(encoding="utf-8"))["notes"]


@pytest.fixture(autouse=True)
def local_melody(monkeypatch):
    """프론트 서버 없이 저장소의 멜로디 파일을 씀"""
    monkeypatch.setattr(audition, "load_melody", lambda song_id: tuple(MELODY))


def make_wav(seconds, rate=48000, channels=1):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\0\0" * channels * int(rate * seconds))
    return buf.getvalue()


def post(song_id="sungray-01", data=None):
    return client.post("/audition/upload", data={"songId": song_id}, files={"audio": ("take.wav", data or make_wav(9), "audio/wav")})


def test_valid_wav_returns_song_and_duration():
    res = post(data=make_wav(9, rate=44100, channels=2))
    assert res.status_code == 200
    body = res.json()
    assert body["songId"] == "sungray-01" and body["duration"] == 9.0
    # 무음 → 모든 음 안 들림, 점수 0, LLM은 테스트에서 꺼져 있어 규칙 문장
    assert body["score"] == 0 and body["offset"] is None and body["source"] == "rule"
    assert {n["status"] for n in body["notes"]} == {"missed"} and len(body["feedback"]["judges"]) == 3
    assert body["mode"] == "sing"


def test_melody_unavailable_is_503(monkeypatch):
    def down(song_id):
        raise OSError("connection refused")

    monkeypatch.setattr(audition, "load_melody", down)
    assert post().status_code == 503


def test_unknown_song_id_is_400():
    assert post(song_id="../../admin").status_code == 400


def test_not_wav_is_400():
    assert post(data=b"\x89PNG not a wav at all").status_code == 400


def test_too_short_or_too_long_is_400():
    assert post(data=make_wav(0.5)).status_code == 400
    end = MELODY[-1]["start"] + MELODY[-1]["duration"]
    assert post(data=make_wav(end + 6.01, rate=8000)).status_code == 400


def test_long_song_recording_fits_byte_and_time_limits(monkeypatch):
    end = MELODY[-1]["start"] + MELODY[-1]["duration"]
    wav = make_wav(end + 6)
    assert len(wav) < audition.MAX_BYTES
    monkeypatch.setattr(audition, "judge_take", lambda *_: {
        "mode": "sing", "score": 0, "offset": None, "notes": [], "source": "rule",
        "feedback": {"judges": [{"role": r, "line": "연습해 봐요."} for r in ["프로듀서", "보컬 트레이너", "안무가"]], "tips": ["다시 불러 봐요."]},
    })
    assert post(data=wav).status_code == 200
    assert post(data=make_wav(end + 2.5)).status_code == 200


def test_over_3mb_is_413_before_reading_form():
    assert post(data=make_wav(17, rate=48000, channels=2)).status_code == 413  # 약 3.26MB > 3MiB


def test_missing_audio_is_400():
    assert client.post("/audition/upload", data={"songId": "sungray-01"}).status_code == 400


def test_rate_limit_is_429():
    codes = [post().status_code for _ in range(6)]
    assert codes[:5] == [200] * 5 and codes[5] == 429
