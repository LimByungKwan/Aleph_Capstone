"""커플 타로 그래프 직접 돌려 보기 (담당: 병관) — 서버·화면 없이 터미널에서

    .venv/Scripts/python try_tarot.py                 # 두 사람 답을 무작위로 골라서 결과 보기
    .venv/Scripts/python try_tarot.py --seed demo     # 같은 seed면 같은 카드
    .venv/Scripts/python try_tarot.py --ask           # 두 사람 답을 직접 입력 (1~4)
    .venv/Scripts/python try_tarot.py --why           # RAG가 조언을 고른 점수 이유까지 보기

답은 저장하지 않음. 요금 0원 (LLM 안 부름).
"""

from __future__ import annotations

import argparse
import random
import sys

from app.tarot import load_questions, read_tarot


def ask_person(label: str, partner: str) -> dict:
    name = input(f"\n{label} 별명 (엔터 = {label}): ").strip() or label
    picks = {"self": [], "guess": []}
    for i, q in enumerate(load_questions(), 1):
        opts = "  ".join(f"{n}) {o}" for n, o in enumerate(q["options"], 1))
        print(f"\n[{name} {i}/10] {opts}")
        for part, text in (("self", q["self"]), ("guess", q["guess"].replace("{partner}", partner))):
            while True:
                raw = input(f"  {text} > ").strip()
                if raw.isdigit() and 1 <= int(raw) <= len(q["options"]):
                    picks[part].append(int(raw) - 1)
                    break
                print(f"  1~{len(q['options'])} 중에 골라 주세요")
    return {"name": name, **picks}


def random_person(name: str, rng: random.Random) -> dict:
    qs = load_questions()
    return {"name": name, "self": [rng.randrange(len(q["options"])) for q in qs], "guess": [rng.randrange(len(q["options"])) for q in qs]}


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # 윈도우 터미널에서 한글·이모지가 깨지지 않게
    sys.stdin.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="커플 타로 그래프 돌려 보기")
    parser.add_argument("--seed", help="같은 값이면 같은 카드·대화 질문")
    parser.add_argument("--ask", action="store_true", help="두 사람 답을 직접 입력")
    parser.add_argument("--why", action="store_true", help="RAG 점수 이유 보기")
    parser.add_argument("--poison", action="store_true", help="첫 카드 조언에 금지어를 넣어 guard 반복 보기")
    parser.add_argument("--poison-all", action="store_true", help="모든 조언에 금지어를 넣어 fallback 보기")
    args = parser.parse_args()

    if args.ask:
        a = ask_person("A", "B")
        print("\n— 화면을 넘겨 주세요 —")
        b = ask_person("B", a["name"])
    else:
        rng = random.Random()
        a, b = random_person("민지", rng), random_person("준호", rng)

    if args.poison or args.poison_all:
        # 이 실행에서만 데이터를 바꿈 (파일은 그대로). 같은 카드로 비교하려고 seed를 고정
        import app.tarot as tarot_mod
        import app.tarot_rag as rag

        args.seed = args.seed or "try"
        tips = rag.load_tips()
        bad = {t["id"] for t in tips} if args.poison_all else {read_tarot(a, b, seed=args.seed)["cards"][0]["evidence"]}
        poisoned = [{**t, "text": t["text"] + " 결국 이별하게 돼요."} if t["id"] in bad else t for t in tips]
        rag.load_tips = lambda: poisoned
        if args.poison_all:
            tarot_mod.SAFE_ADVICE = "결국 이별해요."  # 기본 조언까지 걸리게 → fallback
        print(f"\n☠️ 일부러 금지어('이별')를 넣은 조언: {', '.join(sorted(bad)) if len(bad) < 5 else f'{len(bad)}개 전부'}")

    r = read_tarot(a, b, seed=args.seed)
    print("\n" + "=" * 50)
    print(f"🔮 {r['names']['a']} × {r['names']['b']}   일치도 {r['match']}%  (A가 맞힘 {r['hits']['a']}, B가 맞힘 {r['hits']['b']} / {r['hits']['total']})")
    print("=" * 50)
    if r["mismatches"]:
        print("\n🙈 서로 몰랐던 점")
        for m in r["mismatches"][:5]:
            print(f"  · {m['question']}  {m['about']}님 답: '{m['answer']}' / {m['guesser']}님 짐작: '{m['guessed']}'")
        if len(r["mismatches"]) > 5:
            print(f"  … 외 {len(r['mismatches']) - 5}개")
    print(f"\n🧭 focus (RAG 검색 순서): {', '.join(r['focus']) or '없음'}")
    print("\n🃏 카드")
    for c, ev in zip(r["cards"], r["evidence"]):
        print(f"  {c['emoji']} [{c['positionName']}] {c['name']}{' (역방향)' if c['reversed'] else ''}")
        print(f"     {c['reading']}")
        if args.why:
            print(f"     ↳ RAG 1순위 {ev['tipId']} 점수 {ev['score']}: {', '.join(ev['why'])} / 실제로 쓴 조언: {c['evidence']}")
    print("\n🛡️ guard (해석 검사)")
    for log in r["guard"]["log"]:
        if log["problems"]:
            parts = "; ".join(f"{p['part']} → {', '.join(p['words'])}" for p in log["problems"])
            print(f"  {log['try'] + 1}번째: ❌ 걸림 ({parts}) → 다시 조합")
        else:
            print(f"  {log['try'] + 1}번째: ✅ 통과")
    if r["guard"]["fallback"]:
        print("  → 2번 다시 해도 걸려서 fallback (카드 키워드로 만든 기본 문장)")
    m = r["mission"]
    print(f"\n🗺️ 데이트 미션: {m['name']} ({m['zoneName']}) — {m['text']}")
    print("\n💬 오늘 나눠 볼 질문")
    for t in r["talk"]:
        print(f"  · {t['text']}")
    print(f"\n📝 요약 ({len(r['summary'])}자)\n  {r['summary']}")
    print(f"\n🔁 다시 보기: .venv/Scripts/python try_tarot.py --seed {r['seed']}" + (" (답은 무작위라 일치도는 달라짐)" if not args.ask else ""))


if __name__ == "__main__":
    main()
