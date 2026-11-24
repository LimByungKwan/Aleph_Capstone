# 인증·권한 보안 점검 결과 (담당: 지민)

> 점검일: 2026-11-24 · 대상: 배포 사이트 https://aleph-capstone.vercel.app + API https://scenewalk-api.onrender.com + Supabase(PostgreSQL)
> 기준: 「지민 - 인증 및 권한 보안 MVP」 간트 차트 7개 항목
> 구조 그림은 [jm-architecture.md](jm-architecture.md), DB 설계 근거는 [jm-db-design.md](jm-db-design.md)

## 한 줄 결론

**차트 7개 중 5개는 구현·테스트 완료, 1개(구역 관리자 분리 = GitHub 권한)는 남음, 1개(ZAP 점검)는 아직 안 함.**
점검하다가 빈틈 3개를 새로 찾았다 → 아래 "찾은 빈틈".

## 항목별 결과

표의 "확인" 열은 **이번 점검에서 직접 실행해서 본 결과**다. "근거"는 다시 볼 수 있는 파일 위치.

| # | 차트 항목 | 상태 | 어떻게 막나 (쉬운 말) | 확인 | 근거 |
|---|---|---|---|---|---|
| 1 | 역할 설계 + 팀 DB 종류 | ✅ | 역할은 순례객·사장님·관리자 3개. 가입하면 무조건 순례객, 역할 변경은 DB 주인만 | 가입 API가 역할 값을 받지 않음 | `supabase/migrations/20261118120000_jm_core.sql:53`(역할 3개), `:96` 트리거 `guard_profile_update` |
| 2-a | bcrypt (비밀번호 저장) | ✅ | 비밀번호를 직접 저장하지 않고 Supabase Auth가 bcrypt 해시로 저장 | Supabase Auth 기본 동작 (이번엔 DB 해시 앞자리 확인 못 함 — 대시보드 로그인 풀림) | `docs/jm-db-design.md` 11/18 결정 |
| 2-b | JWT (로그인 증표) | ✅ | 서버는 요청마다 토큰을 Supabase에 확인받고, 그 토큰 그대로 DB에 넘김. 토큰 1시간 만료 + refresh | 토큰 없음·가짜 토큰 → **401**. 서명 방식 **ES256**(공개키 서명) | `server/src/app.js:115` `requireAuth`, JWKS `alg: ES256` |
| 2-c | HTTPS | ✅ (빈틈 1) | 3곳 모두 HTTPS만. http로 오면 https로 돌려보냄 | http → **308/301** 리다이렉트, **TLS 1.3**. Vercel은 HSTS 있음, **Render API는 HSTS 없음** | 아래 "다시 확인하는 법" |
| 3 | RBAC (역할별 권한) | ✅ | 역할 검사를 DB 함수 첫 줄과 RLS에서 함 → 서버 코드를 실수해도 DB가 막음 | 순례객이 관리자 통계 → `NOT_ADMIN`(11/23 실제 DB에서 확인), 순례객이 사장님 통계 → `NOT_OWNER`, 다른 가게 쿠폰 사용 → `WRONG_SHOP` | `jm_core.sql:415`(사장님), `:382`(가게), `20261126120000_jm_admin_stats.sql`(관리자) |
| 3' | 구역 관리자 분리 | ⬜ 남음 | 맵 구역은 DB 행이 아니라 **파일**이라 앱 권한으로는 못 막음 → GitHub CODEOWNERS + main 브랜치 보호로 해결 예정 | — | 다음 작업 |
| 4-a | RLS (행 단위 권한) | ✅ | 13개 테이블 모두 RLS. "내 것만" 읽기, 관리자만 전체 | 권한 매트릭스 테스트 통과 (테이블 × 비로그인·순례객·다른 사장님 × 읽기/쓰기) | `supabase/tests/jm_security_matrix_test.sql` |
| 4-b | 앱 전용 DB 계정 | ✅ | 서버는 RLS를 무시하는 `service_role` 키를 **아예 안 가짐**. 사용자 토큰(`authenticated` 역할)으로만 DB 접속 | 서버 `.env`에 공개 키(publishable)만 있음 | `server/src/supabase.js:5` |
| 5-a | 스탬프 서버 검증 | ✅ (빈틈 2) | 스탬프는 DB 함수만 찍을 수 있고, 같은 장소 두 번은 DB 제약이 막음. NPC 같은 장소는 거절 | 토큰 없이 `POST /stamps` → **401** | `jm_core.sql:121` `UNIQUE(user_id, place_id)`, `:290` `collect_stamp` |
| 5-b | 로그인 시도 제한 | ✅ | 같은 IP 15분 30번, 같은 이메일 실패 15분 5번 넘으면 잠깐 막음 | 서버 테스트 통과 | `server/src/app.js:91-92`, `server/test/rateLimit.test.js` |
| 6-a | 감사 로그 | ✅ | 역할 변경·가게 홍보문구·쿠폰 사용을 DB 트리거가 자동 기록. 관리자도 고치거나 지울 수 없음 | 11/23 시연용 사장님 지정이 첫 기록으로 남음 | `20261125120000_jm_audit_log.sql`, `supabase/tests/jm_audit_log_test.sql` |
| 6-b | 권한 우회 403 테스트 | ✅ | 권한 없는 요청이 정확히 막히는지 자동 테스트 | 서버 테스트 **48개 통과**(401·403 포함). RLS 구조라 "남의 데이터 조회"는 403이 아니라 **0건**으로 나옴 | `server/test/app.test.js`, 매트릭스 SQL |
| 7 | OWASP ZAP 점검 | ⬜ 안 함 | 배포 사이트 자동 취약점 스캔 | — | 팀 공지 후 진행 예정 |

### 추가로 확인한 것

| 확인 | 결과 |
|---|---|
| 등록 안 된 사이트에서 API 호출 (CORS) | `https://evil.example` → 허용 헤더 없음 = **차단** |
| 등록 안 된 사이트에서 멀티 접속 (WebSocket) | **403** 거절 |
| 손님(비로그인)이 스탬프·스탬프북·시간 탐정 스탬프 | 로그인 창 (11/24 PR #75로 시간 탐정 구멍까지 막음) |

## 찾은 빈틈 (이번 점검에서 새로 발견)

| # | 빈틈 | 위험 | 대응 |
|---|---|---|---|
| 1 | **Render API에 HSTS 헤더가 없음** (Vercel 화면은 있음) | 첫 접속을 http로 하면 중간자가 가로챌 여지. 실제로는 API를 화면이 https로만 부르므로 위험 낮음 | 서버에 `Strict-Transport-Security` 헤더 1줄 추가 (작은 작업) |
| 2 | **시간 탐정 스탬프는 서버 검증이 없음** (브라우저 저장) | 로그인한 사람이 개발자 도구로 스탬프를 만들어 낼 수 있음. 다른 기기·관리자 통계에도 안 보임 | 시연 뒤 DB 저장으로 옮기기 검토 (혜진 기능이라 같이) |
| 3 | 로그인 토큰을 localStorage에 저장 | 화면에 XSS가 생기면 토큰을 훔칠 수 있음 | 알고 한 타협: 짧은 만료(1시간) + 화면에 사용자 입력을 HTML로 넣지 않음(React 기본). 근거 `frontend/src/api/session.js:14` |

### 알고 정한 위험 (팀 결정)

- **이메일 인증 꺼 둠** (시연 11/30까지): 무료 메일 발송 제한 때문에 켜면 가입이 막힘. 실제 메일로 가입하는 건 팀 약속으로 지킴 → [jm-admin-accounts.md](jm-admin-accounts.md)
- **사장님 계정은 공용 1개**: 한 명이 비밀번호를 5번 틀리면 15분 모두 잠김, 감사 로그가 한 사람으로 찍힘

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

DB 쪽(RLS·감사 로그)은 Supabase SQL Editor에서 `supabase/tests/jm_security_matrix_test.sql`, `jm_audit_log_test.sql`을 통째로 실행 → 마지막이 rollback이라 데이터는 안 남는다.
