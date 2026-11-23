"""커플 타로 RAG (요금 0원 버전, 담당: 병관) — docs/bk-couple-tarot-plan.md 2장 "RAG"

뽑힌 카드마다 근거 문단(shared/bk_tarot/couple_tips.json)을 **태그·키워드 점수**로 찾는다.
임베딩·외부 API 없음 → Render 무료 서버 메모리로 충분하고 요금 0원, 같은 입력이면 항상 같은 결과.

점수 (높을수록 먼저):
- 두 사람이 서로 몰랐던 카테고리(focus) — 1등 +6, 2등 +5, 3등 +4 …  ← 두 사람 답이 근거를 고름
- 카드 tags(카테고리)와 같음 +3                                          ← 카드 의미가 근거를 고름
- 카드 keywords와 겹치는 키워드 1개당 +1
- when이 상황과 맞음: focus 카테고리의 'mismatch' 조언 +2 / 잘 맞힌 카테고리의 'match' 조언 +2 / 'any' +0
- 상황과 반대(잘 맞힌 카테고리에 'mismatch' 조언 등)는 -3
카드 3장이 같은 문단을 쓰지 않게, 앞 카드가 쓴 문단·카테고리는 다음 카드에서 피함.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

CANDIDATES = 4  # 카드마다 guard 재시도용 후보 조언 수
DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "shared" / "bk_tarot"


@lru_cache(maxsize=None)
def load_data(name: str) -> dict:
    """shared/bk_tarot/<name> 읽기 (화면과 같이 쓰는 파일). TAROT_DATA_DIR로 위치를 바꿀 수 있음"""
    data_dir = Path(os.environ.get("TAROT_DATA_DIR", DEFAULT_DATA_DIR))
    with open(data_dir / name, encoding="utf-8") as f:
        return json.load(f)


def load_cards() -> list[dict]:
    return load_data("tarot_cards.json")["cards"]


def positions() -> dict[str, str]:
    return load_data("tarot_cards.json")["positions"]


def load_tips() -> list[dict]:
    return load_data("couple_tips.json")["tips"]


def category_names() -> dict[str, str]:
    return load_data("couple_tips.json")["categoryNames"]


def score_tip(tip: dict, card: dict, focus: list[str]) -> tuple[int, list[str]]:
    """(점수, 이유 목록) — 이유는 결과의 근거 표시·테스트용"""
    score = 0
    why: list[str] = []
    category = tip["category"]
    if category in focus:
        bonus = max(6 - focus.index(category), 1)
        score += bonus
        why.append(f"focus:{category}+{bonus}")
    if category in card["tags"]:
        score += 3
        why.append(f"card_tag:{category}+3")
    shared = sorted(set(tip.get("keywords", [])) & set(card.get("keywords", [])))
    if shared:
        score += len(shared)
        why.append("keyword:" + ",".join(shared) + f"+{len(shared)}")
    when = tip.get("when", "any")
    if when != "any":
        fits = (when == "mismatch") == (category in focus)
        score += 2 if fits else -3
        why.append(f"when:{when}{'+2' if fits else '-3'}")
    return score, why


def retrieve(drawn: list[dict], focus: list[str]) -> list[dict]:
    """뽑힌 카드마다 근거 문단 1개

    drawn: [{ id, position, reversed }]  →  [{ cardId, position, tip: { id, category, text }, score, why, candidates }]
    candidates = 점수 순 다음 후보 조언들 (guard에 걸리면 interpret가 다음 후보로 바꿔 씀)
    """
    cards = {c["id"]: c for c in load_cards()}
    tips = load_tips()
    used_tips: set[str] = set()
    used_categories: set[str] = set()
    out = []
    for pick in drawn:
        card = cards[pick["id"]]
        ranked = []
        for i, tip in enumerate(tips):
            if tip["id"] in used_tips:
                continue
            score, why = score_tip(tip, card, focus)
            if tip["category"] in used_categories:  # 세 장이 다 같은 이야기만 하지 않게
                score -= 4
                why.append("same_category-4")
            ranked.append((-score, i, tip, score, why))  # 점수 같으면 파일 순서
        ranked.sort(key=lambda r: (r[0], r[1]))
        _, _, tip, score, why = ranked[0]
        candidates = [{"id": r[2]["id"], "category": r[2]["category"], "text": r[2]["text"]} for r in ranked[:CANDIDATES]]
        used_tips.add(tip["id"])
        used_categories.add(tip["category"])
        out.append({
            "cardId": card["id"],
            "position": pick["position"],
            "tip": {"id": tip["id"], "category": tip["category"], "text": tip["text"]},
            "score": score,
            "why": why,
            "candidates": candidates,
        })
    return out


def talk_cards(categories: list[str], rng, count: int = 2, exclude: set[str] | frozenset = frozenset()) -> list[dict]:
    """커플문답 스타일 대화 질문 — 앞 카테고리(서로 몰랐던 것)부터 하나씩. rng로 같은 seed면 같은 질문
    exclude: guard에 걸린 질문 글 (다시 고를 때 뺌)"""
    pool = load_data("couple_tips.json")["talkCards"]
    out = []
    for category in dict.fromkeys(categories):  # 순서 유지 + 중복 제거
        options = [q for q in pool.get(category, []) if q not in exclude]
        if options and len(out) < count:
            out.append({"category": category, "text": rng.choice(options)})
    # 커플노트 주제(첫 만남·추억 / 버킷리스트 / 밸런스 게임) 중 하나에서 보너스 질문 1개
    extras = load_data("couple_tips.json").get("talkExtras", {})
    themes = [k for k in sorted(extras) if any(q not in exclude for q in extras[k]["questions"])]
    if themes:
        key = rng.choice(themes)
        theme = extras[key]
        text = rng.choice([q for q in theme["questions"] if q not in exclude])
        out.append({"category": key, "theme": theme["name"], "emoji": theme["emoji"], "text": text})
    return out
