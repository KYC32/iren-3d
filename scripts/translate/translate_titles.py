"""
translate_titles.py — 뉴스 페이지 영어 제목을 한국어로 기계 번역한 "후보"를 만듦
---------------------------------------------------------------------------------------
모델: kakaocorp/kanana-1.5-2.1b-instruct-2505 (Apache-2.0, Hugging Face)
  2026-10-26 에 opus-mt-tc-big-en-ko · Qwen3-1.7B 와 제목 50개로 비교해 고름 (한국어가 가장 자연스럽고 검사 통과가 가장 많음)
  2026-10-28 에 Qwen3-4B-Instruct-2507 과 언론 제목 183개로 다시 비교: Qwen 이 규칙 검사는 더 많이 통과했지만(133 대 110)
    통과분 중 뜻이 틀린 것도 더 많아서(약 20 대 10, 'Too Pessimistic' → '낙관적이지 않다' 같은 반대 뜻) 바꾸지 않음
  transformers 5 는 이 모델 설정(head_dim 128)을 막아서 4.x 를 씀 (requirements.txt)
대상: 언론 제목만. 회사 발표(SEC) 헤드라인은 번역하지 않음
  2026-10-28 시험: 규칙·뜻 판정을 통과한 회사 헤드라인 33개 중 약 8개가 뜻이 틀렸음
  (고객사 'Poolside' → '수영장 옆', 재무제표 'Restatement'(정정) → '재검토' 등) — 공식 문장의 오역은 투자자를 오해하게 해서 뺌
  서식 이름으로 만든 회사 발표 제목('Current report (8-K)')은 화면이 한국어 이름('수시 보고서(8-K)')을 붙임
하는 일: public/data/news.json 의 제목 중 아직 다루지 않은 것만 번역 → 후보 파일(--out)
  후보는 바로 쓰지 않음 — scripts/apply-translations.mjs 가 검사기(src/data/translateGuard.js)를 거쳐
  통과한 것만 public/data/news-ko.json 에 넣음 (숫자·금액·이름이 틀린 번역은 버리고 영어 원문을 보임)
  그다음 judge_titles.py 가 뜻 판정 점수를 매기고 apply-translations.mjs --judge 가 낮은 것을 뺌

사용법: python scripts/translate/translate_titles.py --out /tmp/ko-raw.json [--max 400] [--redo]
  --redo: 이미 다룬 제목도 다시 번역 (지시문·모델을 바꿨을 때 한 번)
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
# 고유명사 표 (검사기와 같은 파일 src/data/translateNames.json) — 지시문에 "이 이름은 그대로" 목록을 붙임
#   2026-10-27: 'IREN Limited' → 'IREN 제한회사', 'Applied Digital' → '적용 디지털' 같은 오역이 많아서 넣음
NAMES = json.loads((ROOT / 'src/data/translateNames.json').read_text())['names']
SYSTEM += (' Never translate the meaning of a name. Write "IREN Limited" and "IREN Ltd." simply as "IREN". '
           'Keep these names exactly as written: ' + ', '.join(n['en'] for n in NAMES if not n['en'].startswith('IREN')) + '.')


def pool_of(news):
    """번역 대상: 언론 제목 전부 (회사 발표 헤드라인은 위 설명대로 뺌)"""
    return news['press']['items']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--max', type=int, default=400)
    ap.add_argument('--redo', action='store_true')
    a = ap.parse_args()
    news = json.loads((ROOT / 'public/data/news.json').read_text())
    ko_path = ROOT / 'public/data/news-ko.json'
    done = json.loads(ko_path.read_text()) if ko_path.exists() else {'items': {}, 'skipped': {}}
    seen = {**done.get('items', {}), **done.get('skipped', {})}
    # 아직 다루지 않았거나 제목이 바뀐 것만 (같은 id 라도 원문이 다르면 다시) · --redo 면 전부
    todo = [i for i in pool_of(news) if a.redo or seen.get(i['id'], {}).get('src') != i['title']][:a.max]
    if not todo:
        Path(a.out).write_text(json.dumps({'model': MODEL, 'items': []}, ensure_ascii=False)); print('번역할 새 제목 없음'); return
    device = 'cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu'
    tok = AutoTokenizer.from_pretrained(MODEL, revision=REVISION)
    model = AutoModelForCausalLM.from_pretrained(MODEL, revision=REVISION, dtype=torch.float16 if device != 'cpu' else torch.float32).to(device).eval()
    out, memo, t0 = [], {}, time.time()
    for it in todo:
        if it['title'] not in memo:   # 같은 제목(다른 기사 번호)은 한 번만 번역
            msgs = [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': it['title']}]
            x = tok([tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)], return_tensors='pt').to(device)
            with torch.no_grad():
                y = model.generate(**x, max_new_tokens=96, do_sample=False)
            memo[it['title']] = tok.decode(y[0][x['input_ids'].shape[1]:], skip_special_tokens=True).strip().split('\n')[0].strip()
        out.append({'id': it['id'], 'src': it['title'], 'ko': memo[it['title']]})
    Path(a.out).write_text(json.dumps({'model': MODEL, 'items': out}, ensure_ascii=False, indent=1))
    print(f'후보 {len(out)}개 · 번역 {len(memo)}번 ({device}, {time.time() - t0:.0f}초)')


if __name__ == '__main__':
    sys.exit(main())
