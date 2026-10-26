"""
translate_titles.py — 뉴스 페이지 '언론' 탭의 영어 제목을 한국어로 기계 번역한 "후보"를 만듦
---------------------------------------------------------------------------------------
모델: kakaocorp/kanana-1.5-2.1b-instruct-2505 (Apache-2.0, Hugging Face)
  2026-10-26 에 opus-mt-tc-big-en-ko · Qwen3-1.7B 와 제목 50개로 비교해 고름 (한국어가 가장 자연스럽고 검사 통과가 가장 많음)
  transformers 5 는 이 모델 설정(head_dim 128)을 막아서 4.x 를 씀 (requirements.txt)
하는 일: public/data/news.json 의 언론 제목 중 아직 다루지 않은 것만 번역 → 후보 파일(--out)
  후보는 바로 쓰지 않음 — scripts/apply-translations.mjs 가 검사기(src/data/translateGuard.js)를 거쳐
  통과한 것만 public/data/news-ko.json 에 넣음 (숫자·금액이 틀린 번역은 버리고 영어 원문을 보임)
회사 발표(SEC) 제목은 공식 문장이라 오역 위험을 피하려고 번역하지 않음

사용법: python scripts/translate/translate_titles.py --out /tmp/ko-raw.json [--max 400]
"""
import argparse, json, sys, time
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

ROOT = Path(__file__).resolve().parents[2]
MODEL = 'kakaocorp/kanana-1.5-2.1b-instruct-2505'
REVISION = None  # 받을 때 판 번호를 고정하려면 commit 을 적음
SYSTEM = ('Translate the English financial news headline into one natural Korean headline. '
          'Copy every number, percentage, currency amount, unit and ticker exactly as it appears in the headline (do not convert units or currencies). '
          'Keep company names in their original Latin spelling. Do not add, remove or guess any information. Output only the Korean headline.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--max', type=int, default=400)
    a = ap.parse_args()
    news = json.loads((ROOT / 'public/data/news.json').read_text())
    ko_path = ROOT / 'public/data/news-ko.json'
    done = json.loads(ko_path.read_text()) if ko_path.exists() else {'items': {}, 'skipped': {}}
    seen = {**done.get('items', {}), **done.get('skipped', {})}
    # 아직 다루지 않았거나 제목이 바뀐 언론 기사만 (같은 id 라도 원문이 다르면 다시)
    todo = [i for i in news['press']['items'] if seen.get(i['id'], {}).get('src') != i['title']][:a.max]
    if not todo:
        Path(a.out).write_text(json.dumps({'model': MODEL, 'items': []}, ensure_ascii=False)); print('번역할 새 제목 없음'); return
    device = 'cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu'
    tok = AutoTokenizer.from_pretrained(MODEL, revision=REVISION)
    model = AutoModelForCausalLM.from_pretrained(MODEL, revision=REVISION, dtype=torch.float16 if device != 'cpu' else torch.float32).to(device).eval()
    out, t0 = [], time.time()
    for it in todo:
        msgs = [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': it['title']}]
        x = tok([tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)], return_tensors='pt').to(device)
        with torch.no_grad():
            y = model.generate(**x, max_new_tokens=96, do_sample=False)
        ko = tok.decode(y[0][x['input_ids'].shape[1]:], skip_special_tokens=True).strip().split('\n')[0].strip()
        out.append({'id': it['id'], 'src': it['title'], 'ko': ko})
    Path(a.out).write_text(json.dumps({'model': MODEL, 'items': out}, ensure_ascii=False, indent=1))
    print(f'후보 {len(out)}개 ({device}, {time.time() - t0:.0f}초)')


if __name__ == '__main__':
    sys.exit(main())
