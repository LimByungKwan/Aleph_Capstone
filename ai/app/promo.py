"""사장님 홍보문구 만들기 (POST /promo) — 요금 0원 템플릿 방식.

가게 정보(이름·연결 작품·대표 메뉴·쿠폰 혜택) + 초대할 손님(target) + 분위기(tone)로
SNS 캡션 3안 + 해시태그 + (선택) 15초 릴스 대본을 만든다.
문장 조각을 무작위로 섞어서, [다시 만들기]를 누를 때마다 조금씩 다른 문구가 나온다.

팀 규칙 (기획 > 차별화 전략): 배우 실명·작품 대사 인용·로고 금지, 가상 작품·가상 가게만.
→ 입력과 결과를 check_rules()로 검사해서 warnings로 알려 준다 (프론트 promoRules.js와 같은 규칙).
"""

from __future__ import annotations

import random
import re

# ── 분위기(tone) ─────────────────────────────────
TONES: dict[str, dict] = {
    "warm": {
        "label": "따스한 감성형",
        "tag": "감성 폭발 힐링형",
        "open": [
            "골목 끝, 그 장면이 머물던 자리",
            "천천히 걷다 보면 만나는 작은 쉼표",
            "드라마 속 계절이 아직 남아 있는 곳",
            "노을이 골목을 물들이는 시간",
            "촬영지 산책의 마지막 페이지",
            "조용히 마음이 놓이는 창가 자리",
        ],
        "close": [
            "오늘은 여기서 잠깐 쉬어 가요. 🌸",
            "그날의 공기를 한 잔에 담았어요. ☕",
            "당신의 장면도 이곳에서 시작돼요. 🎞️",
            "천천히, 머물다 가세요. 🍃",
            "오늘의 기억을 예쁘게 남겨 드릴게요. 📷",
        ],
    },
    "bright": {
        "label": "유쾌한 위트형",
        "tag": "위트 발랄형",
        "open": [
            "발걸음이 멈추는 아늑한 골목!",
            "스탬프 찍고 왔다면 여기로 GO",
            "촬영지 순례 끝? 이제 쉴 차례!",
            "인증샷 명소 옆 숨은 맛집 발견!",
            "다리 아플 타이밍에 딱 나타나는 곳",
            "순례 코스의 마지막 보스(?)는 여기",
        ],
        "close": [
            "같이 오면 즐거움도 두 배예요 ✨",
            "인증샷 찍고 쿠폰 쓰고! 📸",
            "지금 바로 놀러 오세요 🙌",
            "안 오면 서운할지도? 😆",
            "스탬프 다 모으셨죠? 그럼 출발! 🏃",
        ],
    },
    "plain": {
        "label": "담백한 안내형",
        "tag": "깔끔 정보형",
        "open": [
            "촬영지 근처 조용한 가게입니다.",
            "골목 산책 중 들르기 좋은 곳입니다.",
            "촬영지에서 걸어서 1분 거리입니다.",
            "순례 코스 중간에 쉬어 가기 좋은 가게입니다.",
            "촬영지 바로 옆에 있습니다.",
        ],
        "close": [
            "편하게 들러 주세요.",
            "스탬프 쿠폰 사용 가능합니다.",
            "영업시간에 맞춰 방문해 주세요.",
            "포장도 가능합니다.",
        ],
    },
}

# ── 초대할 손님(target) ─────────────────────────────
TARGETS: dict[str, dict] = {
    "couple": {
        "label": "봄날을 거니는 연인들",
        "lines": [
            "둘이 나란히 앉기 좋은 창가 자리가 기다려요.",
            "데이트 코스의 마무리로 딱 좋아요.",
            "함께 찍은 인증샷을 보여 주시면 더 반갑게 맞을게요.",
        ],
        "tags": ["#데이트코스", "#커플여행"],
    },
    "traveler": {
        "label": "골목길을 산책하는 힐링 여행자",
        "lines": [
            "걷다 지친 다리를 쉬어 가기 좋은 곳이에요.",
            "혼자 와도 편한 조용한 자리가 있어요.",
            "다음 촬영지로 가기 전 잠깐 숨 고르기 좋아요.",
        ],
        "tags": ["#골목여행", "#혼자여행"],
    },
    "worker": {
        "label": "지친 하루 끝에 쉬고픈 직장인",
        "lines": [
            "퇴근길에 잠깐 들러 하루를 내려놓으세요.",
            "바쁜 하루 끝, 따뜻한 한 잔이 기다려요.",
            "점심시간에 빠르게 다녀가기도 좋아요.",
        ],
        "tags": ["#퇴근길힐링", "#직장인휴식"],
    },
}

DEFAULT_TONE = "warm"
DEFAULT_TARGET = "traveler"

# ── 팀 규칙 검사 (frontend/src/components/boss/promoRules.js와 같은 규칙) ──
RULES = [
    (re.compile(r"[\"“”'‘’『][^\"“”'‘’『』]{10,}[\"“”'‘’』]"), "작품 대사를 인용한 것 같아요. 대사는 빼고 분위기만 표현해 주세요."),
    (re.compile(r"배우\s*[가-힣]{2,4}|[가-힣]{2,4}\s*배우"), '배우 실명은 쓸 수 없어요. "주인공", "두 사람"처럼 바꿔 주세요.'),
    (re.compile(r"로고|logo|방송사\s*마크|ⓒ|©", re.IGNORECASE), "방송사·작품 로고는 쓸 수 없어요."),
]


def check_rules(*texts: str | None) -> list[str]:
    joined = "\n".join(t for t in texts if t)
    return [message for pattern, message in RULES if pattern.search(joined)]


def _work_name(work_title: str) -> str:
    """'드라마 「여름이 머무는 정류장」' → '「여름이 머무는 정류장」'"""
    return re.sub(r"^(드라마|영화|웹드라마|애니메이션)\s*", "", work_title.strip())


def _tagify(text: str) -> str:
    """해시태그용: 괄호·따옴표·장르·공백 제거"""
    text = re.sub(r"[「」『』\"'()\[\]#]", "", text or "")
    text = re.sub(r"드라마|영화|웹드라마|애니메이션", "", text)
    return re.sub(r"\s+", "", text).strip()


def generate_promo(
    shop_name: str,
    work_title: str = "",
    offer: str = "",
    menu: str = "",
    target: str = DEFAULT_TARGET,
    tone: str = DEFAULT_TONE,
    include_reels: bool = False,
    seed: int | None = None,
) -> dict:
    """{ captions[3], hashtags[], reels|None, tag, warnings[], source }"""
    rng = random.Random(seed)
    t = TONES.get(tone, TONES[DEFAULT_TONE])
    who = TARGETS.get(target, TARGETS[DEFAULT_TARGET])
    shop = shop_name.strip()
    work = f"{_work_name(work_title)} 촬영지" if work_title.strip() else "촬영지"
    perk = f"스탬프 쿠폰으로 {offer.strip()} 혜택도 드려요." if offer.strip() else ""
    item = f"대표 메뉴는 {menu.strip()}." if menu.strip() else ""

    opens = rng.sample(t["open"], 3)
    # 쿠폰 혜택 문장이 이미 있으면 "쿠폰 사용 가능" 같은 맺음말은 빼서 같은 말이 두 번 안 나오게
    close_pool = [c for c in t["close"] if not (perk and "쿠폰" in c)]
    closes = rng.sample(close_pool, 3)
    lines = rng.sample(who["lines"], len(who["lines"]))

    # 세 안은 강조점이 다르게: ① 작품·촬영지 ② 메뉴 ③ 손님
    middles = [
        f"{work} 산책 뒤에 들르기 좋아요.",
        item or f"{work}에서 걸어서 금방이에요.",
        lines[0],
    ]
    captions = []
    for i in range(3):
        opening = opens[i].rstrip(".!")
        parts = [f"{opening}, {shop}." if tone != "plain" else f"{shop}, {opens[i]}", middles[i]]
        if i == 0 and tone != "plain":
            parts.append(lines[1])
        parts += [perk, closes[i]]
        captions.append(" ".join(p for p in parts if p))

    hashtags = [f"#{_tagify(shop)}"]
    if work_title.strip():
        hashtags.append(f"#{_tagify(work_title)}")
    hashtags += ["#촬영지투어", *who["tags"], "#SceneWalk"]
    if offer.strip():
        hashtags.append("#스탬프쿠폰")
    if menu.strip():
        hashtags.append(f"#{_tagify(menu)}")
    hashtags = list(dict.fromkeys(h for h in hashtags if len(h) > 1))  # 빈 태그·중복 제거

    reels = None
    if include_reels:
        reels = "\n".join(
            [
                "[0~3초] 골목 입구에서 천천히 걸어 들어가는 뒷모습",
                f"[3~7초] {work} 표지판 앞에서 스탬프 찍는 손",
                f"[7~11초] {shop} 문을 여는 장면 + 자막: {f'스탬프 쿠폰 {offer.strip()}' if offer.strip() else '오늘의 쉼표'}",
                f"[11~15초] {menu.strip() or '음료'} 클로즈업 → 가게 이름 자막으로 마무리",
            ]
        )

    warnings = check_rules(shop_name, work_title, offer, menu, *captions, reels)
    return {"captions": captions, "hashtags": hashtags, "reels": reels, "tag": t["tag"], "warnings": warnings, "source": "template"}
