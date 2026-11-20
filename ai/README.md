# SceneWalk AI 서버 (담당: 병관)

AI 가이드 NPC '루미'의 **코스 추천 API**. 나중에 사장님 **홍보문구 API**도 여기에 추가한다.
Python + FastAPI + LangGraph. 맵 장소는 `shared/places.json`에서만 고른다 (없는 장소를 만들지 않음).

기본은 **키워드 규칙**으로 장소를 고른다 (요금 0원). `LLM_DAILY_LIMIT`을 1 이상으로 켜고 키를 넣었을 때만 **OpenAI LLM**(`app/llm_pick.py`, gpt-4o-mini)이 고르고, 실패하면 규칙으로 대신한다.
응답의 `source`가 `llm`이면 LLM, `rules`면 규칙으로 고른 것. 어느 쪽이든 다음 `validate` 노드가 맵에 없는 장소를 걸러 준다.

LangGraph 흐름 (`app/course.py`): understand → pick → validate → order → reply

### API 키
`ai/.env` 또는 저장소 맨 위 `.env`에 키를 넣는다 (`.env.example` 참고, ai/.env가 먼저). **절대 커밋하지 않는다.**
```
LLM_API_Key=...
LLM_DAILY_LIMIT=20        # 기본 0 = OpenAI 안 부름 (요금 0원). 써 볼 때만 켬
# LLM_MODEL=gpt-4o-mini   (기본값)
```
테스트는 실제 API를 부르지 않는다 (`tests/conftest.py`).

## 실행 (Windows, ai/ 폴더에서)

```bash
py -3.12 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

- 상태 확인: http://localhost:8000/health
- API 문서(직접 눌러 보기): http://localhost:8000/docs
- 테스트: `.venv/Scripts/python -m pytest`

## API

### `POST /course` — 코스 추천

요청
```json
{ "message": "애니 좋아하고 카페도 가고 싶어", "count": 3 }
```
- `message`: 1~300자, `count`: 2~5 (기본 3)

응답
```json
{
  "reply": "애니메이션·카페 좋아하시는군요! 1. … → 2. … → 3. … 먼저 …부터 가 볼까요? 지도에 표시해 둘게요.",
  "course": [
    { "placeId": "spot_jm_crossing", "name": "…", "zone": "JM", "zoneName": "애니메이션 구역",
      "type": "spot", "position": [0, 0, -71], "reason": "…" }
  ],
  "nextPlaceId": "spot_jm_crossing",
  "themes": ["anime", "cafe"],
  "source": "llm"
}
```
- `course`는 걷는 순서 (광장에서 가까운 곳부터, 쿠폰 쓰는 카페는 마지막)
- `nextPlaceId`: 맵에 다음 목적지로 표시할 장소

### `GET /health`
`{ "ok": true, "places": 17 }`

## 환경변수
`.env.example` 참고. `.env`와 API 키는 커밋하지 않는다 (저장소 public).

## 비용 안전장치 (`app/limits.py`)
- 한 사람(IP)당 1분 5번, 하루 40번까지 추천 → 넘으면 429 (루미가 "잠시 후 다시" 안내)
- **OpenAI는 기본으로 꺼져 있음** (`LLM_DAILY_LIMIT` 기본 0 → 키가 있어도 안 부름, 요금 0원)
- 켜면 서버 전체 OpenAI 호출은 하루 `LLM_DAILY_LIMIT`번까지 → 넘으면 그날은 키워드 규칙으로만 추천
- 숫자는 환경변수 `RATE_PER_MINUTE`, `RATE_PER_DAY`, `LLM_DAILY_LIMIT`로 바꿈
- `/health`의 `llmCallsToday`로 오늘 OpenAI 호출 수 확인

## 배포 (Render 무료 플랜)
Render 무료 Web Service는 카드 등록 없이 쓸 수 있고 요금이 나오지 않는다.
**요금 0원 배포**: Render에는 OpenAI 키를 넣지 않는다 → 규칙 추천만 동작 (OpenAI 요금도 0원).
15분 동안 요청이 없으면 잠들고, 다음 첫 요청은 깨어나는 데 1분 가까이 걸린다 (프론트가 90초까지 기다림).

1. `ai/` 폴더가 GitHub `main`에 올라가 있어야 함
2. https://render.com → GitHub로 로그인 → **New → Web Service** → 저장소 `Aleph_Capstone` 선택
3. 설정
   | 항목 | 값 |
   |---|---|
   | Branch | `main` |
   | Root Directory | `ai` |
   | Runtime | Python 3 |
   | Build Command | `pip install -r requirements.txt` |
   | Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
   | Instance Type | **Free** |
   | Health Check Path | `/health` (Advanced) |
4. Environment Variables (키는 여기에만 넣고 코드·저장소에는 절대 넣지 않음)
   | 이름 | 값 |
   |---|---|
   | `PYTHON_VERSION` | `3.12.8` |
   | `ALLOWED_ORIGINS` | `https://aleph-capstone.vercel.app,http://localhost:5173` |

   (OpenAI를 쓰기로 정했을 때만 `LLM_API_Key`, `LLM_DAILY_LIMIT` 추가. 안 넣으면 요금 0원)
5. 배포가 끝나면 `https://<서비스이름>.onrender.com/health` 가 `{"ok": true, ...}` 인지 확인
6. Vercel 프로젝트 → Settings → Environment Variables 에 `VITE_AI_API_URL` = 위 주소 → Redeploy

## 외부 API 키 (확장 계획용, `app/external.py`)
- `TOUR_API_KEY`(한국관광공사 TourAPI), `KAKAO_REST_API_KEY`(카카오 맵)를 `.env`에서 **읽기만** 한다. 지금은 어디에도 호출하지 않는다 (기획서: 작품·가게는 가상, 실제 위치 기능 없음 → 요금·규칙 문제 없음).
- `/health`의 `externalKeys`로 키가 들어 있는지만 확인 (`{"tourApi": true, "kakao": true}`). 키 값은 응답·로그에 절대 넣지 않는다.
- 나중에 "실제 성지 연결" 단계에서 이 키로 **서버에서만** 호출한다 (브라우저로 키가 나가지 않게).
- Render에는 실제로 쓸 때만 환경변수로 추가한다.
