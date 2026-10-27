"""
fetch_sentinel.py — 주소로 위치를 확인한 IREN 부지(지금 9곳) 주변을 Sentinel-2 위성 사진으로 한 달에 한 장씩 잘라 저장
  (2026-10-26 미국 4곳으로 시작 → 2026-10-28 캐나다 3곳·번디·바다호스 추가. 레드뱅크는 좌표가 지명 기준이라 뺌)
-----------------------------------------------------------------------------------------------
자료: 유럽 코페르니쿠스 Sentinel-2 L2A (무료·공개, 출처 표기 필수:
      "Contains modified Copernicus Sentinel data") — Microsoft Planetary Computer 의 공개 STAC 목록에서 찾음 (계정 불필요)
하는 일 (부지 × 달마다):
  1) 그 달의 장면 중 구름이 적은 후보를 찾고
  2) 부지 주변 4km 칸만 장면 분류(SCL) 띠로 읽어 "그 칸의" 구름·빈 곳·눈 비율을 재서 가장 깨끗한 장면을 고름
     (눈: 2026-10-28 캐나다 부지를 넣으며 추가 — 1~3월 사진이 눈에 덮여 하얘서 처음 사진과 비교할 수 없었음)
     (장면 전체 구름 % 는 부지와 상관없는 곳의 구름까지 세기 때문)
  3) 그 장면의 자연색(TCI, 10m) 띠에서 같은 칸만 읽어 400×400 JPEG 로 저장
결과: public/satellite/<부지>/<YYYY-MM>.jpg + public/data/satellite.json (목록 — 사진마다 네 귀퉁이 경도·위도 corners 도 적음:
      실제 지도에 사진을 겹칠 때 씀. 사진은 그 장면의 UTM 좌표로 자른 정사각형이라 경도·위도로는 살짝 기운 사각형)
      이미 받은 달은 다시 받지 않음 → 매달 돌리면 새 달만 늘어남 (.github/workflows/satellite.yml)

사용법: python scripts/satellite/fetch_sentinel.py [--from 2025-01] [--to 2026-10] [--sites childress,kiowa] [--corners-only] [--recheck-snow]
  --corners-only: 내려받지 않고 이미 있는 사진의 corners 만 채움 (장면 이름의 UTM 칸으로 계산)
  --recheck-snow: 눈 비율(snow)이 없는 기존 사진의 장면 분류를 다시 읽어 눈이 많으면 지움 → 그 달은 다시 찾음 (한 번만)
필요한 것: rasterio, numpy, pillow (pip install rasterio numpy pillow)
"""
import argparse, datetime as dt, json, sys, time, urllib.error, urllib.request
from pathlib import Path

import numpy as np
import rasterio
from rasterio.warp import transform as warp_transform
from rasterio.windows import from_bounds
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
UA = {'User-Agent': 'iren-3d research bot (github.com/KYC32/iren-3d)'}
STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search'
TOKEN = 'https://planetarycomputer.microsoft.com/api/sas/v1/token/sentinel-2-l2a'
HALF_M = 2000          # 부지 중심에서 사방 2km → 4km 칸
SIZE = 400             # 저장 크기 (px) — 10m 해상도 그대로 (4km ÷ 10m = 400)
SCL_BAD = {0, 1, 3, 8, 9, 10}   # 장면 분류: 0 빈 곳 · 1 불량 · 3 구름 그림자 · 8·9 구름 · 10 얇은 권운
MAX_BAD = 0.05         # 칸의 5% 넘게 구름·빈 곳이면 그 달은 건너뜀 (억지로 흐린 사진을 넣지 않음)
SCL_SNOW = 11          # 장면 분류: 11 눈·얼음
MAX_SNOW = 0.3         # 칸의 30% 넘게 눈이면 그 달은 건너뜀 (땅이 안 보여 변화를 비교할 수 없음)


def open_retry(req, timeout=90, tries=6):
    """요청이 많다(429)·서버 잠시 오류(5xx)면 기다렸다 다시 (2·4·8…초)"""
    for k in range(tries):
        try:
            return urllib.request.urlopen(req, timeout=timeout)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or k == tries - 1:
                raise
            wait = int(e.headers.get('Retry-After') or 2 ** (k + 1))
            print(f'    … {e.code}, {wait}초 쉼', file=sys.stderr)
            time.sleep(wait)


def post_json(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={**UA, 'Content-Type': 'application/json'})
    with open_retry(req) as r:
        return json.loads(r.read())


# 공개 서명 토큰: 모음(sentinel-2-l2a) 하나에 한 번 받아 만료 전까지 모든 사진에 다시 씀
#   (예전엔 사진마다 서명을 받아 서명 서비스가 429 로 막았음)
_token = {'value': None, 'until': 0.0}


def signed(href):
    """Planetary Computer 의 공개 자료 주소에 임시 서명(토큰)을 붙임 — 계정 없이 받을 수 있게 하는 공개 서비스"""
    if not _token['value'] or time.time() > _token['until'] - 120:
        with open_retry(urllib.request.Request(TOKEN, headers=UA), timeout=60) as r:
            t = json.loads(r.read())
        _token['value'] = t['token']
        exp = t.get('msft:expiry', '')
        _token['until'] = dt.datetime.fromisoformat(exp.replace('Z', '+00:00')).timestamp() if exp else time.time() + 1800
    return f"{href}?{_token['value']}"


def window_of(src, lng, lat):
    """경도·위도 중심의 4km 칸 → 그 래스터 좌표계의 읽기 창"""
    xs, ys = warp_transform('EPSG:4326', src.crs, [lng], [lat])
    x, y = xs[0], ys[0]
    return from_bounds(x - HALF_M, y - HALF_M, x + HALF_M, y + HALF_M, transform=src.transform)


def utm_crs_of_scene(scene_id):
    """장면 이름의 MGRS 칸(예: ..._T14SLD_...) → UTM 좌표계 (14 = 영역 번호, S = 위도 띠: N~X 북반구 · C~M 남반구)"""
    tile = next(p for p in scene_id.split('_') if len(p) == 6 and p[0] == 'T')
    zone, band = int(tile[1:3]), tile[3]
    return f'EPSG:{32600 + zone if band >= "N" else 32700 + zone}'


def corners_of(crs, lng, lat):
    """window_of 와 같은 4km 칸의 네 귀퉁이 → [[경도, 위도] × 4] (왼쪽 위 → 오른쪽 위 → 오른쪽 아래 → 왼쪽 아래)
    maplibre 이미지 소스의 coordinates 순서와 같음"""
    xs, ys = warp_transform('EPSG:4326', crs, [lng], [lat])
    x, y = xs[0], ys[0]
    cx = [x - HALF_M, x + HALF_M, x + HALF_M, x - HALF_M]
    cy = [y + HALF_M, y + HALF_M, y - HALF_M, y - HALF_M]
    lo, la = warp_transform(crs, 'EPSG:4326', cx, cy)
    return [[round(o, 6), round(t, 6)] for o, t in zip(lo, la)]


def month_range(a, b):
    y, m = map(int, a.split('-')); y2, m2 = map(int, b.split('-'))
    while (y, m) <= (y2, m2):
        yield f'{y:04d}-{m:02d}'
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


def best_scene(lng, lat, month):
    """그 달의 후보 장면 중 부지 칸이 가장 깨끗한 것 (없으면 None)"""
    y, m = map(int, month.split('-'))
    end = (dt.date(y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1)).isoformat()
    res = post_json(STAC, {
        'collections': ['sentinel-2-l2a'], 'intersects': {'type': 'Point', 'coordinates': [lng, lat]},
        'datetime': f'{month}-01/{end}', 'query': {'eo:cloud_cover': {'lt': 40}}, 'limit': 8,
        'sortby': [{'field': 'properties.eo:cloud_cover', 'direction': 'asc'}],
    })
    best = None
    for f in res.get('features', [])[:6]:
        bad, snow = scl_fractions(f, lng, lat)
        if bad > MAX_BAD or snow > MAX_SNOW:
            continue
        if best is None or bad + snow < best[1] + best[2]:
            best = (f, bad, snow)
        if bad == 0 and snow == 0:
            break
    return best


def scl_fractions(f, lng, lat):
    """장면 하나의 부지 칸에서 (구름·빈 곳 비율, 눈 비율)"""
    with rasterio.open(signed(f['assets']['SCL']['href'])) as src:
        scl = src.read(1, window=window_of(src, lng, lat), boundless=True, fill_value=0)
    return float(np.isin(scl, list(SCL_BAD)).mean()), float((scl == SCL_SNOW).mean())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--from', dest='start', default='2025-01')
    ap.add_argument('--to', dest='end', default=dt.date.today().strftime('%Y-%m'))
    ap.add_argument('--sites', default='')
    ap.add_argument('--corners-only', action='store_true')
    ap.add_argument('--recheck-snow', action='store_true')
    a = ap.parse_args()
    iren = json.loads((ROOT / 'data/companies/iren.json').read_text())
    # 위치 근거(research.json locations)가 '주소·확인됨'인 부지만 — 지역·지명 기준 좌표면 4km 칸이 엉뚱한 땅을 찍을 수 있음
    research = json.loads((ROOT / 'data/research.json').read_text())
    verified = {l['site'] for l in research['locations'] if l.get('level') == 'address' and l.get('review') == 'verified'}
    sites = [s for s in iren['sites'] if s['id'] in verified and (not a.sites or s['id'] in a.sites.split(','))]
    man_path = ROOT / 'public/data/satellite.json'
    man = json.loads(man_path.read_text()) if man_path.exists() else {'images': []}
    have = {(i['site'], i['month']) for i in man['images']}
    def save():   # 사진마다 목록을 바로 씀 → 중간에 끊겨도 받은 것은 남음
        man['images'].sort(key=lambda i: (i['site'], i['month']))
        man.update({
            'checked': dt.date.today().isoformat(), 'size_px': SIZE, 'box_km': HALF_M * 2 / 1000,
            'source': {'name': 'Copernicus Sentinel-2 L2A (Microsoft Planetary Computer)', 'url': 'https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a',
                       'attribution': 'Contains modified Copernicus Sentinel data (2025–2026)'},
        })
        man_path.write_text(json.dumps(man, ensure_ascii=False, indent=1) + '\n')

    # 이미 있는 사진의 네 귀퉁이 채우기 (내려받기 없음 — 장면 이름의 UTM 칸으로 계산)
    coord_of = {s['id']: s['coord'] for s in iren['sites']}
    for img in man['images']:
        c = coord_of.get(img['site'])
        if c and 'corners' not in img:
            img['corners'] = corners_of(utm_crs_of_scene(img['scene']), c['lng'], c['lat'])
    if a.corners_only:
        save(); print(f'✅ satellite.json — corners 채움, 모두 {len(man["images"])}장'); return

    # 기존 사진의 눈 비율 다시 재기 (눈 검사를 넣기 전에 받은 사진) — 눈이 많으면 사진과 목록에서 지우고 아래에서 그 달을 다시 찾음
    if a.recheck_snow:
        keep = []
        for img in man['images']:
            c = coord_of.get(img['site'])
            if 'snow' in img or not c or (a.sites and img['site'] not in a.sites.split(',')):
                keep.append(img); continue
            try:
                with open_retry(urllib.request.Request(f"{STAC.rsplit('/search', 1)[0]}/collections/sentinel-2-l2a/items/{img['scene']}", headers=UA)) as r:
                    f = json.loads(r.read())
                _, snow = scl_fractions(f, c['lng'], c['lat'])
            except Exception as e:
                print(f'  ! {img["site"]} {img["month"]}: {e}', file=sys.stderr); keep.append(img); continue
            if snow > MAX_SNOW:
                (ROOT / 'public' / img['src'].lstrip('/')).unlink(missing_ok=True)
                print(f'  - {img["site"]} {img["month"]}: 눈 {snow:.0%} → 지움')
                continue
            img['snow'] = round(snow, 4); keep.append(img)
        man['images'] = keep
        have = {(i['site'], i['month']) for i in man['images']}
        save()

    added = 0
    for s in sites:
        lng, lat = s['coord']['lng'], s['coord']['lat']
        for month in month_range(a.start, a.end):
            if (s['id'], month) in have:
                continue
            try:   # 한 달이 실패해도 나머지는 계속 (다음 실행에서 다시 시도)
                pick = best_scene(lng, lat, month)
                if not pick:
                    print(f'  - {s["id"]} {month}: 깨끗한 장면 없음'); continue
                f, bad, snow = pick
                with rasterio.open(signed(f['assets']['visual']['href'])) as src:
                    rgb = src.read([1, 2, 3], window=window_of(src, lng, lat), boundless=True, fill_value=0, out_shape=(3, SIZE, SIZE))
                    corners = corners_of(src.crs, lng, lat)
            except Exception as e:
                print(f'  ! {s["id"]} {month}: {e}', file=sys.stderr); continue
            out = ROOT / 'public/satellite' / s['id'] / f'{month}.jpg'
            out.parent.mkdir(parents=True, exist_ok=True)
            Image.fromarray(np.moveaxis(rgb, 0, -1)).save(out, quality=78, optimize=True, progressive=True)
            man['images'].append({'site': s['id'], 'month': month, 'date': f['properties']['datetime'][:10],
                                  'scene': f['id'], 'bad': round(bad, 4), 'snow': round(snow, 4), 'src': f'/satellite/{s["id"]}/{month}.jpg', 'corners': corners})
            added += 1
            save()
            print(f'  + {s["id"]} {month}: {f["properties"]["datetime"][:10]} 칸 구름·빈 곳 {bad:.1%} · 눈 {snow:.1%}')
    save()
    print(f'✅ satellite.json — 새 사진 {added}장, 모두 {len(man["images"])}장')


if __name__ == '__main__':
    main()
