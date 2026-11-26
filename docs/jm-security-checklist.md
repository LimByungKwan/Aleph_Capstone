# 인증·권한 보안 점검 결과 (담당: 지민)

> 점검일: 2026-11-24 · 대상: 배포 사이트 https://aleph-capstone.vercel.app + API https://scenewalk-api.onrender.com + Supabase(PostgreSQL)
> 기준: 「지민 - 인증 및 권한 보안 MVP」 간트 차트 7개 항목
> 구조 그림은 [jm-architecture.md](jm-architecture.md), DB 설계 근거는 [jm-db-design.md](jm-db-design.md)

## 한 줄 결론

**차트 7개 중 6개는 구현·테스트 완료(ZAP은 수동 스캔까지), 1개(구역 관리자 분리)는 CODEOWNERS 파일까지 하고 브랜치 보호 설정이 남음.**
점검하다가 빈틈 5개를 새로 찾았고, 그중 3개(API HSTS, 배포 화면 보안 헤더, 사장님 계정 bcrypt 비용)는 같은 날 고쳤다 → 아래 "찾은 빈틈".

## 항목별 결과

표의 "확인" 열은 **이번 점검에서 직접 실행해서 본 결과**다. "근거"는 다시 볼 수 있는 파일 위치.

| # | 차트 항목 | 상태 | 어떻게 막나 (쉬운 말) | 확인 | 근거 |
|---|---|---|---|---|---|
| 1 | 역할 설계 + 팀 DB 종류 | ✅ | 역할은 순례객·사장님·관리자 3개. 가입하면 무조건 순례객, 역할 변경은 DB 주인만 | 가입 API가 역할 값을 받지 않음 | `supabase/migrations/20261118120000_jm_core.sql:53`(역할 3개), `:96` 트리거 `guard_profile_update` |
| 2-a | bcrypt (비밀번호 저장) | ✅ (빈틈 5 → 고침) | 비밀번호를 직접 저장하지 않고 Supabase Auth가 bcrypt 해시로 저장 | 11/24 실제 DB에서 확인: `auth.users` 8개 계정 모두 `$2a$`(bcrypt)·길이 60. 비용 값은 7개가 10(Supabase 기본), **1개(사장님 공용 계정)만 06** → 빈틈 5 → 같은 날 다시 저장해 8개 모두 10. 확인 쿼리는 이메일·해시 본문 없이 앞부분·개수만 묶어서 봄 | `docs/jm-db-design.md` 11/18 결정 · 아래 "다시 확인하는 법"의 bcrypt 쿼리 |
| 2-b | JWT (로그인 증표) | ✅ | 서버는 요청마다 토큰을 Supabase에 확인받고, 그 토큰 그대로 DB에 넘김. 토큰 1시간 만료 + refresh | 토큰 없음·가짜 토큰 → **401**. 서명 방식 **ES256**(공개키 서명) | `server/src/app.js:115` `requireAuth`, JWKS `alg: ES256` |
| 2-c | HTTPS | ✅ (빈틈 1) | 3곳 모두 HTTPS만. http로 오면 https로 돌려보냄 | http → **308/301** 리다이렉트, **TLS 1.3**. Vercel은 HSTS 있음, **Render API는 HSTS 없음** | 아래 "다시 확인하는 법" |
| 3 | RBAC (역할별 권한) | ✅ | **두 겹**: ① 서버 미들웨어 `requireRole('admin'/'owner')`가 DB 함수 전에 막음(11/24 추가) ② DB 함수 첫 줄과 RLS가 한 번 더 → 서버 코드를 실수해도 DB가 막음. 역할은 토큰이 아니라 매번 DB에서 읽음 | 순례객이 관리자 통계 → `NOT_ADMIN`(11/23 실제 DB에서 확인), 순례객이 사장님 통계 → `NOT_OWNER`, 다른 가게 쿠폰 사용 → `WRONG_SHOP` | `server/src/app.js` `requireRole`, `jm_core.sql:415`(사장님), `:382`(가게), `20261126120000_jm_admin_stats.sql`(관리자) · 서버 테스트 "역할 검사 미들웨어": 순례객·다른 역할·프로필 없음 → 403, DB 함수 호출 0번 |
| 3' | 구역 관리자 분리 | 🟡 파일 완료, 설정 남음 | 맵 구역은 DB 행이 아니라 **파일**이라 앱 권한으로는 못 막음 → GitHub `CODEOWNERS`로 구역 파일마다 담당자 지정(PR이 오면 담당자에게 리뷰 자동 요청). main 브랜치 보호는 저장소 주인(병관) 설정 필요 | `.github/CODEOWNERS` (11/24) | 승인 강제("Require review from Code Owners")는 혼자 고친 PR도 막혀서 시연 뒤 결정 |
| 4-a | RLS (행 단위 권한) | ✅ | 13개 테이블 모두 RLS. "내 것만" 읽기, 관리자만 전체 | 권한 매트릭스 테스트 통과 (테이블 × 비로그인·순례객·다른 사장님 × 읽기/쓰기) | `supabase/tests/jm_security_matrix_test.sql` |
| 4-b | 앱 전용 DB 계정 | ✅ | 서버는 RLS를 무시하는 `service_role` 키를 **아예 안 가짐**. 사용자 토큰(`authenticated` 역할)으로만 DB 접속 | 서버 `.env`에 공개 키(publishable)만 있음 | `server/src/supabase.js:5` |
| 5-a | 스탬프 서버 검증 | ✅ (빈틈 2) | 스탬프는 DB 함수만 찍을 수 있고, 같은 장소 두 번은 DB 제약이 막음. NPC 같은 장소는 거절 | 토큰 없이 `POST /stamps` → **401** | `jm_core.sql:121` `UNIQUE(user_id, place_id)`, `:290` `collect_stamp` |
| 5-b | 로그인 시도 제한 | ✅ | 같은 IP 15분 30번, 같은 이메일 실패 15분 5번 넘으면 잠깐 막음 | 서버 테스트 통과 | `server/src/app.js:91-92`, `server/test/rateLimit.test.js` |
| 6-a | 감사 로그 | ✅ | 역할 변경·가게 홍보문구·쿠폰 사용을 DB 트리거가 자동 기록. 관리자도 고치거나 지울 수 없음 | 11/23 시연용 사장님 지정이 첫 기록으로 남음 | `20261125120000_jm_audit_log.sql`, `supabase/tests/jm_audit_log_test.sql` |
| 6-b | 권한 우회 403 테스트 | ✅ | 권한 없는 요청이 정확히 막히는지 자동 테스트 | 서버 테스트 **69개 통과**(401·403·역할 미들웨어·보안 헤더 포함, 11/24 기준). RLS 구조라 "남의 데이터 조회"는 403이 아니라 **0건**으로 나옴 | `server/test/app.test.js`, 매트릭스 SQL |
| 7 | OWASP ZAP 점검 | ✅ 수동 스캔 (빈틈 4 → 고침) | ZAP 2.17.0으로 배포 사이트·API를 **둘러보고 응답만 검사**(공격 요청을 보내는 능동 스캔은 안 함 — Render 무료 서버·시연 데이터 보호) | 11/24: **High 0개**. API는 헤더 경고 0개(정보성 1개). 배포 사이트는 Medium 3개(CSP 없음, `X-Frame-Options` 없음, 정적 파일 `Access-Control-Allow-Origin: *`)·Low 2개(`nosniff` 없음, 번들 안 타임스탬프) | 리포트 원본: [고치기 전](zap/jm-zap-1124-before.html) · [고친 뒤](zap/jm-zap-1124-after.html), 스캔 설정 [jm-zap-baseline.yaml](zap/jm-zap-baseline.yaml). 고친 뒤 다시 스캔: `X-Frame-Options`·`nosniff` 경고 사라짐, 대신 "CSP가 일부만 있음" 경고 4개(스크립트 제한 CSP를 시연 뒤로 미룬 결정 그대로) — High는 여전히 0. 로그인한 화면 안쪽·POST API는 범위 밖 |

| 8 | 계정당 로그인 1곳 (11/26 추가) | ✅ 로컬 검증 (배포 전) | **새 로그인 우선**: 같은 계정으로 다른 기기에서 로그인하면 이전 기기는 다음 요청부터 401 `SESSION_REPLACED` → 화면이 로그아웃하고 "다른 기기에서 로그인했어요" 안내. 토큰 안의 `session_id`(로그인 1번마다 새로 생김, refresh해도 그대로)를 계정마다 하나만 DB에 기록해 비교. **두 겹**: ① 서버 `requireAuth` ② DB `require_user`(스탬프·쿠폰·꾸미기 등 쓰기 함수 첫 줄) → 끊긴 기기가 서버를 건너뛰고 Supabase를 직접 불러도 쓰기는 막힘. 멀티 접속도 계정당 1개(새 접속 우선) | SQL 15개(끊긴 기기 쓰기 거절, 로그아웃 뒤 옛 세션 부활 안 함, 감사 로그 `session_replaced`, 표 직접 읽기·쓰기 0건) + 서버 10개(401 순서·확인 실패 시 500·로그아웃 항상 204·소켓 4001/4002) + 화면 3개 | `supabase/migrations/20261130120000_jm_single_session.sql`, `supabase/tests/jm_single_session_test.sql`, `server/src/app.js` `requireAuth`·`/auth/logout`, `server/src/realtime.js` `closeUser`, `frontend/src/api/session.js` `handleSessionReplaced` |

| 9 | 관리자 2단계 인증 TOTP (11/26 추가) | ✅ 로컬 검증 (등록·로그인 실측은 배포 뒤) | **등록한 관리자만**: 인증 앱 6자리를 등록한 관리자는 이번 로그인에서 코드를 넣어야(aal2) 관리자 권한. 등록 안 한 관리자·사장님·순례객은 그대로 → 시연 직전 갑자기 막히지 않음. **두 겹**: ① 서버 `requireRole('admin')` → 403 `MFA_REQUIRED` ② DB `my_role()`이 aal1이면 관리자를 순례객으로 봄 → 관리자 통계·감사 로그·남의 프로필·역할 변경이 서버 우회로도 막힘. 코드 15분 5번 실패 제한. 서버는 비밀 키 없이 사용자 토큰으로 Supabase Auth `/factors` API를 부름 | SQL 8개(aal1 등록 관리자 4가지 막힘, aal2 통과, 미등록 관리자 그대로, 남의 factor와 무관) + 서버 11개(형식 오류 시 인증 서버 안 부름, 서버가 factor를 찾음, 6번째 429, 오류 내용 숨김) + 화면 4개 | `supabase/migrations/20261201120000_jm_admin_mfa.sql`, `supabase/tests/jm_admin_mfa_test.sql`, `server/src/app.js` `mfaInfo`·`/auth/mfa/*`, `frontend/src/components/auth/LoginPage.jsx` `MfaCodeModal`·`MfaEnrollModal` |

### 추가로 확인한 것

| 확인 | 결과 |
|---|---|
| 등록 안 된 사이트에서 API 호출 (CORS) | `https://evil.example` → 허용 헤더 없음 = **차단** |
| 등록 안 된 사이트에서 멀티 접속 (WebSocket) | **403** 거절 |
| 손님(비로그인)이 스탬프·스탬프북·시간 탐정 스탬프 | 로그인 창 (11/24 PR #75로 시간 탐정 구멍까지 막음) |

## 찾은 빈틈 (이번 점검에서 새로 발견)

| # | 빈틈 | 위험 | 대응 |
|---|---|---|---|
| 1 | **Render API에 HSTS 헤더가 없음** (Vercel 화면은 있음) | 첫 접속을 http로 하면 중간자가 가로챌 여지. 실제로는 API를 화면이 https로만 부르므로 위험 낮음 | ✅ 11/24 고침: 모든 응답에 HSTS(1년) + `nosniff` + `X-Frame-Options: DENY` + `no-referrer` (`server/src/app.js`, 서버 테스트 "보안 헤더") — 배포 후 `curl -sI https://scenewalk-api.onrender.com/health`로 확인 |
| 2 | **시간 탐정 스탬프는 서버 검증이 없음** (브라우저 저장) | 로그인한 사람이 개발자 도구로 스탬프를 만들어 낼 수 있음. 다른 기기·관리자 통계에도 안 보임 | 시연 뒤 DB 저장으로 옮기기 검토 (혜진 기능이라 같이) |
| 3 | 로그인 토큰을 localStorage에 저장 | 화면에 XSS가 생기면 토큰을 훔칠 수 있음 | 알고 한 타협: 짧은 만료(1시간) + 화면에 사용자 입력을 HTML로 넣지 않음(React 기본). 근거 `frontend/src/api/session.js:14` |
| 4 | **배포 화면(Vercel)에 보안 헤더가 거의 없음** (ZAP으로 발견): `Content-Security-Policy`·`X-Frame-Options`·`X-Content-Type-Options` 없음. API(Render)는 11/24에 다 넣음 | ① 다른 사이트가 우리 화면을 iframe에 넣어 클릭을 속일 수 있음(클릭재킹) ② CSP가 없어서 XSS가 생기면 막아 줄 두 번째 벽이 없음 — 빈틈 3(토큰 localStorage)과 겹침. 정적 파일의 `ACAO: *`는 Vercel 기본값이고 로그인 정보가 안 실려서 위험 낮음 | ✅ 11/24 고침 (PR #80): `frontend/vercel.json`에 `X-Frame-Options: DENY`·`nosniff`·`Referrer-Policy`·CSP 일부(`frame-ancestors 'none'; object-src 'none'; base-uri 'self'`). 배포 후 실제 사이트에서 4개 모두 확인, JS·3D 모델 파일 형식 정상(`nosniff`로 막히지 않음), 화면·콘솔 오류 없음. 남은 것: 스크립트를 제한하는 CSP(`script-src` 등)는 three.js·WebAssembly·외부 API 때문에 화면이 깨질 수 있어 **시연 뒤** 검토 |
| 5 | **사장님 공용 계정(jm-demo-owner)만 bcrypt 비용 값이 06이었음** (나머지는 10) | 비용 6은 10보다 해시 한 번 계산이 약 16배 빨라서, DB 해시가 새면 비밀번호 추측이 더 쉬움. 공용 계정이라 영향이 큼 | ✅ 11/24 고침: 원인은 SQL Editor에서 `crypt(…, gen_salt('bf'))`로 넣은 것으로 봄(pgcrypto 기본 비용 6). 지민이 **같은 비밀번호**를 `gen_salt('bf', 10)`으로 다시 저장 → 확인 쿼리에서 8개 계정 모두 비용 10. 앞으로 SQL로 비밀번호를 넣을 일이 있으면 `gen_salt('bf', 10)`을 쓸 것 |

### 알고 정한 위험 (팀 결정)

- **이메일 인증 꺼 둠** (시연 12/01까지): 무료 메일 발송 제한 때문에 켜면 가입이 막힘. 실제 메일로 가입하는 건 팀 약속으로 지킴 → [jm-admin-accounts.md](jm-admin-accounts.md)
- **사장님 계정은 공용 1개**: 한 명이 비밀번호를 5번 틀리면 15분 모두 잠김, 감사 로그가 한 사람으로 찍힘. 11/26부터 계정당 로그인 1곳이라 **두 사람이 동시에 쓰면 먼저 들어온 쪽이 끊김** → 시연 때 사장님 화면은 한 사람만 연다(운영 규칙). 시연 뒤 사장님 계정을 사람마다 1개씩 만드는 것으로 정리
- **계정당 로그인 1곳의 한계**: 끊긴 토큰으로 Supabase를 직접 부르면 "본인 데이터 읽기"(RLS)는 토큰 만료(1시간) 전까지 가능. Auth 세션 자체를 끊으려면 모든 RLS를 무시하는 `service_role` 키가 서버에 있어야 하는데, 키가 새면 피해가 훨씬 커서 넣지 않는 쪽을 택함. 쓰기는 DB `require_user`가 막음
- **"기존 로그인 우선"을 고르지 않은 이유**: 비밀번호를 훔친 사람이 먼저 들어오면 진짜 사용자가 못 들어오고, 탭만 닫은 정상 사용자도 막힘. 새 로그인 우선이면 진짜 사용자가 다시 로그인하는 것만으로 훔친 쪽이 끊기고, 끊긴 쪽 화면 안내 + 감사 로그로 알아챌 수 있음

## 다시 확인하는 법

누구나 터미널에서 그대로 실행하면 같은 결과가 나와야 한다.

```bash
# HTTPS 리다이렉트 (308/301이면 정상)
curl -s -o /dev/null -w "%{http_code}\n" http://aleph-capstone.vercel.app/
curl -s -o /dev/null -w "%{http_code}\n" http://scenewalk-api.onrender.com/

# 로그인 없이 보호된 API (모두 401이면 정상)
for p in /me /stamps/me /admin/stats /shop/stats; do curl -s -o /dev/null -w "$p %{http_code}\n" https://scenewalk-api.onrender.com$p; done

# 등록 안 된 사이트 (아무것도 안 나오면 차단 = 정상)
curl -sI -H "Origin: https://evil.example" https://scenewalk-api.onrender.com/health | grep -i access-control-allow-origin

# 서버 자동 테스트 (server 폴더)
npm test
```

### ZAP 다시 돌리는 법 (수동 스캔, Docker 없이)

ZAP 2.17.0 크로스플랫폼 zip(공식 GitHub 릴리스, SHA-256 `94c8f767…61fbff0` 확인) + Java 17. 설정 파일은 둘러보기(spider 최대 2분) + GET 요청 7개(`/health`, `/me`, `/me`+외부 Origin, `/stamps/me`, `/admin/stats`, `/shops/shop_hj_snack/promo`, 없는 주소) + 수동 검사 + 보고서이고 **activeScan 잡이 없다**.

```bash
java -jar zap-2.17.0.jar -cmd -port 8095 -autorun zap-baseline.yaml   # 8080이 쓰이고 있으면 -port로 바꿈
# 화면 헤더 직접 확인
curl -sI https://aleph-capstone.vercel.app/ | grep -i -E "x-frame|x-content|content-security|access-control"
```

### bcrypt 확인 쿼리 (Supabase SQL Editor, 읽기만)

이메일·해시 본문은 보지 않고 앞부분(방식 `$2a$` = bcrypt, 비용 값)과 개수만 묶어서 본다.

```sql
select left(encrypted_password, 4) as scheme, substring(encrypted_password from 5 for 2) as cost,
       length(encrypted_password) as len, count(*) as users
from auth.users group by 1, 2, 3 order by users desc;
```

DB 쪽(RLS·감사 로그)은 Supabase SQL Editor에서 `supabase/tests/jm_security_matrix_test.sql`, `jm_audit_log_test.sql`을 통째로 실행 → 마지막이 rollback이라 데이터는 안 남는다.
