"""
find_equipment.py — 현장 사진(드론·회사 사진)에서 설비 "후보"를 찾아 번호 붙인 그림과 목록을 만드는 보조 도구
-------------------------------------------------------------------------------------------------
모델 (Hugging Face, 둘 다 Apache-2.0):
  google/owlv2-base-patch16-ensemble — 글로 준 이름("crane", "truck" …)마다 상자를 찾는 열린 어휘 검출
  facebook/sam2.1-hiera-small        — 상자마다 윤곽(마스크)을 따서 사진 속 면적 비율을 잼 (--masks)
결과는 "후보"일 뿐: 사람이 그림을 보고 맞는 번호만 골라 data/observations.json 에 숫자로 적음
  (검출기는 비슷한 모양을 헷갈리고, 겹친 설비를 하나로 셀 수 있음 — 숫자를 그대로 사이트에 쓰지 않음)
사진 저작권: 회사·제3자 사진은 분석만 하고 저장소에 넣지 않음. 결과 그림도 --out 폴더(저장소 밖)에만 씀

사용법:
  python scripts/vision/find_equipment.py 사진.jpg [사진2.jpg …] --out /tmp/vision \
      [--labels "crane,truck,construction trailer,electrical transformer"] [--threshold 0.2] [--masks]
필요한 것: scripts/vision/requirements.txt (torch, torchvision, transformers>=4.56, pillow)
  pip install -r scripts/vision/requirements.txt  — 모델은 처음 실행 때 Hugging Face 에서 받음(OWLv2 약 0.6GB, SAM 2.1 small 약 0.2GB)
"""
import argparse, json
from pathlib import Path

import torch
from PIL import Image, ImageDraw, ImageFont
from transformers import Owlv2ForObjectDetection, Owlv2Processor

DEFAULT_LABELS = ['crane', 'excavator', 'truck', 'construction trailer', 'shipping container',
                  'electrical transformer', 'electrical substation', 'diesel generator', 'cooling tower', 'wind turbine']
COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080']


def iou(a, b):
    x1, y1, x2, y2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area = lambda r: (r[2] - r[0]) * (r[3] - r[1])
    return inter / (area(a) + area(b) - inter + 1e-9)


def nms(dets, thr=0.5):
    """같은 이름끼리 많이 겹치는 상자는 점수가 높은 하나만 남김"""
    keep = []
    for d in sorted(dets, key=lambda d: -d['score']):
        if all(k['label'] != d['label'] or iou(k['box'], d['box']) < thr for k in keep):
            keep.append(d)
    return keep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('images', nargs='+')
    ap.add_argument('--out', required=True)
    ap.add_argument('--labels', default=','.join(DEFAULT_LABELS))
    ap.add_argument('--threshold', type=float, default=0.2)
    ap.add_argument('--masks', action='store_true', help='SAM 2.1 로 상자마다 윤곽 면적을 잼')
    a = ap.parse_args()
    labels = [x.strip() for x in a.labels.split(',') if x.strip()]
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    device = 'mps' if torch.backends.mps.is_available() else 'cuda' if torch.cuda.is_available() else 'cpu'
    proc = Owlv2Processor.from_pretrained('google/owlv2-base-patch16-ensemble')
    owl = Owlv2ForObjectDetection.from_pretrained('google/owlv2-base-patch16-ensemble').to(device).eval()
    sam = None
    if a.masks:
        from transformers import Sam2Model, Sam2Processor
        sam_proc = Sam2Processor.from_pretrained('facebook/sam2.1-hiera-small')
        sam = Sam2Model.from_pretrained('facebook/sam2.1-hiera-small').to(device).eval()
    for path in a.images:
        img = Image.open(path).convert('RGB')
        inputs = proc(text=[labels], images=img, return_tensors='pt').to(device)
        with torch.no_grad():
            res = owl(**inputs)
        # OWLv2 는 사진을 정사각형으로 채워 넣고 봄 → 결과 좌표를 원래 크기로 되돌리려면 긴 변 기준 크기를 줌
        side = max(img.size)
        # transformers 5 이름 (4.x 는 post_process_object_detection)
        post_fn = getattr(proc, 'post_process_grounded_object_detection', None) or proc.post_process_object_detection
        post = post_fn(outputs=res, threshold=a.threshold, target_sizes=torch.tensor([[side, side]], device=device))[0]
        dets = [{'label': labels[int(l)], 'score': round(float(s), 3), 'box': [round(float(v), 1) for v in b]}
                for s, l, b in zip(post['scores'], post['labels'], post['boxes'])]
        dets = nms(dets)
        if sam and dets:
            sin = sam_proc(images=img, input_boxes=[[d['box'] for d in dets]], return_tensors='pt').to(device)
            with torch.no_grad():
                so = sam(**sin, multimask_output=False)
            masks = sam_proc.post_process_masks(so.pred_masks.cpu(), sin['original_sizes'].cpu())[0]
            for d, m in zip(dets, masks):
                d['mask_area_pct'] = round(float(m[0].float().mean()) * 100, 3)
        # 번호 붙인 그림 (사람이 보고 맞는 번호를 고르는 용도)
        draw = ImageDraw.Draw(img)
        font = ImageFont.load_default(size=max(14, img.width // 80))
        for i, d in enumerate(dets, 1):
            c = COLORS[labels.index(d['label']) % len(COLORS)]
            draw.rectangle(d['box'], outline=c, width=3)
            draw.text((d['box'][0] + 3, d['box'][1] + 2), f"{i} {d['label']} {d['score']:.2f}", fill=c, font=font)
            d['n'] = i
        stem = Path(path).stem
        img.save(out / f'{stem}-candidates.jpg', quality=85)
        counts = {}
        for d in dets:
            counts[d['label']] = counts.get(d['label'], 0) + 1
        (out / f'{stem}-candidates.json').write_text(json.dumps({
            'image': str(path), 'status': '사람 확인 전 — 후보일 뿐',
            'models': ['google/owlv2-base-patch16-ensemble'] + (['facebook/sam2.1-hiera-small'] if sam else []),
            'threshold': a.threshold, 'counts': counts, 'detections': dets}, ensure_ascii=False, indent=1))
        print(f'{stem}: 후보 {len(dets)}개', counts)


if __name__ == '__main__':
    main()
