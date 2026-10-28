# =============================================================
# boot_tour.py — 첫 화면 둘러보기 28초 일정의 Python 판 (scripts/anatomy/rack/tour.mjs 와 같은 식)
# -------------------------------------------------------------
# 일정 숫자(plan·stopsPlan)는 그림 빌드(build.mjs)가 tour.mjs 에서 boot-layout.json 으로 옮겨 씀
#   → 사진 영상(boot-photos.py)이 그림과 같은 순간에 같은 모습 (그림 말풍선·부품 찾기가 사진 위에서도 맞음)
# bpy 없이 돌아감: python3 scripts/blender/boot_tour.py → 몇 순간의 값을 JSON 으로 찍음 (그림 JS 값과 대조용)
# =============================================================
import json
import os

LINEAR = ('rzoom', 'gzoom')   # 확대는 시간에 정비례 (보이는 범위 계산이 smoothstep 으로 감쌈) — tour.mjs 의 LINEAR


def ease(q):
    """0 → 1 을 천천히 출발해 천천히 멈추게 (smootherstep)"""
    x = min(1.0, max(0.0, q))
    return x * x * x * (x * (x * 6 - 15) + 10)


def track_at(lst, u, linear):
    """한 값의 [시작, 끝, 방향] 목록을 u 초에서 계산"""
    v = 0.0
    for a, b, d in lst:
        q = min(1.0, max(0.0, (u - a) / (b - a)))
        v += d * (q if linear else ease(q))
    return min(1.0, max(0.0, v))


def focus_at(u, S, stops):
    """돋보기 중심 (fx, fy), 짚는 부품 번호 (확대 구간 밖이면 -1), 그 부품으로 옮겨 가는 시간 (초)"""
    i = min(sum(1 for m in S['moves'] if u >= m), len(stops) - 1)
    fx, fy = stops[i]['fx'], stops[i]['fy']
    glide = S['glide'][max(0, i - 1)]
    if i > 0:
        a, q = stops[i - 1], ease((u - S['moves'][i - 1]) / glide)
        fx, fy = a['fx'] + (fx - a['fx']) * q, a['fy'] + (fy - a['fy']) * q
    return fx, fy, (i if S['from'] <= u < S['to'] else -1), glide


def tour_at(t, lay):
    """둘러보기 t 초의 모습 (lay = boot-layout.json). 키 이름은 tour.mjs 의 tourAt 과 같음"""
    tour = lay['tour']
    u = t % tour
    if u < 0:
        u += tour
    v = {key: track_at(lst, u, key in LINEAR) for key, lst in lay['plan'].items()}
    rfx, rfy, rs, rg = focus_at(u, lay['stopsPlan']['rack'], lay['rack']['stops'])
    gfx, gfy, gs, gg = focus_at(u, lay['stopsPlan']['gpu'], lay['gpu']['stops'])
    return {
        'pull': v['pull'], 'lift': v['lift'], 'rheat': v['rheat'], 'gheat': v['gheat'],
        'rk': v['rzoom'], 'rfx': rfx, 'rfy': rfy, 'rs': rs, 'rg': rg,
        'gk': v['gzoom'], 'gfx': gfx, 'gfy': gfy, 'gs': gs, 'gg': gg,
    }


if __name__ == '__main__':   # 대조용: 1/8초마다 한 바퀴
    here = os.path.dirname(os.path.abspath(__file__))
    lay = json.load(open(os.path.join(here, 'boot-layout.json'), encoding='utf-8'))
    print(json.dumps([tour_at(i / 8, lay) for i in range(int(lay['tour'] * 8))]))
