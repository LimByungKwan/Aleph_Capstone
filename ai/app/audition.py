"""썬그레이 오디션 녹음 업로드. 담당: 성근(SG)

POST /audition/upload  (multipart/form-data: songId, audio=wav 파일)
성공: {songId, duration, score, offset, notes, feedback, source} — 심사는 audition_judge.py (LangGraph)
검사 순서는 싼 것부터: 횟수 제한 429 → 크기 413 → 곡 id 400 → wav 형식 400 → 길이 400 → 기준 멜로디 503
"""

from __future__ import annotations

import io
import logging
import wave

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile  # request.form()이 주는 타입 (fastapi.UploadFile은 그 하위 클래스라 isinstance가 실패)

from .audition_judge import judge_take
from .audition_pitch import load_melody
from .limits import allow_request

log = logging.getLogger("scenewalk.audition")

router = APIRouter()

SONG_IDS = {"sungray-01"}  # 허용 목록. frontend/public/audition/<id>.json 과 맞춘다
MAX_BYTES = 3 * 1024 * 1024  # 48kHz 스테레오 16비트 기준 약 16초
FORM_OVERHEAD = 16 * 1024  # multipart 경계 문자열·songId 몫
MIN_SECONDS = 1.0
MAX_SECONDS = 16.0  # shortcut: 곡 9초 + 여유로 고정, 곡이 길어지면 곡 길이 기준으로 계산


class NoteResult(BaseModel):
    index: int  # 1부터
    target: int  # 기준 midi
    sung: float | None  # 부른 음 (옥타브 차이 포함 그대로), 안 들리면 None
    deviation: float | None  # 반음 차이 (옥타브 접음, -는 낮음)
    status: str  # ok | flat | sharp | crack(삑사리) | missed(안 들림)


class Feedback(BaseModel):
    comment: str
    tips: list[str]


class UploadResponse(BaseModel):
    songId: str
    duration: float
    score: int  # 정확한 음 비율 0~100 (코드가 정함, LLM은 못 바꿈)
    offset: float | None  # 늦게(+) 또는 일찍(-) 시작한 초. 노래가 안 들리면 None
    notes: list[NoteResult]
    feedback: Feedback
    source: str  # llm | rule


def wav_seconds(data: bytes) -> float:
    """wav 헤더만 읽어 길이(초). wav가 아니거나 깨졌으면 400"""
    try:
        with wave.open(io.BytesIO(data)) as w:
            frames, rate = w.getnframes(), w.getframerate()
    except (wave.Error, EOFError):
        raise HTTPException(status_code=400, detail="wav 파일만 올릴 수 있어요.")
    if rate <= 0:
        raise HTTPException(status_code=400, detail="wav 파일만 올릴 수 있어요.")
    return frames / rate


@router.post("/audition/upload", response_model=UploadResponse)
async def upload(request: Request) -> dict:
    from .main import client_ip  # main이 이 파일을 불러오므로 순환 import를 피해 여기서 불러옴

    if not allow_request(client_ip(request)):
        raise HTTPException(status_code=429, detail="요청이 너무 많아요. 잠시 후 다시 도전해 주세요.")

    # 폼을 읽기 전에 막아야 큰 파일이 서버 디스크·메모리에 올라오지 않음 (파일 파라미터를 쓰면 검사 전에 다 받음)
    length = request.headers.get("content-length")
    if not length or not length.isdigit():
        raise HTTPException(status_code=411, detail="요청 크기를 알 수 없어요.")
    if int(length) > MAX_BYTES + FORM_OVERHEAD:
        raise HTTPException(status_code=413, detail="녹음 파일이 너무 커요.")

    async with request.form() as form:
        song_id, audio = form.get("songId"), form.get("audio")
        if song_id not in SONG_IDS:
            raise HTTPException(status_code=400, detail="없는 곡이에요.")
        if not isinstance(audio, UploadFile):
            raise HTTPException(status_code=400, detail="녹음 파일이 없어요.")
        data = await audio.read(MAX_BYTES + 1)

    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="녹음 파일이 너무 커요.")
    seconds = wav_seconds(data)
    if not MIN_SECONDS <= seconds <= MAX_SECONDS:
        raise HTTPException(status_code=400, detail=f"녹음 길이는 {MIN_SECONDS:g}~{MAX_SECONDS:g}초여야 해요.")

    try:
        melody = await run_in_threadpool(load_melody, song_id)
    except Exception as e:  # 프론트(Vercel) 다운·주소 오류·멜로디 파일 깨짐 → 사용자 잘못이 아님
        log.warning("기준 멜로디 %s 불러오기 실패: %r", song_id, e)
        raise HTTPException(status_code=503, detail="심사 준비 중이에요. 잠시 후 다시 도전해 주세요.")
    # librosa 분석은 CPU를 쓰는 동기 코드 → 스레드에서 돌려야 그동안 다른 요청이 멈추지 않음
    judged = await run_in_threadpool(judge_take, data, list(melody))
    return {"songId": song_id, "duration": round(seconds, 2), **judged}
