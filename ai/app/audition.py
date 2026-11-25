"""썬그레이 오디션 녹음 업로드. 담당: 성근(SG)

POST /audition/upload  (multipart/form-data: songId, audio=wav 파일)
성공: {songId, duration, score, offset, notes, feedback, source} — 심사는 audition_judge.py (LangGraph)
검사 순서: 횟수 제한 → 크기·곡 id·형식 → 기준 멜로디 → 곡 기준 범위
"""

from __future__ import annotations

import io
import logging
import wave
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile  # request.form()이 주는 타입 (fastapi.UploadFile은 그 하위 클래스라 isinstance가 실패)

from .audition_judge import judge_keyboard, judge_take
from .audition_pitch import load_melody
from .limits import allow_request

log = logging.getLogger("scenewalk.audition")

router = APIRouter()

SONG_IDS = {"sungray-01"}  # 허용 목록. frontend/public/audition/<id>.json 과 맞춘다
# 22초 곡+6초 여유도 모노 48kHz 16비트는 28×48000×2+44=2,688,044바이트라 충분하다.
MAX_BYTES = 3 * 1024 * 1024
FORM_OVERHEAD = 16 * 1024  # multipart 경계 문자열·songId 몫
KEYBOARD_MAX_BYTES = 32 * 1024  # 키 입력 하나 약 40바이트 × 최대 수백 개
MIN_SECONDS = 1.0


class NoteResult(BaseModel):
    index: int  # 1부터
    target: int  # 기준 midi
    sung: float | None  # 부른 음 (옥타브 차이 포함 그대로), 안 들리면 None
    deviation: float | None  # 반음 차이 (옥타브 접음, -는 낮음)
    status: str  # ok | flat | sharp | crack(삑사리) | missed(안 들림)


class JudgeLine(BaseModel):
    role: Literal["프로듀서", "보컬 트레이너", "안무가"]
    line: str = Field(min_length=1, max_length=90)


class Feedback(BaseModel):
    judges: list[JudgeLine] = Field(min_length=3, max_length=3)
    tips: list[str] = Field(min_length=1, max_length=3)


class UploadResponse(BaseModel):
    songId: str
    mode: Literal["sing"]
    duration: float
    score: int  # 정확한 음 비율 0~100 (코드가 정함, LLM은 못 바꿈)
    offset: float | None  # 늦게(+) 또는 일찍(-) 시작한 초. 노래가 안 들리면 None
    notes: list[NoteResult]
    feedback: Feedback
    source: str  # llm | rule


class KeyPress(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    key: Literal["ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight"]
    t: float = Field(allow_inf_nan=False)


class KeyboardTake(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    songId: str
    presses: list[KeyPress]


KEYBOARD_SCHEMA = KeyboardTake.model_json_schema()
KEYBOARD_SCHEMA["properties"]["presses"]["items"] = KEYBOARD_SCHEMA.pop("$defs")["KeyPress"]


class KeyResult(BaseModel):
    index: int
    target: int
    key: str
    result: Literal["perfect", "good", "miss"]
    dt: float | None


class KeyboardResponse(BaseModel):
    songId: str
    mode: Literal["keyboard"]
    score: int
    notes: list[KeyResult]
    feedback: Feedback
    source: str


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
    try:
        melody = await run_in_threadpool(load_melody, song_id)
    except Exception as e:  # 프론트(Vercel) 다운·주소 오류·멜로디 파일 깨짐 → 사용자 잘못이 아님
        log.warning("기준 멜로디 %s 불러오기 실패: %r", song_id, e)
        raise HTTPException(status_code=503, detail="심사 준비 중이에요. 잠시 후 다시 도전해 주세요.")
    max_seconds = melody[-1]["start"] + melody[-1]["duration"] + 6
    if not MIN_SECONDS <= seconds <= max_seconds:
        raise HTTPException(status_code=400, detail=f"녹음 길이는 {MIN_SECONDS:g}~{max_seconds:g}초여야 해요.")
    # librosa 분석은 CPU를 쓰는 동기 코드 → 스레드에서 돌려야 그동안 다른 요청이 멈추지 않음
    judged = await run_in_threadpool(judge_take, data, list(melody))
    return {"songId": song_id, "duration": round(seconds, 2), **judged}


@router.post(
    "/audition/keyboard", response_model=KeyboardResponse,
    openapi_extra={"requestBody": {"required": True, "content": {"application/json": {"schema": KEYBOARD_SCHEMA}}}},
)
async def keyboard(request: Request) -> dict:
    from .main import client_ip

    if not allow_request(client_ip(request)):
        raise HTTPException(status_code=429, detail="요청이 너무 많아요. 잠시 후 다시 도전해 주세요.")
    # JSON을 읽기 전에 크기부터 막음 (음표 수십 개 × 입력 4개 ≈ 수 KB, 큰 본문은 파싱 비용만 듦)
    length = request.headers.get("content-length")
    if not length or not length.isdigit():
        raise HTTPException(status_code=411, detail="요청 크기를 알 수 없어요.")
    if int(length) > KEYBOARD_MAX_BYTES:
        raise HTTPException(status_code=413, detail="키 입력 기록이 너무 커요.")
    try:
        take = KeyboardTake.model_validate(await request.json())
    except (ValidationError, ValueError):
        # 검증 오류에 담긴 NaN도 응답 JSON에 다시 실리지 않게 한다.
        raise HTTPException(status_code=422, detail="곡과 키 입력 형식을 확인해 주세요.")
    if take.songId not in SONG_IDS:
        raise HTTPException(status_code=400, detail="없는 곡이에요.")
    try:
        melody = await run_in_threadpool(load_melody, take.songId)
    except Exception as e:
        log.warning("기준 멜로디 %s 불러오기 실패: %r", take.songId, e)
        raise HTTPException(status_code=503, detail="심사 준비 중이에요. 잠시 후 다시 도전해 주세요.")
    end = melody[-1]["start"] + melody[-1]["duration"]
    if len(take.presses) > len(melody) * 4:
        raise HTTPException(status_code=422, detail="키 입력이 너무 많아요.")
    if any(not -3 <= p.t <= end + 3 for p in take.presses):
        raise HTTPException(status_code=422, detail="키 입력 시간이 곡 범위를 벗어났어요.")
    judged = await run_in_threadpool(judge_keyboard, [p.model_dump() for p in take.presses], list(melody))
    return {"songId": take.songId, **judged}
