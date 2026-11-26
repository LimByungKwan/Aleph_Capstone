"""경복궁 현장 해설: 장소 필터 → 한국어 문자 n-gram 검색 → 근거 기반 생성."""
import json
import os
import re
from functools import lru_cache
from pathlib import Path

import openai

from .limits import take_llm_call
from .llm_pick import DEFAULT_MODEL, _get_client, llm_enabled


@lru_cache(maxsize=1)
def records():
    path = Path(__file__).resolve().parents[2] / "frontend/src/data/palaceEvidence.json"
    return json.loads(path.read_text(encoding="utf-8-sig"))


def grams(text):
    return {word[i:i+2] for word in re.findall(r"[가-힣a-z0-9]+", text.lower())
            for i in range(max(1, len(word)-1))}


def retrieve(spot, query):
    candidates = [doc for doc in records() if doc["spot"] == spot]
    tokens = grams(query)
    def relevance(doc):
        return 3 * len(tokens & grams(doc["title"])) + len(tokens & grams(doc["text"]))
    return max(candidates, key=relevance, default=None) if candidates else None


def quiz_for(doc):
    answer = doc["answer"]
    sentence = next(line for line in doc["text"].split(". ") if answer in line)
    options = doc["distractors"].copy()
    index = sum(map(ord, doc["id"])) % 3
    options.insert(index, answer)
    return {"question": "해설 속 빈칸에 들어갈 말은 무엇일까요? " + sentence.replace(answer, "〔　〕").rstrip(".") + ".",
            "choices": options, "answer": index, "hint": "해설을 다시 읽고 당시 장소나 역할을 떠올려 보세요.",
            "explanation": doc["text"]}


@lru_cache(maxsize=16)
def generate(doc_id, title, evidence):
    # 예산 소진·통신 실패는 캐시하지 않아 다음 요청에서 복구할 수 있다.
    if not llm_enabled() or not take_llm_call():
        raise ValueError("generation unavailable")
    response = _get_client().with_options(timeout=9, max_retries=0).chat.completions.create(
        model=os.environ.get("LLM_MODEL", DEFAULT_MODEL),
        messages=[{"role": "system", "content": "한국 궁궐 역사 해설사입니다. 주어진 근거만으로 관람객에게 현장에서 이야기를 들려주듯 한국어 두세 문장으로 설명하세요. 새로운 인물, 날짜, 대화, 감정, 전설, 촬영 사실은 추가하지 마세요. 정답이 포함된 근거의 핵심 사실을 유지하세요."},
                  {"role": "user", "content": json.dumps({"주제": title, "근거": evidence}, ensure_ascii=False)}],
        max_completion_tokens=400,
    )
    choice = next(iter(response.choices), None)
    if not choice or choice.finish_reason != "stop" or not choice.message.content:
        raise ValueError("incomplete narration")
    return choice.message.content.strip()


def episode(doc):
    try:
        narration = generate(doc["id"], doc["title"], doc["text"])
        mode = "ai"
    except (ValueError, openai.APIError):
        narration, mode = doc["text"], "archive"
    return {"narration": narration, "mode": mode, "evidenceId": doc["id"], "quiz": quiz_for(doc)}
