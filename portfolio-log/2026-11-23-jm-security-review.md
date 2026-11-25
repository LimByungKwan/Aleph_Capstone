# 외부 보안 피드백을 실제 코드와 대조해서 할 일 다시 짜기

- 날짜: 2026-11-23
- 프로젝트: SceneWalk AI (4인 팀 캡스톤, 웹 3D 관광 맵). JM 담당: 로그인·역할·스탬프·쿠폰 API, DB(Supabase), 배포
- 사용 도구: Claude Code (Opus 5.5), Supabase(PostgreSQL + Auth), Express 서버(Render), Vercel, GitHub API
- 목표: 받은 보안·네트워크 피드백(RBAC, RLS, nonce, Nginx 구성도, ZAP 등) 중 이미 된 것과 정말 해야 할 것을 코드 근거로 나누고, 시연(11/30)까지의 일정을 다시 짠다.

## A. AI가 한 일
- 피드백 대조: 피드백의 항목을 레포 코드와 하나씩 맞춰 봄. 결과는 아래 표 — 증거: 아래 파일 위치

| 피드백 항목 | 실제 상태 | 근거 |
|---|---|---|
| RLS로 남의 데이터 막기 | 이미 됨. 테이블 11개에 RLS, 정책은 `auth.uid()` 기준 | `supabase/migrations/20261118120000_jm_core.sql:205-240` |
| 앱이 소유자 계정으로 붙으면 RLS 무시 | 이미 막음. 서버는 service_role 키를 쓰지 않고 사용자 토큰을 그대로 DB에 넘김 | `server/src/supabase.js:5` |
| 역할 나누기(RBAC) | 이미 됨. `pilgrim / owner / admin`, 사장님은 자기 가게만 | `jm_core.sql:53`, `:236` |
| 스탬프 위변조·재전송(nonce) | 중복 획득은 `UNIQUE (user_id, place_id)` + `ON CONFLICT`로 이미 막음. nonce를 더해도 얻는 게 적음 | `jm_core.sql:121`, `:289` |
| bcrypt·JWT·로그인 시도 제한 | 직접 만들지 않고 Supabase Auth가 처리 | 11/18 결정 |
| MySQL이면 RLS 없음 | 해당 없음. PostgreSQL | — |

- 피드백의 잘못된 전제 짚기: 예시 SQL의 `current_setting('app.user_id')`는 직접 만든 서버용 패턴이라 Supabase에서는 오히려 후퇴임을 설명함
- "4명 모두 관리자" 해석: 앱 DB의 기본 역할은 `pilgrim`이라 앱 관리자 이야기가 아님. GitHub 권한이라면 "자기 구역만 수정"은 RLS가 아니라 CODEOWNERS + main 브랜치 보호로 풀어야 함을 제시함(구역은 DB 행이 아니라 파일이므로)
- 동의하기 어려운 항목 정리
  - Nginx·방화벽 구성도: 지금 구조(Vercel → Render → Supabase)에는 직접 설정하는 Nginx가 없음. 운영하지 않는 구성도 대신 실제 요청 경로와 구간별 방어를 그리자고 제안함
  - 스탬프 위치 검증: 웹 게임 좌표는 클라이언트가 보내는 값이라 서버 검증 의미가 약함. 체험 기능에 이미 있는 "세션 시작 후 최소 시간" 방식이 더 현실적 — 근거: `jm_core.sql:451`, `:475`
- MySQL 전환 검토: 일본 채용 시장에서 MySQL이 많다는 질문에, MySQL로 그대로 되는 것(UNIQUE, CHECK, 트랜잭션, 프로시저)과 안 되는 것(RLS, `auth.uid()`)을 나눠 설명함. 프론트는 Express REST만 부르므로 바꿔도 팀원 코드 영향은 없다는 점도 확인함 — 증거: `server/src/app.js` 라우트 목록
- 테스트 표현 바로잡기: 피드백의 "권한 우회 시 403"은 RLS 구조에서는 403이 아니라 0건으로 나오고, 403에 해당하는 건 사장님 전용 함수의 `NOT_OWNER`뿐임을 정리함 — 근거: `jm_core.sql:365`
- 일정 재구성: 받은 간트 차트(6일 중 4일이 이미 끝난 일, 시연을 막는 일은 빠짐)를 시연 필수 → 보안 포트폴리오 순서로 다시 짬

## B. 사용자가 직접 한 일
- 피드백 확보: 보안·네트워크 관점 피드백과 간트 초안을 받아 와서 검토를 요청함
- 결정: DB는 Supabase PostgreSQL 유지 (MySQL 전환을 지시했다가, RLS가 빠져 보안이 한 겹 얇아진다는 설명을 듣고 되돌림)
- 결정: 시연일 11/30 기준으로 일정을 잡음

## C. AI 판단과 달리 사용자가 결정한 일
- 없음

## 결과와 배운 점
- 결과
  - 피드백 중 이미 구현된 항목 5개를 근거와 함께 확인, 새로 할 일은 아래로 좁힘
  - 남은 보안 작업: 권한 우회 테스트(0건 / `NOT_OWNER`) + 결과 문서, `access_logs`가 쓰기 작업도 기록하는지 확인, CODEOWNERS·브랜치 보호, OWASP ZAP 스캔(팀 공지 후), 실제 구성도, (시간 남으면) 관리자 TOTP
- 배운 점
  - 피드백은 받는 쪽 구조를 모르고 쓰인 경우가 많다. 코드 근거와 대조하지 않으면 이미 있는 걸 다시 만들게 된다.
  - "막혔다"를 증명하는 방법은 구조마다 다르다. RLS는 에러가 아니라 빈 결과로 막는다.
  - 면접 대비 한 줄: "MySQL이라면 RLS가 없어서 서버에서 역할을 검사하고, DB 계정에는 프로시저 실행 권한만 GRANT하겠다."

---

# (같은 날 이어서) 권한 우회 매트릭스 · 감사 로그 · 로그인 시도 제한 · 구성도

- 목표: 위에서 좁힌 보안 작업 중 코드로 할 수 있는 것을 끝내고, "막힌다"를 테스트로 증명한다.

## A. AI가 한 일
- 권한 우회 매트릭스 테스트: 모든 public 테이블(12개) × 역할 5종(비로그인·순례객·다른 가게 사장님·그 가게 사장님·관리자) × 읽기/INSERT/UPDATE/DELETE를 한 파일로 자동 점검. 테이블 목록을 DB에서 읽어 돌리므로 새 테이블이 생겨도 자동으로 검사 대상이 됨 — 증거: `supabase/tests/jm_security_matrix_test.sql`
  - 결과: 남의 데이터 읽기 0건, 직접 INSERT 42501, 직접 UPDATE·DELETE 0행, 비로그인은 쓰기 함수 8개 모두 permission denied, 관리자는 접속 기록·통계를 볼 수 있음(막기만 하다 필요한 사람이 못 보는 실수도 확인)
  - 실수 방지 점검 4개: RLS 꺼진 테이블 0개, search_path 안 고정된 SECURITY DEFINER 함수 0개, 비로그인이 실행 가능한 SECURITY DEFINER 함수는 정책용 2개뿐, security_invoker 없는 뷰 0개
- 일부러 구멍 내서 테스트가 잡는지 확인(뮤테이션 테스트) — 증거: 로컬 PGlite 실행 출력(대화 기록)

| 일부러 낸 구멍 | 테스트 결과 |
|---|---|
| stamps RLS 끄기 | FAIL: 남의 스탬프 1건 보임 |
| coupons 전체 공개 정책 | FAIL: 남의 쿠폰 1건 보임 |
| shop_promos INSERT 허용 정책 | FAIL: INSERT가 42501이 아님 |
| save_appearance를 비로그인에게 열기 | FAIL: permission denied가 아님 |
| collect_stamp의 search_path 고정 해제 | FAIL: search_path 고정 안 된 함수 |
| daily_visitors 뷰 security_invoker 해제 | FAIL: 순례객이 방문자 통계를 봄 |
| RLS 없는 새 테이블 추가 | FAIL: RLS가 꺼진 테이블: new_feature |
| tarot_readings에 "누구나 삭제" 정책 | 통과 — 실제 구멍이 아님. Postgres는 SELECT로 볼 수 없는 행은 지우지 못하게 해서 남의 타로 기록은 여전히 안전 |

- access_logs 점검: 로그인 기록(누가·언제)만 남고 쓰기 작업은 기록되지 않음을 확인. 쿠폰 사용은 `coupons.used_by/used_at`과 `redeem_requests`로 이미 남지만, **역할 변경은 흔적이 전혀 없고** 가게 문구는 덮어써서 이전 내용이 사라짐
- 감사 로그 추가: 역할·가게 변경, 가게 문구 저장(이전/이후), 쿠폰 사용을 트리거로 자동 기록. 관리자만 읽고, 관리자도 고치기·지우기·가짜 넣기 불가. 바뀐 칸만 저장(개인정보 최소) — 증거: `supabase/migrations/20261125120000_jm_audit_log.sql`, `supabase/tests/jm_audit_log_test.sql`
  - 처음 작성 때 실수: SECURITY DEFINER 함수 안에서 `current_user`는 호출한 사람이 아니라 함수 주인이 됨. 세션의 `role` 설정으로 바꿔서 "SQL Editor(postgres)"와 "로그인한 사장님(authenticated)"을 구분하게 고침
  - 뮤테이션: 트리거 제거 → FAIL, 관리자 삭제 정책 추가 → FAIL, 전체 공개 정책 → FAIL
- 로그인 시도 제한 추가: 서버 코드를 읽다가 발견한 구멍. 로그인은 전부 Render 서버를 거쳐 Supabase로 가서, Supabase의 IP 제한에는 모든 사용자가 서버 IP 하나로 보임 → 공격자만 골라 막을 수 없고, 한 명이 몰아서 시도하면 모두가 막힐 수 있음. 실제 사용자 IP(Render 프록시 1단 신뢰) 기준 15분 30번, 이메일 기준 실패 15분 5번(성공 시 초기화), 초과 시 429 + Retry-After, 막힌 요청은 Supabase까지 안 감 — 증거: `server/src/rateLimit.js`, `server/test/rateLimit.test.js`
- 실제 구성도: 운영하지 않는 Nginx 대신 실제 경로(브라우저 → Vercel / Render → Supabase)와 구간별 방어·근거·알려진 한계를 정리 — 증거: `docs/jm-architecture.md`
- 검증: SQL 테스트 5개 파일(core·appearance·tarot·매트릭스·감사 로그) 로컬 PGlite에서 모두 통과, 서버 테스트 36개 통과

## B. 사용자가 직접 한 일
- 위임: "이제 너가 다 해줘"로 남은 작업 진행을 맡김
- 실제 DB 적용 승인과 Supabase 대시보드 로그인 (비밀번호 입력은 사용자가 직접)

## C. AI 판단과 달리 사용자가 결정한 일
- 없음

## 결과와 배운 점
- 결과
  - 실제 Supabase 적용(같은 날, 지민 로그인 후 함께 진행): 먼저 읽기 전용 조회로 상태 확인 → appearance·tarot은 이미 적용돼 있어서 감사 로그 migration만 실행. 이어서 커밋 `3563ca8`의 검증 SQL(감사 로그·권한 매트릭스)을 GitHub 원본 그대로 불러와 실제 DB에서 실행해 둘 다 통과. 끝나고 다시 조회해서 테스트 사용자 0명, 감사 로그 0건, 감사 트리거 3개, 기존 프로필 2명 그대로임을 확인(검증이 흔적을 남기지 않음)
  - 감사 로그 첫 실제 기록: 시연용 사장님 계정(비밀번호는 사용자가 직접 입력해 생성)을 SQL Editor에서 정류장 분식 사장님으로 지정 → `role_change`, `actor_db = postgres`, `{"role":"pilgrim","shop_id":null} → {"role":"owner","shop_id":"shop_hj_snack"}`로 남는 것을 확인
  - 서버의 로그인 시도 제한은 main에 병합되고 Render가 다시 배포해야 적용됨
- 배운 점
  - "막혔다"를 증명하려면, 일부러 구멍을 냈을 때 테스트가 실패하는지까지 봐야 한다. 안 그러면 아무것도 검사하지 않는 테스트도 통과한다.
  - 프록시를 하나 끼우면 뒤쪽 서비스가 보는 IP가 바뀐다. IP 기반 방어는 "누구의 IP를 보고 있나"부터 확인해야 한다.
  - SECURITY DEFINER 안에서는 `current_user`가 바뀐다. 감사 기록에서 "누가"를 잘못 남기기 쉬운 지점이다.
