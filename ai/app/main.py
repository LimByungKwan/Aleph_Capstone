"""SceneWalk AI 서버 (FastAPI).

실행 (ai/ 폴더에서):  uvicorn app.main:app --reload --port 8000
확인:  http://localhost:8000/health ,  문서: http://localhost:8000/docs
"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .course import DEFAULT_COUNT, MAX_COUNT, MIN_COUNT, recommend_course
from .limits import allow_request, llm_calls_today
from .places import course_candidates

app = FastAPI(title="SceneWalk AI", version="0.1.0")

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


@app.get("/health")
def health() -> dict:
    return {"ok": True, "places": len(course_candidates()), "llmCallsToday": llm_calls_today()}


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
