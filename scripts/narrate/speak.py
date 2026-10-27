"""
speak.py — 내레이션 문장마다 Qwen3-TTS 목소리로 소리 조각을 만듦 (narrate.mjs 가 부름)
-------------------------------------------------------------------------------------------------
모델: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice (Apache-2.0, 약 2.5GB, 판 고정) — 처음 실행 때 Hugging Face 에서 받음
  목소리 'Sohee' = 따뜻한 한국어 여성 목소리 (모델에 들어 있는 9개 목소리 중 하나)
입력: <폴더>/lines.json = { "language": "Korean", "speaker": "Sohee", "lines": [{"say": "..."}, ...] }
출력: <폴더>/01.wav, 02.wav … (앞뒤 무음을 빼고 문장 사이 긴 쉼을 줄인 소리) + <폴더>/clips.json = { "sr": 24000, "durations": [초, ...] }
같은 문장·목소리는 다시 만들지 않음 → <폴더>/cache/<해시>.wav 에 모델이 만든 소리를 그대로 저장
  (다듬기는 매번 cache 에서 새로 하므로 PAD·MAX_PAUSE 를 바꿔도 다시 만들 필요 없음)

직접 실행: python scripts/narrate/speak.py video/narration/ko
필요한 것: scripts/narrate/requirements.txt (README '영상 만들기' 참고)
"""
import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf

MODEL = 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice'
REVISION = '85e237c12c027371202489a0ec509ded67b5e4b5'   # 판 고정 (모델이 바뀌어도 같은 소리)
PAD = 0.04          # 무음을 자른 뒤 앞뒤에 남길 여유(초) — 말머리·말끝이 잘리지 않게
TOP_DB = 35         # 가장 큰 소리보다 이만큼(dB) 작으면 무음으로 봄
MAX_PAUSE = 0.3     # 문장 사이 쉼의 최대 길이(초) — 모델이 마침표 뒤에 1초 넘게 쉬기도 해서 줄임


def tidy(y, sr):
    """앞뒤 무음을 자르고, 말 사이 쉼이 MAX_PAUSE 보다 길면 줄임
    (모델은 앞에 약 1초, 뒤에 약 0.8초 무음을 붙이고 마침표 뒤에 1초 넘게 쉬기도 함)
    쉼을 줄일 때는 쉼의 앞쪽 절반과 뒤쪽 절반을 이어 붙여 말끝·말머리의 숨소리를 남김"""
    import librosa
    parts = librosa.effects.split(y, top_db=TOP_DB)
    if len(parts) == 0:
        return y
    pad, keep = int(PAD * sr), int(MAX_PAUSE * sr)
    out = [y[max(0, parts[0][0] - pad):parts[0][1]]]
    for (_, prev_end), (start, end) in zip(parts[:-1], parts[1:]):
        gap = y[prev_end:start]
        out.append(gap if len(gap) <= keep else np.concatenate([gap[:keep // 2], gap[-(keep - keep // 2):]]))
        out.append(y[start:end])
    out.append(y[parts[-1][1]:min(len(y), parts[-1][1] + pad)])
    return np.concatenate(out)


def main():
    folder = Path(sys.argv[1])
    spec = json.loads((folder / 'lines.json').read_text(encoding='utf-8'))
    lang, speaker = spec['language'], spec['speaker']
    cache = folder / 'cache'
    cache.mkdir(parents=True, exist_ok=True)
    model = None
    durations, sr = [], 24000
    for i, line in enumerate(spec['lines'], 1):
        key = hashlib.sha1(f'{MODEL}@{REVISION}|{lang}|{speaker}|{line["say"]}'.encode()).hexdigest()[:16]
        cached = cache / f'{key}.wav'
        if not cached.exists():
            if model is None:   # 새로 만들 줄이 있을 때만 모델을 불러옴 (불러오기만 1분쯤)
                import torch
                from qwen_tts import Qwen3TTSModel
                dev = 'mps' if torch.backends.mps.is_available() else 'cuda:0' if torch.cuda.is_available() else 'cpu'
                t = time.time()
                model = Qwen3TTSModel.from_pretrained(MODEL, revision=REVISION, device_map=dev, dtype=torch.float32)
                print(f'모델 불러옴 ({dev}, {time.time() - t:.0f}초)', flush=True)
            import torch
            torch.manual_seed(int(key, 16) % 2**31)   # 같은 문장이면 같은 소리 (뽑기 방식이라 씨앗을 문장으로 정함)
            t = time.time()
            wavs, sr = model.generate_custom_voice(text=line['say'], language=lang, speaker=speaker)
            sf.write(cached, np.asarray(wavs[0], dtype=np.float32), sr)   # 다듬기 전 그대로 저장
            print(f'  #{i} 만듦 ({time.time() - t:.0f}초 걸림) {line["say"]}', flush=True)
        raw, sr = sf.read(cached, dtype='float32')
        y = tidy(raw, sr)
        print(f'  #{i} {len(raw) / sr:.2f}초 → 다듬어 {len(y) / sr:.2f}초', flush=True)
        sf.write(folder / f'{i:02d}.wav', y, sr)
        durations.append(round(len(y) / sr, 3))
    (folder / 'clips.json').write_text(json.dumps({'sr': sr, 'durations': durations}, ensure_ascii=False), encoding='utf-8')
    print(f'소리 조각 {len(durations)}개 · 합계 {sum(durations):.1f}초')


if __name__ == '__main__':
    main()
