"""SceneWalk AI 서버 (FastAPI).

실행 (ai/ 폴더에서):  uvicorn app.main:app --reload --port 8000
확인:  http://localhost:8000/health ,  문서: http://localhost:8000/docs
"""

from __future__ import annotations

import json
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .audition import router as audition_router
from .course import DEFAULT_COUNT, MAX_COUNT, MIN_COUNT, recommend_course
from .daily import daily_course
from .docent import load_docent_spots, narrate
from .external import key_status
from .limits import allow_request, llm_calls_today
from .places import course_candidates
from .promo import TARGETS, TONES, generate_promo
from .tarot import TarotInputError, read_tarot

app = FastAPI(title="SceneWalk AI", version="0.1.0")
app.include_router(audition_router)  # SG 오디션 업로드 (audition.py)

# 프론트(Vercel·로컬 개발 서버)에서 부를 수 있게. 배포 때 ALLOWED_ORIGINS로 주소를 바꿀 수 있음
origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,https://aleph-capstone.vercel.app").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["*"])


class CourseRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=300, description="순례객이 말한 취향 (예: '애니 좋아하고 카페도 가고 싶어')")
    count: int = Field(DEFAULT_COUNT, ge=MIN_COUNT, le=MAX_COUNT, description="코스에 넣을 장소 수")


class CourseStop(BaseModel):
    placeId: str
    name: str
    zone: str
    zoneName: str
    type: str
    position: list[float]
    reason: str


class CourseResponse(BaseModel):
    reply: str
    course: list[CourseStop]
    nextPlaceId: str | None
    themes: list[str]
    source: str
    flagged: str | None = None  # 부적절한 말이었으면 종류 (safety.py) — 이때 course는 비어 있을 수 있음


class DailyResponse(CourseResponse):
    date: str  # 한국 날짜 YYYY-MM-DD
    title: str
    emoji: str


class PromoRequest(BaseModel):
    shopName: str = Field(..., min_length=1, max_length=40, description="가게 이름")
    workTitle: str = Field("", max_length=60, description="연결된 가상 작품 (예: 드라마 「여름이 머무는 정류장」)")
    offer: str = Field("", max_length=40, description="스탬프 쿠폰 혜택 (예: 아메리카노 10% 할인)")
    menu: str = Field("", max_length=40, description="대표 메뉴")
    target: str = Field("traveler", description="초대할 손님: " + " | ".join(TARGETS))
    tone: str = Field("warm", description="분위기: " + " | ".join(TONES))
    includeReels: bool = Field(False, description="15초 릴스 대본도 만들기")


class PromoResponse(BaseModel):
    captions: list[str]
    hashtags: list[str]
    reels: str | None
    tag: str
    warnings: list[str]
    source: str


@app.get("/health")
def health() -> dict:
    # externalKeys: 외부 API 키가 들어 있는지만 (값은 안 보여 줌, 아직 호출하는 곳 없음 — external.py)
    return {"ok": True, "places": len(course_candidates()), "llmCallsToday": llm_calls_today(), "externalKeys": key_status()}


def client_ip(request: Request) -> str:
    # Render 같은 배포 서버는 앞단 프록시를 거쳐서, 진짜 주소는 X-Forwarded-For 첫 번째 값
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.post("/course", response_model=CourseResponse)
def course(req: CourseRequest, request: Request) -> dict:
    if not allow_request(client_ip(request)):
        raise HTTPException(status_code=429, detail="요청이 너무 많아요. 잠시 후 다시 말을 걸어 주세요.")
    return recommend_course(req.message, req.count)


@app.get("/daily", response_model=DailyResponse)
def daily() -> dict:
    """오늘의 코스 (한국 날짜 기준, 같은 날엔 누구에게나 같은 코스, 요금 0원)"""
    return daily_course()


@app.get("/docent/{location_id}")
def docent(location_id: str, request: Request) -> dict:
    try:
        spot = load_docent_spots().get(location_id)
    except (OSError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=503, detail="도슨트 자료집을 읽을 수 없어요.") from error
    if spot is None:
        raise HTTPException(status_code=404, detail="등록된 관람 장소가 아니에요.")
    if not allow_request(f"docent:{client_ip(request)}"):
        raise HTTPException(status_code=429, detail="잠시 후 다시 시도해 주세요.")
    return {"narration": narrate(spot)}


@app.post("/promo", response_model=PromoResponse)
def promo(req: PromoRequest, request: Request) -> dict:
    """사장님 홍보문구 (템플릿 방식, 요금 0원)"""
    if not allow_request(client_ip(request)):
        raise HTTPException(status_code=429, detail="요청이 너무 많아요. 잠시 후 다시 만들어 주세요.")
    if not req.shopName.strip():
        raise HTTPException(status_code=422, detail="가게 이름을 입력해 주세요.")
    return generate_promo(req.shopName, req.workTitle, req.offer, req.menu, req.target, req.tone, req.includeReels)


class TarotPerson(BaseModel):
    name: str = Field("", max_length=20, description="별명 (8글자까지 쓰고, 부적절하면 A·B로 바뀜)")
    self: list[int] = Field(..., max_length=20, description="'나는?' 보기 번호 (질문 순서대로, 0부터)")
    guess: list[int] = Field(..., max_length=20, description="'상대는?' 보기 번호")


class TarotRequest(BaseModel):
    a: TarotPerson
    b: TarotPerson
    seed: str | None = Field(None, max_length=64, description="같은 값이면 같은 카드 (다시 보기)")


@app.post("/tarot")
def tarot(req: TarotRequest, request: Request) -> dict:
    """커플 타로 (LangGraph: analyze_a ∥ analyze_b → compare → draw → retrieve(RAG) → interpret, 요금 0원)

    두 사람 답은 이 요청 안에서만 쓰고 저장하지 않음. 결과 저장은 화면에서 지민 님 saveTarotReading으로.
    """
    if not allow_request(client_ip(request)):
        raise HTTPException(status_code=429, detail="요청이 너무 많아요. 잠시 후 다시 해 주세요.")
    try:
        return read_tarot(req.a.model_dump(), req.b.model_dump(), seed=req.seed)
    except TarotInputError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
