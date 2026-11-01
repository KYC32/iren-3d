#!/usr/bin/env python3
# =============================================================
# bake-terrain.py — 캠퍼스 주변의 실제 고도를 작은 격자 파일로 굽는 도구
#   Mapterhorn 지형 타일(Terrarium webp)을 받아, 3D 장면 땅에 쓸 격자(JSON)를 만듭니다.
#   브라우저가 외부 타일을 부르지 않도록 빌드 전에 한 번만 돌려서 결과 파일을 커밋합니다.
#   필요: python3 + Pillow + numpy
#   사용: python3 scripts/bake-terrain.py childress 34.38532 -100.04734 38.9 2100 src/scene/terrain/childress.json
#         (이름 위도 경도 칸당_미터 반폭_미터 출력파일)
# =============================================================
import io, json, math, sys, urllib.request
import numpy as np
from PIL import Image

UA = 'iren-3d research bot (github.com/KYC32/iren-3d)'
ZOOM, TILE, COLS = 13, 512, 65   # 원본 화소 약 8 m · 격자 65칸 (장면 지형 1칸 약 65 m)

name, lat, lng, m_per_unit, half_m, out = sys.argv[1], *map(float, sys.argv[2:6]), sys.argv[6]

# 위도·경도 → 타일 번호 (소수까지)
n = 2 ** ZOOM
tile_x = (lng + 180) / 360 * n
tile_y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
m_per_px = 40075016.7 * math.cos(math.radians(lat)) / (n * TILE)
radius_px = half_m / m_per_px

# 필요한 타일만 받아 이어 붙임
x0, x1 = int(tile_x - radius_px / TILE), int(tile_x + radius_px / TILE)
y0, y1 = int(tile_y - radius_px / TILE), int(tile_y + radius_px / TILE)
mosaic = np.zeros(((y1 - y0 + 1) * TILE, (x1 - x0 + 1) * TILE), dtype=np.float32)
for x in range(x0, x1 + 1):
    for y in range(y0, y1 + 1):
        req = urllib.request.Request(f'https://tiles.mapterhorn.com/{ZOOM}/{x}/{y}.webp', headers={'User-Agent': UA})
        rgb = np.array(Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert('RGB')).astype(np.float32)
        # Terrarium 인코딩: 고도(m) = R×256 + G + B/256 − 32768
        mosaic[(y - y0) * TILE:(y - y0 + 1) * TILE, (x - x0) * TILE:(x - x0 + 1) * TILE] = rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768

# 부지 중심 주변을 잘라 격자로 줄임 (BOX = 칸 안 화소의 평균이라 잡음이 사라짐)
cx, cy = (tile_x - x0) * TILE, (tile_y - y0) * TILE
box = (cx - radius_px, cy - radius_px, cx + radius_px, cy + radius_px)
grid = np.array(Image.fromarray(mosaic, mode='F').resize((COLS, COLS), Image.BOX, box=box))

# 가장 낮은 곳을 0 으로 (장면 바닥보다 땅이 내려가면 가려지므로 위로만 솟게) · 0.1 m 단위 정수로 저장
low = float(grid.min())
json.dump({
    'site': name, 'cols': COLS, 'half_m': half_m, 'm_per_unit': m_per_unit,
    'base_m': round(low, 1), 'dm': [round((v - low) * 10) for v in grid.ravel().tolist()],
}, open(out, 'w'), separators=(',', ':'))
print(f'{name}: 고도 {low:.1f}-{float(grid.max()):.1f} m → {out}')
