"""썬그레이 오디션 음정 분석 (librosa). 담당: 성근(SG)

녹음 wav + 기준 멜로디(음표 단위: midi, start초, duration초) → 음표별 판정
- 시간 보정: voiced(음 높이가 있는 소리)가 0.3초 이상 이어진 첫 구간을 노래 시작으로 보고, 첫 음표 시각과의 차이만큼 밀어서 비교
- 쉬는 구간(음표 사이 공백)은 채점하지 않음
- 옥타브 차이는 무시 (남성이 한 옥타브 아래로 불러도 같은 음으로 봄)
"""

from __future__ import annotations

import io
import json
import math
import os
import urllib.request
import wave
from functools import lru_cache
from pathlib import Path

import librosa
import numpy as np

SR = 16000
HOP = 320  # 20ms 프레임
FRAME_SEC = HOP / SR
START_RUN_SEC = 0.3  # 가장 짧은 음표(0.5초)보다 짧고, 기침·숨소리(0.1~0.2초)보다 긺
EDGE_SEC = 0.05  # 음이 바뀌는 앞뒤 경계는 흔들리므로 빼고 봄
OK_SEMITONES = 0.5  # 이 안이면 정확
CRACK_SEMITONES = 2.0  # 음 안에서 이만큼 튀면
CRACK_SEC = 0.06  # 이 시간 이상 이어질 때 삑사리
MIN_VOICED_RATIO = 0.5  # 음표 구간의 절반 이상 소리가 있어야 부른 것으로 봄


# 기준 멜로디 원본은 프론트 public/audition/ 하나뿐. 서버는 저장소의 그 파일을 디스크에서 바로 읽음
# (Render도 저장소 전체를 받아 두므로 places.py가 shared/places.json을 읽는 것과 같은 방식)
# 11/26: Vercel 주소로 받아 오던 방식이 배포 서버에서 503 → 네트워크·환경변수 없이 읽게 바꿈
MELODY_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "audition"


def _melody_base_url() -> str:
    # 저장소 파일이 없을 때(ai/ 폴더만 따로 배포 등)만 쓰는 예비 경로
    return os.environ.get("AUDITION_MELODY_URL", "http://localhost:5173/audition").rstrip("/")


def check_melody(notes: list) -> list[dict]:
    """정렬·겹침 없음·정수 midi·duration>0 이 아니면 ValueError"""
    if not isinstance(notes, list) or not notes:
        raise ValueError("음표가 없음")
    prev_end = 0.0
    for n in notes:
        midi, start, duration = n.get("midi"), n.get("start"), n.get("duration")
        if not (type(midi) is int and 0 <= midi <= 127):
            raise ValueError(f"midi 오류: {n}")
        if not (type(start) in (int, float) and type(duration) in (int, float) and math.isfinite(start) and math.isfinite(duration) and duration > 0):
            raise ValueError(f"시간 오류: {n}")
        if start < prev_end:
            raise ValueError(f"순서가 뒤섞이거나 겹침: {n}")
        prev_end = start + duration
    return notes


@lru_cache(maxsize=16)  # 곡을 고치면 서버를 다시 켜야 반영됨 (실패는 캐시되지 않음)
def load_melody(song_id: str) -> tuple:
    # song_id는 호출 전에 허용 목록으로 검사됨 → 임의 경로·주소로 가지 않음
    local = MELODY_DIR / f"{song_id}.json"
    if local.is_file():
        data = json.loads(local.read_text(encoding="utf-8"))
    else:
        with urllib.request.urlopen(f"{_melody_base_url()}/{song_id}.json", timeout=5) as res:
            data = json.load(res)
    return tuple(check_melody(data.get("notes")))


def _runs(mask: np.ndarray) -> list[tuple[int, int]]:
    """True가 이어진 구간들 [(시작, 끝)) 프레임 번호"""
    edges = np.diff(np.concatenate(([0], mask.astype(int), [0])))
    return list(zip(np.flatnonzero(edges == 1), np.flatnonzero(edges == -1)))


def singing_start(voiced: np.ndarray) -> float | None:
    """voiced가 0.3초 이상 이어진 첫 구간의 '시작' 시각 (조건을 채운 시각이 아님)"""
    need = int(np.ceil(START_RUN_SEC / FRAME_SEC))
    for a, b in _runs(voiced):
        if b - a >= need:
            return a * FRAME_SEC
    return None


def judge_notes(midi: np.ndarray, voiced: np.ndarray, notes: list[dict]) -> dict:
    """프레임별 음 높이(midi, 소리 없으면 nan) → 음표별 판정. librosa 없이 시험할 수 있게 분리"""
    times = np.arange(len(midi)) * FRAME_SEC
    start = singing_start(voiced)
    offset = None if start is None else start - notes[0]["start"]
    results = []
    voiced_frames = expected_frames = 0
    for i, n in enumerate(notes, 1):
        row = {"index": i, "target": n["midi"], "sung": None, "deviation": None, "status": "missed"}
        results.append(row)
        if offset is None:
            continue
        window = (times >= n["start"] + offset + EDGE_SEC) & (times < n["start"] + n["duration"] + offset - EDGE_SEC)
        sung = midi[window & voiced]
        voiced_frames += len(sung)
        expected_frames += max(0, math.ceil((n["start"] + n["duration"] + offset - EDGE_SEC) / FRAME_SEC) - math.ceil((n["start"] + offset + EDGE_SEC) / FRAME_SEC))
        if not window.any() or len(sung) < MIN_VOICED_RATIO * window.sum():
            continue
        center = float(np.median(sung))
        deviation = center - n["midi"]
        deviation -= 12 * round(deviation / 12)  # 옥타브 접기
        jumps = np.nan_to_num(np.abs(midi[window] - center)) > CRACK_SEMITONES
        crack = any(b - a >= CRACK_SEC / FRAME_SEC for a, b in _runs(jumps))
        status = "crack" if crack else "ok" if abs(deviation) <= OK_SEMITONES else "flat" if deviation < 0 else "sharp"
        row.update(sung=round(center, 2), deviation=round(deviation, 2), status=status)
    ok = sum(r["status"] == "ok" for r in results)
    return {"score": round(100 * ok / len(notes)), "offset": None if offset is None else round(offset, 2), "notes": results,
            "stats": {"voiced_ratio": round(100 * voiced_frames / expected_frames, 1) if expected_frames else 0}}


def warm_up() -> None:
    """서버가 켜질 때 한 번: 진짜 채점과 같은 경로(wav 읽기 → pyin)를 1초짜리 소리로 미리 돌림
    pyin은 처음 부를 때 JIT 컴파일을 해서, 안 하면 첫 사용자가 그 시간을 기다림
    (11/26 실측: 로컬 8.7초, Render 무료 서버 85초 — 프론트 대기 한도 90초에 거의 닿음)"""
    t = np.arange(SR) / SR
    pcm = (0.3 * np.sin(2 * np.pi * 220 * t) * 32767).astype("<i2").tobytes()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)
    analyze(buf.getvalue(), [{"midi": 57, "start": 0.0, "duration": 0.8}])


def analyze(wav: bytes, notes: list[dict]) -> dict:
    y, _ = librosa.load(io.BytesIO(wav), sr=SR, mono=True)
    f0, voiced, _ = librosa.pyin(y, sr=SR, fmin=65, fmax=1050, hop_length=HOP)  # 남녀 음역 C2~C6
    return judge_notes(librosa.hz_to_midi(f0), voiced, notes)
