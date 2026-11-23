"""SceneWalk AI 서버 (FastAPI).

실행 (ai/ 폴더에서):  uvicorn app.main:app --reload --port 8000
확인:  http://localhost:8000/health ,  문서: http://localhost:8000/docs
"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .audition import router as audition_router
from .course import DEFAULT_COUNT, MAX_COUNT, MIN_COUNT, recommend_course
from .daily import daily_course
from .external import key_status
from .limits import allow_request, llm_calls_today
from .places import course_candidates
from .promo import TARGETS, TONES, generate_promo

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


@app.post("/promo", response_model=PromoResponse)
def promo(req: PromoRequest, request: Request) -> dict:
    """사장님 홍보문구 (템플릿 방식, 요금 0원)"""
    if not allow_request(client_ip(request)):
        raise HTTPException(status_code=429, detail="요청이 너무 많아요. 잠시 후 다시 만들어 주세요.")
    if not req.shopName.strip():
        raise HTTPException(status_code=422, detail="가게 이름을 입력해 주세요.")
    return generate_promo(req.shopName, req.workTitle, req.offer, req.menu, req.target, req.tone, req.includeReels)
