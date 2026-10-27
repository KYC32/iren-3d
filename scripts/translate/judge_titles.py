"""
judge_titles.py — 기계 번역의 뜻 판정: 영어 제목과 한국어 번역이 같은 말을 하는지 더 큰 모델에게 묻고 점수를 매김
---------------------------------------------------------------------------------------------------
모델: Qwen/Qwen3-4B-Instruct-2507 (Apache-2.0, Hugging Face, 판 고정) — 번역은 하지 않고 판정만
  묻는 말: "같은 주체가 같은 일을 하는가, 오르내림·원인과 결과·이름이 같고 더하거나 뺀 주장이 없는가 → yes/no"
  점수 judge = 첫 답 글자가 'yes' 일 확률 (0~1). apply-translations.mjs --judge 가 JUDGE_MIN(0.5) 보다 낮으면 뺌
2026-10-28 시험 (규칙 검사를 통과한 Kanana 번역 110개, 사람이 뜻을 대조해 표시한 것과 비교):
  뜻이 틀린 10개 중 4개를 잡고('Double Upgrade' → '두 배 성장', 'Information Technology' → '핀테크' 등)
  바른 번역 100개는 하나도 버리지 않음. 다국어 문장 모델(bge-m3) 유사도는 하나도 못 잡았고, Qwen3-1.7B 는 1개만 잡음
대상: public/data/news-ko.json 에 들어 있지만 아직 점수가 없는 번역 (새로 들어온 것) — 실행마다 --max 개까지
  못 다 하면 다음 실행 때 이어서 함. 점수가 없는 번역도 규칙 검사는 통과했으므로 화면에는 보임 (판정이 실패해도 지금보다 나빠지지 않음)
메모리: 판정 모델을 bf16(약 8GB)으로 올림 — GitHub Action 의 CPU 기계(16GB)에서도 들어감

사용법: python scripts/translate/judge_titles.py --out /tmp/judge.json [--max 20]
"""
import argparse, json, sys, time
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

ROOT = Path(__file__).resolve().parents[2]
MODEL = 'Qwen/Qwen3-4B-Instruct-2507'
REVISION = 'cdbee75f17c01a7cc42f958dc650907174af0554'   # 판 고정 (2026-10-28 시험한 판)
SYSTEM = ('You check Korean translations of English financial news headlines. '
          'Answer "yes" only if the Korean headline says the same thing as the English one: the same subject doing the same thing, '
          'the same direction (up/down), the same cause and effect, the same people, companies and outlets, and no added or missing claims. '
          'Small changes in wording or style are fine. Otherwise answer "no". Answer with one word: yes or no.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--max', type=int, default=20)
    a = ap.parse_args()
    ko = json.loads((ROOT / 'public/data/news-ko.json').read_text())
    todo = [(k, v) for k, v in ko['items'].items() if 'judge' not in v][:a.max]
    if not todo:
        Path(a.out).write_text(json.dumps({'model': MODEL, 'scores': {}})); print('판정할 새 번역 없음'); return
    device = 'cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu'
    tok = AutoTokenizer.from_pretrained(MODEL, revision=REVISION)
    model = AutoModelForCausalLM.from_pretrained(MODEL, revision=REVISION, dtype=torch.bfloat16).to(device).eval()
    yes = [tok.encode(w, add_special_tokens=False)[0] for w in ('yes', 'Yes')]
    no = [tok.encode(w, add_special_tokens=False)[0] for w in ('no', 'No')]
    scores, memo, t0 = {}, {}, time.time()
    for k, v in todo:
        key = (v['src'], v['ko'])
        if key not in memo:   # 같은 원문·번역 쌍은 한 번만
            msgs = [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': f"English: {v['src']}\nKorean: {v['ko']}"}]
            x = tok([tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)], return_tensors='pt').to(device)
            with torch.no_grad():
                p = torch.softmax(model(**x).logits[0, -1].float(), -1)
            y, n = p[yes].sum().item(), p[no].sum().item()
            memo[key] = round(y / (y + n + 1e-9), 4)
        scores[k] = memo[key]
    Path(a.out).write_text(json.dumps({'model': MODEL, 'scores': scores}, indent=1))
    low = sum(s < 0.5 for s in scores.values())
    print(f'판정 {len(scores)}개 · 낮은 점수 {low}개 ({device}, {time.time() - t0:.0f}초)')


if __name__ == '__main__':
    sys.exit(main())
