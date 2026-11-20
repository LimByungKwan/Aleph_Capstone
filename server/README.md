# SceneWalk API 서버 (담당: 지민)

로그인·스탬프·쿠폰·체험·가게 문구 API. Node.js + Express 5 → Supabase(Postgres + Auth).

```
화면(Vercel) ──fetch──▶ 이 서버(Render) ──그 사람의 토큰으로──▶ Supabase
                         토큰 확인·에러 변환              규칙·권한(RLS, DB 함수)
```

## 설계 판단 (면접에서 설명할 부분)

| 판단 | 이유 |
| --- | --- |
| 규칙은 DB에, 서버는 얇게 | 중복 스탬프·쿠폰 1회 사용은 UNIQUE 제약과 조건부 UPDATE로 막는다. 서버를 여러 대 띄우거나 동시에 요청이 와도 한 번만 들어간다 (`supabase/migrations`) |
| 서버에 service_role 키를 두지 않음 | 요청마다 로그인한 사람의 토큰을 그대로 DB에 실어 보낸다. DB 안에서 `auth.uid()`가 그 사람이 되고 RLS가 그대로 적용된다. 서버 코드에 버그가 있어도 남의 데이터는 못 건드리고, 서버 키가 새도 피해가 작다 |
| 토큰 검사는 Supabase Auth에 맡김 | 서명·만료 검사를 직접 구현하지 않는다 (`auth.getUser`) |
| 가입 시 역할을 받지 않음 | 누구나 순례객으로 가입되고, 사장님·관리자 지정은 DB에서 관리자만 한다 (권한 상승 차단) |
| 쿠폰 사용에 멱등성 키 | 버튼 두 번·응답 유실 후 재시도에도 "이미 사용됨" 대신 첫 결과를 그대로 돌려준다 |
| 예상 못 한 에러는 숨김 | 500일 때 테이블 이름 같은 내부 정보를 응답에 넣지 않고 서버 로그에만 남긴다 |

## 로컬 실행 (server/ 폴더)

```bash
npm install
cp .env.example .env     # 값 채우기 (Supabase 대시보드 → Project Settings → API Keys)
npm run dev              # http://localhost:4000/health
npm test                 # 가짜 Supabase로 라우트 테스트 (실제 DB 안 부름)
```

## API

모든 응답은 JSON. 에러는 `{ "error": { "code", "message" } }` — `code`는 `client.js`의 `ApiError.code`와 같다.
🔒 = `Authorization: Bearer <accessToken>` 필요.

| 메서드 · 주소 | 요청 | 응답 | 주요 에러 |
| --- | --- | --- | --- |
| `GET /health` | | `{ ok: true }` | |
| `POST /auth/signup` | `{ email, password, name? }` | `{ needsEmailConfirm, session?, user? }` | `EMAIL_TAKEN` 409, `WEAK_PASSWORD` 400 |
| `POST /auth/login` | `{ email, password }` | `{ session: { accessToken, refreshToken, expiresAt }, user: { id, email, name, role, shopId } }` | `INVALID_LOGIN` 401, `EMAIL_NOT_CONFIRMED` 403 |
| `POST /auth/refresh` | `{ refreshToken }` | `{ session }` | `UNAUTHORIZED` 401 |
| 🔒 `GET /me` | | `{ user }` | |
| 🔒 `POST /stamps` | `{ placeId }` | `{ stamp, issuedCoupons }` | `ALREADY_STAMPED` 409, `NOT_STAMPABLE` 400, `NOT_FOUND` 404 |
| 🔒 `GET /stamps/me` | | `{ stamps: [{ id, placeId, createdAt }] }` | |
| 🔒 `GET /coupons/me` | | `{ coupons }` (최신순) | |
| 🔒 `POST /coupons/redeem` | `{ code, idempotencyKey? (UUID) }` | `{ coupon, replayed }` | `NOT_OWNER` 403, `WRONG_SHOP` 403, `COUPON_USED` 409, `COUPON_EXPIRED` 400 |
| 🔒 `GET /shop/stats` | | `{ issued, used, visitors, recentRedemptions }` | `NOT_OWNER` 403 |
| 🔒 `PUT /shop/promo` | `{ text, tag? }` | `{ shopPromo }` | `NOT_OWNER` 403 |
| `GET /shops/:shopId/promo` | | `{ shopPromo \| null }` | |
| 🔒 `POST /activities/:activityId/start` | | `{ sessionId }` | `TOO_MANY_REQUESTS` 429 |
| 🔒 `POST /activities/sessions/:sessionId/complete` | | `{ activityId, alreadyCompleted, completedAt }` | `TOO_FAST` 400 |

- 로그인하면 `log_access`로 접속 기록이 남는다 (일일 접속자 = 로그인한 사람의 하루 첫 접속, 한국 시간).
- 일일 접속자·구역별 통계 API는 성근님 담당 — 이 서버에 라우트를 추가하면 된다 (`daily_visitors` 뷰는 관리자만 읽힘).

## Render 배포

1. Render → New → **Web Service** → GitHub 저장소 연결
2. 설정
   - Root Directory: `server`
   - Runtime: Node · Build Command: `npm ci` · Start Command: `npm start`
   - Region: **Singapore** (서울 Supabase와 가장 가까움) · Instance: **Free**
   - Health Check Path: `/health`
3. Environment에 `.env.example`의 키 3개 입력 (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ALLOWED_ORIGINS`). `PORT`는 Render가 자동으로 넣음
4. 배포 후 `https://<서비스>.onrender.com/health`가 `{"ok":true}`면 끝

무료 플랜은 15분 동안 요청이 없으면 잠들고, 첫 요청이 수십 초 걸린다. **시연 직전에 `/health`를 한 번 열어 깨워 둔다** (AI 서버도 같이).
