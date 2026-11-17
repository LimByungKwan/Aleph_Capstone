# SG(성근) 담당 설계 뼈대

> 상태: **뼈대**. 흐름과 제약만 적었습니다. `⟨SG⟩` 표시가 있는 곳(id, API 경로, 테이블, 내부 로직, 도구)은 SG가 정해진 범위 안에서 직접 정합니다.
> 목적: 포트폴리오용 캡스톤. 대회 준비작이 아니다.
> 근거: 「SceneWalk AI 한 장 기획서 (4인)」(2026-11-17), 배포 사이트 https://aleph-capstone.vercel.app/, 이 폴더의 코드

## 0. 확인한 사실

**기획서 기준**
- 맵: 가운데 광장(시작 지점, NPC 루미)에서 십자 큰길로 네 구역에 갑니다. **K-POP은 왼쪽 아래**입니다.
- 건물 높이 규칙은 6~12m입니다. 예외는 데이트 구역 전망대 하나입니다.
- 구역 파일: `frontend/src/game/data/zones/내코드_xxx.json` → SG는 `sg_kpop.json`. 같은 폴더의 `README.md`를 먼저 읽습니다.
- 서버: Node.js + Express + JWT(로그인·스탬프·쿠폰·**통계**)와 Python + FastAPI(AI)를 각각 Render에 둡니다. DB는 Supabase Postgres입니다.
- 4구역 맵 구조는 Day 2(11/17)에 배포 완료입니다.

**이 폴더(`Aleph_Capstone-SG`)의 상태**
- git 저장소가 아니고, `zones/` 폴더도 없습니다. 맵이 `buildings.json` 하나에 A~D 일자형으로 들어 있는 **구버전**입니다.
- 그래서 실제 작업은 GitHub Desktop으로 clone한 저장소에서 해야 합니다.

**코드 계약 (구버전 기준, 새 버전에서 다시 확인 필요)**
- 3D와 UI는 `gameStore`(zustand)로만 연결됩니다: `nearbyPlaceId`, `openPanel = { type, placeId }`, `open`, `close`
- 상호작용 지점의 `type`: `spot | cafe | npc`
- 3D 모델은 `"model": "/models/xxx.glb"`로 불러오고, 실패하면 코드로 그린 모양으로 대체합니다.

---

## 1. 담당 범위와 받는 일

```mermaid
flowchart LR
    BK["병관 BK<br/>전체 맵 통합<br/>캐릭터 이동·카메라 코드"]
    JM["지민 JM<br/>로그인·역할 JWT<br/>스탬프·쿠폰 API · Supabase"]
    HJ["혜진 HJ<br/>대화창 · 스탬프북<br/>사장님 화면"]

    subgraph SG["성근 SG"]
        direction TB
        Z["K-POP 구역 sg_kpop.json<br/>뮤비 골목 · 생일카페 · 굿즈샵"]
        CH["캐릭터 모델<br/>걷기·대기 애니메이션"]
        S["통계 API<br/>접속자 · 구역별 스탬프 · 쿠폰"]
        A["관리자 화면"]
        P["성능 최적화 · GLB 압축"]
        T["통합 테스트 · 시연 영상"]
    end

    BK -- "4구역 구조 · zones/README" --> Z
    BK -- "Player 코드에 모델 연결" --> CH
    JM -- "Express 서버 · 테이블 · JWT 역할" --> S
    JM -- "admin 역할" --> A
    HJ -- "UI 스타일" --> A
    S --> A
    Z --> T
    CH --> P
    A --> T
    P --> T
```

---

## 2. 전체 구조 속 내 위치

```mermaid
flowchart TB
    subgraph Vercel["Vercel · React + Vite + R3F"]
        Game["3D 맵<br/>광장 + 4구역"]
        Char["캐릭터 모델·애니메이션"]:::sg
        UI["대화창 · 스탬프북 · 사장님 화면"]
        Admin["관리자 화면"]:::sg
        Store["gameStore"]
        Game <--> Store <--> UI
        Char --- Game
    end

    subgraph R1["Render · Node.js + Express + JWT"]
        Auth["로그인·역할"]
        Stamp["스탬프·쿠폰"]
        Stats["통계"]:::sg
    end

    subgraph R2["Render · Python + FastAPI"]
        Guide["AI 가이드 LangGraph"]
        Promo["홍보문구 AI"]
    end

    DB[("Supabase Postgres")]

    UI --> Stamp
    UI --> Guide
    UI --> Promo
    Admin --> Stats
    Auth --> DB
    Stamp --> DB
    Stats --> DB

    classDef sg fill:#ffe1f0,stroke:#d6338a,stroke-width:2px
```

분홍색이 SG 담당입니다. 통계 API는 지민님 Express 서버 안에 들어갑니다.

---

## 3. K-POP 구역: 장소와 상호작용 흐름

```mermaid
flowchart LR
    subgraph KPOP["K-POP 구역 · 왼쪽 아래 · 가상 그룹 ⟨SG⟩"]
        MV["뮤비 촬영 골목<br/>id ⟨SG⟩ · type ⟨SG⟩"]
        BC["생일카페<br/>id ⟨SG⟩ · type ⟨SG⟩<br/>시연 스탬프"]
        GS["굿즈샵<br/>id ⟨SG⟩ · type ⟨SG⟩"]
    end

    Player(("캐릭터")) -- "센서 진입" --> N["nearbyPlaceId = id"]
    N -- "E키" --> O["openPanel = type, placeId"]
    O --> Dlg["혜진 대화창"]
    Dlg -- "스탬프 받기" --> API["지민 스탬프 API<br/>중복 획득 차단"]
    API --> Book["스탬프북<br/>3개면 카페 쿠폰"]
```

**제약 (정해진 범위)**
- 수정 가능한 파일은 `zones/sg_kpop.json` 하나입니다. 형식은 `zones/README.md`를 따릅니다.
- 건물 높이는 6~12m입니다.
- `type`을 새로 만들면 UI가 열 패널이 달라지므로 혜진님과 합의가 필요합니다.
- 실존 그룹, 곡, 로고는 쓰지 않습니다.

---

## 4. 통계 데이터 흐름

```mermaid
sequenceDiagram
    autonumber
    actor U as 순례객
    participant FE as 프론트
    participant EX as Express 서버
    participant DB as Supabase
    actor AD as 관리자

    U->>FE: 로그인 후 광장 입장
    FE->>EX: 접속 기록 ⟨SG: 경로·형식⟩
    EX->>DB: 저장 ⟨SG: 테이블·중복 처리⟩
    U->>FE: 생일카페 E → 스탬프
    FE->>EX: 스탬프 요청 지민
    EX->>DB: 스탬프 저장
    AD->>FE: 관리자 화면 열기
    FE->>EX: 통계 조회 + JWT ⟨SG: 경로⟩
    EX->>EX: admin 역할 확인
    EX->>DB: 집계 ⟨SG: 쿼리 로직⟩
    EX-->>FE: 접속자 · 구역별 스탬프 · 쿠폰 발급/사용
    FE-->>AD: 그래프 · 표
```

보여줄 숫자 후보(기획서): 일일 접속자 수, 구역별 스탬프 수, 쿠폰 발급·사용 수. 지민님과 15분 맞추기로 되어 있습니다.

---

## 5. 성능 최적화: 캐릭터와 GLB

```mermaid
flowchart LR
    Raw["원본 GLB<br/>캐릭터 · 건물"] --> M0["측정 전<br/>파일 크기 · FPS · 로딩 시간"]
    M0 --> C["압축<br/>도구·방식 ⟨SG⟩"]
    C --> Put["public/models/ 배치<br/>model 경로 연결"]
    Put --> M1["측정 후"]
    M1 --> R{"목표 ⟨SG⟩ 달성?"}
    R -- 아니오 --> C
    R -- 예 --> Doc["전후 수치 기록"]
```

캐릭터 모델은 걷기·대기 애니메이션이 필요합니다. 모델을 어디서 구할지, 라이선스는 어떤지 정해야 합니다.

---

## 6. 일정 (기획서 기준, Day 1 = 11/16)

```mermaid
timeline
    title SG 일정
    Day 2 11/17 : 개발 환경 · clone · 브랜치 sg/kpop-zone : sg_kpop.json에 건물 1개 : 가상 그룹 · 장소 공유 : 통계 숫자 지민과 합의
    Day 3 11/18 : 팀 목표 E키 스탬프 DB 저장 : K-POP 지점 배치
    Day 4 11/19 : 서버 3개 배포 : 통계 API
    Day 5 11/20 : 관리자 화면 동작 : 기능 동결
    Day 6 11/21 : 통합 테스트
    Day 7 11/22 : 백업 시연 영상 · 리허설
    Day 8 11/23 : 발표
```

캐릭터 모델과 GLB 압축은 Day 5 기능 동결 전에 할지 뒤에 할지 정해야 합니다. 성능 작업은 동결 뒤에도 할 수 있는지 팀 확인이 필요합니다.

---

## 7. 팀에 물어볼 것

1. 스탬프 테이블에 구역 정보가 있는지, 접속 기록용 테이블을 추가해도 되는지 (지민)
2. 관리자 역할을 JWT에서 어떻게 확인하는지 (지민)
3. 새 `type`을 쓰게 되면 UI 패널을 어떻게 처리할지 (혜진)
4. 관리자 화면 디자인을 사장님 화면과 맞출지 (혜진)
5. 캐릭터 모델을 Player 코드에 어떻게 연결할지 (병관)
6. 성능 최적화를 기능 동결 뒤에도 해도 되는지 (팀)
