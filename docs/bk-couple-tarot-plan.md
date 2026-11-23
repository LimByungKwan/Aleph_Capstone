# 병관(BK) — 커플 타로 MVP 구현 계획

> 11/23 팀 회의 + 튜터 피드백 정리. **지금까지 만든 코드 위에** 어떻게 얹을지 정리한 문서.
> 결론: 질문 카드에 두 사람이 답한 내용으로 타로를 풀이하는 기능. **LangGraph가 흐름을 맡고, RAG는 그 안의 한 단계로 해석 근거를 찾는다.**

---

## 1. 이미 있는 것 → 그대로 다시 쓰기

| 계획에 필요한 것 | 이미 있는 코드 | 어떻게 쓰나 |
|---|---|---|
| LangGraph 뼈대 | `ai/app/course.py` (understand → pick → validate → order → reply, 한 줄짜리) | 같은 방식으로 `ai/app/tarot.py` 새 그래프를 만든다. 이번엔 **병렬·분기·루프**가 들어감 |
| 가드레일 | `ai/app/safety.py` (욕설·패드립·자해 규칙) | 두 사람이 직접 쓴 답에 먼저 돌림. **해석 문장 검사용 규칙**(단정·부정 표현)을 새로 추가 |
| 응답 속도 (튜터: "1분은 치명적") | 커밋 `ab39213` AI 서버 미리 깨우기 | 이미 해 둠. 타로 API도 같은 서버라 같이 깨어남. 남은 것: 결과 캐싱, 기다리는 동안 카드 뒤집기 연출 |
| 맵 미션 장소 | `shared/places.json`의 BK 장소 5곳 (벽화 골목, 카페 소란, 전망대, 소원 분수, 인형뽑기) + `bk_coinToss.jsx`, `bk_clawMachine.jsx` | 카드마다 미션 장소를 연결 (예: 별 → 소원 분수 동전 던지기) |
| "다음 방문 때 지난번과 비교" | `frontend/src/store/lumiMemory.js` (localStorage 방문 기억) | 같은 방식으로 `tarotStore.js`에 지난 카드 저장 |
| 배지 | `frontend/src/store/badges.js` | "첫 타로" 배지 하나 추가 |
| 인증샷 | `frontend/src/components/photo/` | 결과 화면에서 "카드 들고 인증샷" 연결 (여유 있으면) |
| 시작 지점 | `frontend/src/components/course/LumiCourse.jsx` (루미 대화창, BK 담당) | 루미 대화창에 **[🔮 커플 타로]** 버튼 → 공유 파일 안 건드리고 시작 가능 |

---

## 2. LangGraph 흐름 (`ai/app/tarot.py`)

```
            START
           /     \
  [analyze_a]   [analyze_b]      ← 병렬: 각자 답 정리 + safety.py 검사
           \     /
          [compare]              ← state 합치기: 일치도(%), 서로 잘못 알던 점
              |
           [draw]                ← 메이저 아르카나 22장 중 3장 (과거·현재·다음 데이트), 정/역방향
              |
          [retrieve]             ← RAG: 카드 의미 + 두 사람 답의 카테고리로 근거 문단 찾기
              |
         [interpret]  ◀───────┐  ← 해석 문장 만들기
              |               │
           [guard] ── 실패 ───┘  ← 단정·부정 표현이면 다시 (최대 2번)
              |    └ 2번 다 실패 → 안전한 기본 문장
          [mission]              ← 카드 → BK 맵 장소 + 실제로 해 볼 데이트 행동
              |
            END  → 결과 화면 + localStorage 저장
```

**면접에서 "왜 LangGraph?" 답:** 병렬 입력(A·B), 상태 합치기(compare), 조건 분기(guard 통과/실패), 재시도 루프(interpret ↔ guard), 이게 한 줄 함수 호출로는 지저분해진다.
**"왜 RAG?" 답:** 카드 의미를 매번 지어내면 같은 카드도 해석이 달라진다. 근거 DB에서 찾아 쓰면 일관되고, 없는 의미를 만들지 않는다.

### 질문 카드 방식 (비교가 가능하게)
- 질문은 **객관식** 10개 (자유 입력 X → 비교가 확실하고 요금 0원)
- 각 질문에 두 번 답함: **"나는?"** + **"상대는 뭐라고 할까?"**
- `compare` 노드: A의 "나는" vs B의 "상대는" → 맞히면 일치, 틀리면 "서로 몰랐던 점"
- 질문은 **직접 만든다** (아트박스 책 질문은 참고만, 옮기지 않음 — 저작권)

### RAG (요금 0원 버전)
- 원천 데이터: `ai/data/tarot_cards.json` — 22장 × 정/역방향 × 위치(과거·현재·다음) 짧은 문단 + 태그
- 추가 근거: `ai/data/couple_tips.json` — 질문 카테고리(음식·여행·연락·싸움 등)별 조언 문단
- 검색: 카드 id + 두 사람 답에서 나온 카테고리 태그로 **키워드/태그 점수 검색** (순수 파이썬, 임베딩 X)
  - 이유: Render 무료 서버는 메모리가 작아서 임베딩 모델을 못 올리고, OpenAI 임베딩은 요금이 듦
  - 나중에 늘릴 때: 미리 계산한 임베딩을 JSON에 넣어 두는 방식으로 바꿀 수 있음
- 카드 의미 글은 **직접 쓴다** (책·사이트 문장 복사 X)

### guard 규칙 (`safety.py`에 추가)
- 막는 표현: "헤어질", "이별", "운명이 아니", "절대", "끝날", "맞지 않는 사이" 같은 **관계를 단정하는 말**
- 부정적인 카드(탑·죽음 등)는 "조언" 문장으로만 (예: "변화가 필요한 때 → 이번 데이트는 새로운 곳으로")
- 화면에 항상 **"재미로 보는 타로예요"** 안내

---

## 3. API

`POST /tarot`
```json
{
  "a": { "name": "민지", "self": [1,0,2,...], "guess": [1,1,2,...] },
  "b": { "name": "준호", "self": [...], "guess": [...] },
  "seed": "선택: 같은 결과 다시 보기용"
}
```
응답
```json
{
  "match": 70,
  "mismatches": [{ "question": "...", "aSays": "...", "bGuessed": "..." }],
  "cards": [{ "id": "star", "name": "별", "position": "next", "reversed": false, "reading": "..." }],
  "mission": { "placeId": "spot_bk_fountain", "text": "소원 분수에 동전을 함께 던져 보세요" },
  "source": "rules",
  "retries": 0
}
```

---

## 4. 두 사람 입력은 어떻게? (멀티플레이 없음)

지금 게임에는 실시간 2인 접속 기능이 없다. MVP는 **한 기기에서 번갈아 답하기** (A 답 → "폰을 건네주세요" 화면 → B 답).
서버 그래프는 그래도 A·B를 **병렬 노드**로 처리하니 LangGraph 근거는 그대로 남는다.
(링크 공유로 각자 폰에서 답하기는 DB가 필요해서 2단계로 미룸)

---

## 5. 저장 (DB 설계)

| 테이블 | 내용 | MVP |
|---|---|---|
| `question_cards` | 질문, 보기, 카테고리 | JSON 파일 (`ai/data/questions.json`) |
| `tarot_cards` | 카드 이름, 정·역방향 의미, 태그 (RAG 원천) | JSON 파일 |
| `answers` | session_id, 사람(A/B), question_id, self, guess | 저장 안 함 (요청에만 담김) |
| `readings` | 두 사람 이름, 카드, 해석, 미션, 날짜 | **localStorage** (`tarotStore.js`) |

- Render 무료 서버는 디스크가 잠들 때 지워져서 서버 파일 저장은 못 씀
- **결정 (11/23):** 지민 님 Supabase가 연결되면 `readings`를 Supabase로 옮긴다. 그 전까지는 localStorage

### Supabase로 옮길 때 고려할 것
1. **저장 함수 모양을 지금 정해 두기:** `saveReading(reading)` / `listReadings()`를 `tarotStore.js` 안에 두고, 지금은 localStorage, 나중엔 안쪽만 서버 호출로 바꾼다 (`client.js`가 mock/서버 두 모드를 같은 함수 모양으로 쓰는 방식과 같음). `client.js`는 공유 파일이라 옮길 때 팀과 합의
2. **누구의 기록인가:** 로그인은 한 사람만 함 → `owner_id`(로그인한 사람) + `partner_name`(글자). B가 계정이 없어도 됨. 두 계정 연결(커플 연결)은 나중 단계
3. **쓰기는 RPC로만:** 지민 님 DB 규칙 = 테이블에 직접 쓰지 않고 `SECURITY DEFINER` 함수로만. `save_reading` RPC 필요, 읽기는 RLS로 "내 것만"
4. **어느 서버가 DB에 쓰나:** AI 서버(Render, 파이썬)에는 Supabase 키를 넣지 않는다. AI 서버는 결과만 돌려주고(상태 없음 → 잠들어도 문제없음), 저장은 화면 → 지민 서버(`server/`) → RPC로 (로그인 토큰 그대로)
5. **중복 저장 막기:** 결과 화면에서 저장 버튼 두 번 눌림·재시도 → 화면에서 만든 `reading_id`(uuid)를 기본키로 써서 같은 요청은 한 번만 저장
6. **개인정보:** 답변은 연애 관련 민감한 내용 → 원본 답(`answers`)은 저장하지 않고 일치도·몰랐던 점 요약·카드·해석만. "기록 지우기" 버튼, 상대 이름은 별명 권장. 저장소가 public이라 seed에 실제 데이터 X
7. **결과 위조:** 화면이 결과를 보내므로 고칠 수 있음. 재미용이라 괜찮지만, 이걸로 배지·쿠폰을 주면 서버에서 다시 검증해야 함
8. **파일 위치:** `jm_core.sql`을 고치지 말고 새 파일 `supabase/migrations/<날짜>_bk_tarot.sql` + `supabase/tests/bk_tarot_test.sql`. 날짜는 한국 시간(`kst_today()` 재사용)
9. **localStorage 기록 옮기기:** 로그인 후 처음 한 번, 이 브라우저에 있던 기록을 올려 줄지 결정 (안 하면 지난 기록이 사라져 보임)
10. **시연 대비:** 11/30까지 Supabase 연결이 안 되면 localStorage로 시연 (서버가 없어도 기능이 동작해야 함)

---

## 6. 일정 (11/24 ~ 11/30)

| 상태 | 날짜 | 할 일 | 만들 파일 |
|---|---|---|---|
| ✅ 11/23 완료 | 11/24 | 질문 카드 10개 + 메이저 아르카나 22장 의미 글 | `ai/data/questions.json`, `ai/data/tarot_cards.json`, `ai/tests/test_tarot_data.py` |
| ⬜ (텐트·입구 11/23 완료) | 11/25 | 2인 답변 화면 (번갈아 답하기) | `bk_tarotBooth.jsx` 안내 화면을 질문 카드 화면으로 교체 |
| ⬜ | 11/26 | LangGraph 기초 + analyze_a/b 병렬 + compare | `ai/app/tarot.py`, `ai/tests/test_tarot.py` |
| ⬜ | 11/27 | draw + retrieve(RAG) + interpret | `ai/app/tarot_rag.py` |
| ⬜ | 11/28 | guard 재시도 루프 + mission 연결 | `ai/app/safety.py`(규칙 추가), `tarot.py` |
| ⬜ | 11/29 | 결과 저장·지난번 비교, 카드 뒤집기 연출, 배지 | `frontend/src/store/tarotStore.js`, `badges.js` |
| ⬜ | 11/30 | 사용성 테스트, 시연 준비 | `docs/bk-qa-pending.md` 갱신 |

카드 그림: 도트로 직접 그리거나, 처음엔 **이모지 + 카드 이름 + 색**으로 시작 (기존 덱 이미지 X).

---

## 7. 정한 것 / 남은 것

1. **해석 문장 (11/23 결정): 템플릿 기본 + OpenAI 스위치**
   - 기본은 템플릿 (`tarot_cards.json`의 직접 쓴 문장 조합) → 요금 0원, 항상 동작
   - `LLM_DAILY_LIMIT` ≥ 1이고 키가 있을 때만 OpenAI가 RAG 근거로 문장을 다듬음 → guard가 검사, 걸리면 다시 (최대 2번), 그래도 안 되면 템플릿
   - 실패·초과·느림 → 템플릿. 테스트는 실제 API 안 부름
   - Render에 키를 넣는 건 시연 당일 병관님이 직접 정함 (안 넣어도 템플릿으로 시연 가능)
2. **결과 저장 (11/23 결정):** 지금은 localStorage, Supabase 연결되면 옮김 (5장 참고)
3. **시작 지점 (11/23 결정·완료):** 데이트 코스 **입구 바로 안쪽**(소원 분수 광장 옆 잔디) **보라색 타로 텐트** (`tarot_booth`, 구역 좌표 [-34.5, 49], 입구는 들어오는 길 쪽 대각선). 처음엔 정원 안쪽이었는데, 메인 기능이라 들어오자마자 보이게 옮김
   - `frontend/src/game/Map/styles/bk_tarotBooth.jsx` (텐트 모양 + E키 + 안내 화면), `bk_activityStore.js`에 `tarot` 상태
   - 공유 파일은 `styles/index.js`에 스타일 이름 한 줄만 등록 (인형뽑기와 같은 방식)
