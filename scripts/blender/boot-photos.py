# =============================================================
# boot-photos.py — 첫 화면(부팅) 그림의 "사진 모드": GB300 랙·B300 GPU 를 사진처럼 찍은 영상과 정지 사진
# -------------------------------------------------------------
# 그림(scripts/anatomy/rack/build.mjs · gpu.mjs)과 같은 숫자로 3D 장면을 세우고, 그림과 같은 투영(정사영)으로 찍어
# 사진이 그림과 픽셀 단위로 겹치게 합니다 → 웹은 그림을 투명하게 영상 위에 깔아 말풍선 자리·부품 찾기를 그대로 씀
#   숫자·투영: boot-layout.json (build.mjs 가 그림을 만들 때 함께 씀). 그림 안에 직접 적힌 작은 부품 숫자는 아래에 같은 값으로
#   움직임: 그림의 28초 둘러보기(build.mjs LIVE 의 tourAt·zoomer·settle)를 Python 으로 똑같이 흉내 냄
#     랙  0~14.5초: 트레이 꺼냄 → 돋보기 확대로 부품 4곳 → 넣음   GPU 14.5~28초: 냉각판·뚜껑 들림 → 기판 4곳 → 내려앉음
#     꼬리(트레이가 천천히 들어가고 냉각판이 다음 바퀴 초반까지 내려앉음)까지 맞추려고 두 바퀴를 흉내 내고 두 번째 바퀴를 찍음
#   열: 그림의 열 잉크 대신 GPU 냉각판 윗면·다이에 부하만큼 주황 빛 (같은 부하 곡선)
# 실행 (터미널, 백그라운드 Blender — 사용자의 Blender 창은 건드리지 않음):
#   Blender -b --factory-startup -P scripts/blender/boot-photos.py -- <rack|gpu> <frames|still|test> <저장 폴더> [가로 px] [샘플]
#     frames = 둘러보기 한 바퀴의 프레임(PNG, 장면이 그대로면 앞 프레임 복사), still = 다 연 정지 사진, test = 확인용 몇 장
#     at = 한 순간만 (6번째 인자 = 초), count = 렌더할 장 수만 셈
#   → scripts/blender/boot-video.mjs 가 영상(AV1·H.264)·포스터·정지 사진(AVIF)으로 줄여 public/boot/ 에
# 단위: 랙 그림 1 = 5 mm, GPU 그림 1 = 1 mm. 그림 좌표(x 오른쪽, y 앞쪽, z 위)를 Blender 에선 y 만 뒤집어 씀 (그림은 왼손 좌표계)
# =============================================================
import bpy
import json
import math
import os
import shutil
import sys
import time
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PANEL = ARGS[0] if len(ARGS) > 0 else "rack"
MODE = ARGS[1] if len(ARGS) > 1 else "test"
OUT = ARGS[2] if len(ARGS) > 2 else os.path.join(HERE, "out")
RES_X = int(ARGS[3]) if len(ARGS) > 3 else 1280
SAMPLES = int(ARGS[4]) if len(ARGS) > 4 else 48
AT = float(ARGS[5]) if len(ARGS) > 5 else 4.2      # at 모드: 찍을 둘러보기 시각(초)
# 이어 렌더·쉬어 가며 렌더 (환경 변수): 렌더가 중간에 끊겼을 때, 노트북이 너무 뜨거울 때
#   BOOT_FROM=338  → 이 번호보다 앞 프레임은 이미 있는 파일을 그대로 씀 (frames·count 모드)
#   BOOT_REST=4    → 한 장 렌더할 때마다 4초 쉼 (GPU 가 쉬는 동안 식음, 대신 오래 걸림)
FROM = int(os.environ.get("BOOT_FROM", "0"))
TO = int(os.environ.get("BOOT_TO", "100000"))      # BOOT_TO=143 → 이 번호까지만 (일부 구간만 다시 렌더·시험할 때)
LIST = {int(n) for n in os.environ.get("BOOT_LIST", "").split(",") if n.strip()}   # BOOT_LIST=10,50 → 이 번호들만 렌더 (점검용)
REST = float(os.environ.get("BOOT_REST", "0"))
FPS = 24
LAY = json.load(open(os.path.join(HERE, "boot-layout.json"), encoding="utf-8"))
L = LAY[PANEL]
TOUR = LAY["tour"]
S = 0.005 if PANEL == "rack" else 0.001    # 그림 1 단위 = 몇 m

for ob in list(bpy.data.objects):   # 기본 큐브·조명·카메라 지우기
    bpy.data.objects.remove(ob, do_unlink=True)
scene = bpy.context.scene
COL = scene.collection


def V(x, y, z):
    """그림 좌표 → Blender 좌표 (m, y 뒤집음)"""
    return Vector((x * S, -y * S, z * S))


# ---------- 재질 ----------
def lin(h):
    h = h.lstrip('#')
    return tuple((c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4) for c in [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def bsdf_of(m):
    return next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def mat(name, hexstr, rough=0.5, metal=0.0, emit=0.0, aniso=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = bsdf_of(m)
    c = lin(hexstr)
    b.inputs['Base Color'].default_value = (*c, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Anisotropic'].default_value = aniso
    b.inputs['Coat Weight'].default_value = coat
    if emit:
        b.inputs['Emission Color'].default_value = (*c, 1)
        b.inputs['Emission Strength'].default_value = emit
    return m


# 열 빛 색: 가장자리 검붉은 → 가운데 주황·호박색 (달궈진 금속처럼). 구리 색과 섞여도 '뜨거움'으로 읽히게
HEAT_RAMP = ((0.0, '#9e1f08'), (0.55, '#ff4d12'), (1.0, '#ffb24a'))


def hot(name, hexstr, rough, metal):
    """열 재질: 윗면(위를 보는 면)에만, 가운데가 더 밝고 노랗게 빛남. 세기는 'heat' 값 노드 (프레임마다 부하로 바꿈)
    빛은 카메라에만 보임 → 주변 판을 비추지 않음 (그림의 열 잉크처럼 그 면에만 칠한 효과)"""
    m = mat(name, hexstr, rough, metal)
    nt = m.node_tree
    b = bsdf_of(m)
    heat = nt.nodes.new('ShaderNodeValue'); heat.name = 'heat'; heat.outputs[0].default_value = 0.0
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Normal'], sep.inputs[0])
    top = nt.nodes.new('ShaderNodeMapRange')                      # 윗면 = 1, 옆면 = 0
    top.inputs['From Min'].default_value, top.inputs['From Max'].default_value = 0.8, 0.97
    nt.links.new(sep.outputs['Z'], top.inputs['Value'])
    tc = nt.nodes.new('ShaderNodeTexCoord')                       # 물체 안 0..1 좌표 → 가운데에서 먼 정도
    sub = nt.nodes.new('ShaderNodeVectorMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = (0.5, 0.5, 0.5)
    nt.links.new(tc.outputs['Generated'], sub.inputs[0])
    sx = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(sub.outputs[0], sx.inputs[0])
    cmb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(sx.outputs['X'], cmb.inputs['X']); nt.links.new(sx.outputs['Y'], cmb.inputs['Y'])
    ln = nt.nodes.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'; nt.links.new(cmb.outputs[0], ln.inputs[0])
    rad = nt.nodes.new('ShaderNodeMapRange')                      # 가운데 = 1 → 모서리 = 0
    rad.inputs['From Min'].default_value, rad.inputs['From Max'].default_value = 0.05, 0.66
    rad.inputs['To Min'].default_value, rad.inputs['To Max'].default_value = 1.0, 0.0
    nt.links.new(ln.outputs['Value'], rad.inputs['Value'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')                     # 가운데로 갈수록 검붉은 → 주황 → 호박색
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = HEAT_RAMP[0][0], (*lin(HEAT_RAMP[0][1]), 1)
    els[1].position, els[1].color = HEAT_RAMP[2][0], (*lin(HEAT_RAMP[2][1]), 1)
    mid = els.new(HEAT_RAMP[1][0]); mid.color = (*lin(HEAT_RAMP[1][1]), 1)
    nt.links.new(rad.outputs['Result'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Emission Color'])
    soft = nt.nodes.new('ShaderNodeMapRange')                     # 세기: 모서리 0.35 → 가운데 1
    soft.inputs['To Min'].default_value, soft.inputs['To Max'].default_value = 0.35, 1.0
    nt.links.new(rad.outputs['Result'], soft.inputs['Value'])
    m1 = nt.nodes.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'
    nt.links.new(top.outputs['Result'], m1.inputs[0]); nt.links.new(soft.outputs['Result'], m1.inputs[1])
    m2 = nt.nodes.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'
    nt.links.new(m1.outputs[0], m2.inputs[0]); nt.links.new(heat.outputs[0], m2.inputs[1])
    cam_only = nt.nodes.new('ShaderNodeLightPath')                # 카메라 광선에만 빛남 → 주변을 비추지 않음
    m3 = nt.nodes.new('ShaderNodeMath'); m3.operation = 'MULTIPLY'
    nt.links.new(m2.outputs[0], m3.inputs[0]); nt.links.new(cam_only.outputs['Is Camera Ray'], m3.inputs[1])
    nt.links.new(m3.outputs[0], b.inputs['Emission Strength'])
    return m


M = {
    'rack': mat('rack', '#121418', 0.62),                          # 랙 골격 (검정 분체 도장)
    'metal': mat('metal', '#24272d', 0.38, 0.7),                    # 스위치·전원 앞판 (어두운 금속)
    'cavity': mat('cavity', '#0b0c0e', 0.85),                       # 꺼낸 트레이 자리 (어두운 안쪽)
    'silver': mat('silver', '#c6cbd2', 0.42, 1.0, aniso=0.4),       # 컴퓨트 트레이 판금 (브러시드)
    'copper': mat('copper', '#d08f5e', 0.24, 1.0),                  # 구리 냉각판·NIC 틀
    'steel': mat('steel', '#b3bbc5', 0.26, 1.0),                    # 스테인리스 (매니폴드·이음쇠)
    'hose': mat('hose', '#15171a', 0.62),                           # 검정 호스
    'supply': mat('supply', '#3c79d2', 0.32, 0.5),                  # 냉각수 공급 고리 (파랑)
    'return': mat('return', '#d0533c', 0.32, 0.5),                  # 회수 고리 (빨강)
    'pcb': mat('pcb', '#16191d', 0.55, coat=0.1),                   # 검정 메인보드 (반무광 솔더 마스크)
    'modpcb': mat('modpcb', '#1d2a2b', 0.4, coat=0.3),              # GPU 모듈 기판
    'substrate': mat('substrate', '#34463b', 0.45, coat=0.2),       # 패키지 기판
    'interposer': mat('interposer', '#4a5462', 0.2, 0.4),           # 인터포저 (실리콘)
    'hbm': mat('hbm', '#2c3138', 0.32, 0.2),                        # HBM
    'lid': mat('lid', '#cdd2d8', 0.34, 1.0, aniso=0.3),             # 니켈 뚜껑 (브러시드)
    'chip': mat('chip', '#1d2025', 0.35, 0.1),                      # 검정 칩·포트
    'choke': mat('choke', '#4a4f57', 0.42, 0.55),                   # 인덕터
    'mlcc': mat('mlcc', '#b89a6a', 0.55),                           # 세라믹 콘덴서
    'orange': mat('orange', '#e07b2e', 0.48),                       # NVLink 커넥터
    'brass': mat('brass', '#c9a54a', 0.3, 1.0),                     # 받침 기둥
    'frame': mat('frame', '#1f232a', 0.4, 0.6),                     # 소켓 고정 틀 (검정 양극산화)
    'paper': mat('paper', '#f2f2ef', 0.8),                          # 라벨
    'silk': mat('silk', '#dfe3e6', 0.6),                            # 기판 흰 인쇄
    'bench': mat('bench', '#d9dde3', 0.55),                         # 전시용 받침대
    'ink': mat('ink', '#3a3f47', 0.6),                              # 라벨 글줄·각인
    'led_g': mat('led_g', '#22d36b', 0.4, emit=10.0),
    'led_b': mat('led_b', '#4c9bff', 0.4, emit=10.0),
    'hot_copper': hot('hot_copper', '#d08f5e', 0.24, 1.0),          # GPU 냉각판 (열 빛)
    'hot_die': hot('hot_die', '#2f343d', 0.24, 0.5),                # GPU 다이 (어두운 실리콘 + 열 빛)
}

# GPU 그림은 기판을 확대할 때 앞층(냉각판·뚜껑·호스·플러그 = svg.rk-front)을 흐리게 함: 불투명도 = 1 − sm(0, .6, 확대)
#   → 앞층 물체엔 재질 복사본을 쓰고, 복사본마다 투명 섞기 'fade' 값 노드를 둠 (프레임마다 모두 같은 값으로 바꿈)
FADES = []


def faded(name):
    key = 'f_' + name
    if key not in M:
        m = M[name].copy()
        m.name = key
        nt = m.node_tree
        out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        mix = nt.nodes.new('ShaderNodeMixShader')                     # 섞기 0 = 원래 재질, 1 = 완전히 투명
        val = nt.nodes.new('ShaderNodeValue'); val.name = 'fade'; val.outputs[0].default_value = 0.0
        nt.links.new(val.outputs[0], mix.inputs[0])
        nt.links.new(bsdf_of(m).outputs[0], mix.inputs[1])
        nt.links.new(tr.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs['Surface'])
        M[key] = m
        FADES.append(m)
    return M[key]


# ---------- 메시 모으개 (그림 좌표로 상자·원통을 쌓아 물체 하나로, 모서리는 살짝 둥글게) ----------
class Builder:
    def __init__(self):
        self.v, self.f, self.fm, self.fs, self.mats = [], [], [], [], []

    def _mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _quad(self, idx, m, smooth=False):
        self.f.append(tuple(idx)); self.fm.append(self._mi(m)); self.fs.append(smooth)

    def box(self, m, p, z0, h):
        """그림의 평면 사각형 p = {x, y, w, d, r?} (x..x+w, y..y+d) 를 z0 부터 h 만큼 세운 상자
        (그림의 모서리 반지름 r 이 실제 1.5 mm 이상이면 평면 모서리를 둥글게 — 받침대·보드·냉각판·뚜껑 등)"""
        if p.get('r', 0) * S >= 0.0015:
            return self.rbox(m, p, z0, h, p['r'])
        x0, x1, y0, y1 = p['x'], p['x'] + p['w'], p['y'], p['y'] + p['d']
        b = len(self.v)
        for (x, y, z) in [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z0 + h), (x1, y0, z0 + h), (x1, y1, z0 + h), (x0, y1, z0 + h)]:
            self.v.append(tuple(V(x, y, z)))
        # y 를 뒤집으면 면 방향(법선)이 뒤집히므로 꼭짓점 순서를 거꾸로 해 바깥을 향하게
        for q in [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (2, 6, 7, 3), (3, 7, 4, 0), (1, 5, 6, 2)]:
            self._quad([b + i for i in q], m)

    def rbox(self, m, p, z0, h, r, seg=6):
        """평면 모서리가 둥근 상자: 둘레(모서리마다 호 seg 칸)를 z0 → z0+h 로 세움. 윗면·아랫면은 다각형 하나"""
        r = min(r, p['w'] / 2 * 0.999, p['d'] / 2 * 0.999)
        x0, x1, y0, y1 = p['x'], p['x'] + p['w'], p['y'], p['y'] + p['d']
        ring = []   # 그림 좌표에서 반시계 방향 (box 의 0→1→2→3 과 같은 방향)
        for (cx, cy, a0) in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
            for i in range(seg + 1):
                a = math.radians(a0 + 90 * i / seg)
                ring.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        n, b = len(ring), len(self.v)
        for z in (z0, z0 + h):
            for (x, y) in ring:
                self.v.append(tuple(V(x, y, z)))
        self._quad([b + i for i in range(n)], m)                      # 아랫면 (box 의 0,1,2,3 과 같은 순서)
        self._quad([b + n + i for i in reversed(range(n))], m)        # 윗면 (거꾸로 → 위를 향함)
        for i in range(n):
            j = (i + 1) % n
            self._quad([b + i, b + n + i, b + n + j, b + j], m, i % (seg + 1) != seg)   # 옆면 (호 부분만 매끈하게)

    def cyl(self, m, p0, p1, r, seg=24, caps=True):
        """그림 좌표의 두 점 p0 → p1 을 잇는 원통 (반지름 r 그림 단위)"""
        a, c = V(*p0), V(*p1)
        d = (c - a).normalized()
        u = d.cross(Vector((0, 0, 1)))
        if u.length < 1e-6:
            u = d.cross(Vector((1, 0, 0)))
        u.normalize(); w = d.cross(u); b = len(self.v); rr = r * S
        for p in (a, c):
            for i in range(seg):
                t = 2 * math.pi * i / seg
                self.v.append(tuple(p + rr * (math.cos(t) * u + math.sin(t) * w)))
        for i in range(seg):
            j = (i + 1) % seg
            self._quad([b + i, b + j, b + seg + j, b + seg + i], m, True)
        if caps:
            self._quad([b + i for i in reversed(range(seg))], m)
            self._quad([b + seg + i for i in range(seg)], m)

    def cylz(self, m, x, y, r, z0, h, seg=24):
        self.cyl(m, (x, y, z0), (x, y, z0 + h), r, seg)

    def disc(self, m, origin, direction, s0, s1, r, seg=24):
        """origin 에서 direction 쪽으로 s0..s1 구간의 원통 (그림의 lathe disc 와 같음)"""
        o, dv = Vector(origin), Vector(direction).normalized()
        self.cyl(m, tuple(o + dv * s0), tuple(o + dv * s1), r, seg)

    def finish(self, name, bevel=0.0, parent=None):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        for m in self.mats:
            me.materials.append(m)
        me.polygons.foreach_set("material_index", self.fm)
        me.polygons.foreach_set("use_smooth", self.fs)
        me.update()
        ob = bpy.data.objects.new(name, me)
        COL.objects.link(ob)
        if parent:
            ob.parent = parent
        if bevel:
            bv = ob.modifiers.new("bevel", 'BEVEL')
            bv.width, bv.segments, bv.limit_method = bevel, 2, 'ANGLE'
        return ob


def empty(name, parent=None):
    ob = bpy.data.objects.new(name, None)
    COL.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob


def ball(m, center, r, parent=None, name="ball"):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    COL.objects.link(ob)
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=r * S)
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(m)
    ob.location = V(*center)
    if parent:
        ob.parent = parent
    return ob


def hose(m, pts, r, name="hose", parent=None, fillet=None):
    """꺾인 선(그림 좌표)을 따라가는 둥근 호스: 꺾이는 곳은 둥글게 (반지름 fillet, 기본 호스 반지름의 2.5배)"""
    fillet = fillet or r * 2.5
    P = [Vector(V(*p)) for p in pts]
    path = [P[0]]
    for i in range(1, len(P) - 1):
        a, b, c = P[i - 1], P[i], P[i + 1]
        t = min(fillet * S, (b - a).length / 2, (c - b).length / 2)
        p0, p2 = b + (a - b).normalized() * t, b + (c - b).normalized() * t
        for k in range(9):   # 2차 베지어로 모서리를 둥글게
            s = k / 8
            path.append((1 - s) ** 2 * p0 + 2 * (1 - s) * s * b + s * s * p2)
    path.append(P[-1])
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth, cu.bevel_resolution, cu.use_fill_caps = r * S, 5, True
    sp = cu.splines.new('POLY')
    sp.points.add(len(path) - 1)
    for i, p in enumerate(path):
        sp.points[i].co = (p.x, p.y, p.z, 1)
    ob = bpy.data.objects.new(name, cu)
    ob.data.materials.append(m)
    COL.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob


def corners(p, inset):
    """그림 kit 의 corners: 사각형 안쪽으로 inset 만큼 들어간 네 모서리 점"""
    return [(p['x'] + inset, p['y'] + inset), (p['x'] + p['w'] - inset, p['y'] + inset),
            (p['x'] + p['w'] - inset, p['y'] + p['d'] - inset), (p['x'] + inset, p['y'] + p['d'] - inset)]


def outline(b, m, p, z, inset, width=0.35, h=0.06):
    """윗면의 사각 윤곽 (그림의 planOutline + insetPlan): 얇은 줄 4개"""
    x0, x1, y0, y1 = p['x'] + inset, p['x'] + p['w'] - inset, p['y'] + inset, p['y'] + p['d'] - inset
    b.box(m, {'x': x0, 'y': y0, 'w': x1 - x0, 'd': width}, z, h)
    b.box(m, {'x': x0, 'y': y1 - width, 'w': x1 - x0, 'd': width}, z, h)
    b.box(m, {'x': x0, 'y': y0, 'w': width, 'd': y1 - y0}, z, h)
    b.box(m, {'x': x1 - width, 'y': y0, 'w': width, 'd': y1 - y0}, z, h)


def R(x, y, w, d):
    return {'x': x, 'y': y, 'w': w, 'd': d}


# =============================================================
# 1) 랙 장면 (build.mjs 의 base·rearFrame·sidePanel·fronts·cavity·frontFrame·cap·trayBody)
# =============================================================
def build_rack():
    X0, X1, Y0, Y1 = L['X0'], L['X1'], L['Y0'], L['Y1']
    POST, BASE_H, CAP_H, FOOT_H, TOP = L['POST'], L['BASE_H'], L['CAP_H'], L['FOOT_H'], L['TOP']
    W, D = L['w'], L['d']
    FX0, FW, FT = L['FRONT_X0'], L['FRONT_W'], L['FRONT_T']
    pulled = next(s for s in L['stack'] if s['kind'] == 'compute' and s['index'] == L['pulled'])

    # 받침: 캐스터·발·바닥판
    b = Builder()
    for (x, y) in corners(R(X0, Y0, W, D), 9):
        b.cylz(M['rack'], x, y, 4.2, -FOOT_H, 1.4, 32)
        b.cylz(M['steel'], x, y, 2.4, -FOOT_H + 1.4, FOOT_H - 1.4, 24)
        b.box(M['rack'], R(x - 3, y - 3, 6, 6), -1.2, 1.2)
    b.box(M['rack'], R(X0, Y0, W, D), 0, BASE_H)
    b.finish("rack_base", 0.0015)

    # 골격: 기둥 4, 뒷판, 덕트, 옆판(오른쪽 = 보이는 쪽, 왼쪽은 안 보이지만 닫아 둠), 지붕판
    b = Builder()
    for (x, y) in [(X0, Y0), (X1 - POST, Y0), (X0, Y1 - POST), (X1 - POST, Y1 - POST)]:
        b.box(M['rack'], R(x, y, POST, POST), BASE_H, TOP - BASE_H)
    b.box(M['rack'], R(X0 + POST, Y0, W - 2 * POST, 1.2), BASE_H, TOP - BASE_H)
    for x in (X0 + 10, X1 - 14):
        b.box(M['metal'], R(x, Y0 + 1.2, 4, 3), BASE_H, TOP - BASE_H - 4)
    b.box(M['rack'], R(X1 - 2, Y0 + POST, 2, D - 2 * POST), BASE_H, TOP - BASE_H)
    b.box(M['rack'], R(X0, Y0 + POST, 2, D - 2 * POST), BASE_H, TOP - BASE_H)
    b.box(M['rack'], R(X0, Y0, W, D), TOP, CAP_H)
    b.finish("rack_frame", 0.002)

    # 옆판 겉의 이음선·환기 슬롯·나사 (작은 것들은 따로 → 둥글림을 작게)
    b = Builder()
    seam = BASE_H + (TOP - BASE_H) / 2
    b.box(M['cavity'], R(X1 - 0.05, Y0 + POST + 1, 0.12, D - 2 * POST - 2), seam - 0.15, 0.3)
    for zb in (BASE_H + 22, TOP - 40):
        for i in range(5):
            y0 = Y0 + 30 + i * 36
            b.box(M['cavity'], R(X1 - 0.1, y0, 0.18, 22), zb, 2.4)
    for (y, z) in [(Y0 + 8, BASE_H + 6), (Y1 - 8, BASE_H + 6), (Y0 + 8, TOP - 6), (Y1 - 8, TOP - 6), (Y0 + 8, seam + 3), (Y1 - 8, seam + 3)]:
        b.disc(M['steel'], (X1, y, z), (1, 0, 0), 0, 0.25, 0.7, 16)
    # 지붕: 케이블 통과구 2 (어두운 테두리) + 라벨판(글줄 3) + 모서리 나사
    for x in (X0 + 14, X1 - 44):
        outline(b, M['cavity'], R(x, Y0 + 12, 30, 10), TOP + CAP_H, 0, 0.8, 0.05)
    lab = R(X0 + 30, Y1 - 26, 60, 16)
    b.box(M['paper'], lab, TOP + CAP_H, 0.8)
    for dy, ln in [(16, 40), (20, 28), (24, 44)]:
        b.box(M['ink'], R(lab['x'] + 6, lab['y'] + dy - 12 - 0.4, ln, 0.8), TOP + CAP_H + 0.8, 0.05)
    for (x, y) in corners(R(X0, Y0, W, D), 4):
        b.cylz(M['steel'], x, y, 0.8, TOP + CAP_H, 0.2, 16)
    # 앞 기둥의 19 인치 마운트 구멍 (U 마다 하나씩)
    for s in L['stack']:
        for x in (X0 + 1.5, X1 - 1.5):
            b.disc(M['cavity'], (x, Y1, s['z'] + s['h'] / 2), (0, 1, 0), -0.1, 0.12, 0.45, 12)
    b.finish("rack_details", 0.0004)

    # 꺼낸 트레이 자리 (어두운 안쪽: 레일 판·뒤 벽·옆 벽)
    b = Builder()
    z0, h = pulled['z'], pulled['h']
    b.box(M['cavity'], R(FX0, Y0 + 2, FW, Y1 - Y0 - 2), z0, 0.6)
    b.box(M['cavity'], R(FX0, Y0 + 2, FW, 2), z0, h)
    for x in (FX0, FX0 + FW - 1):
        b.box(M['cavity'], R(x, Y0 + 2, 1, Y1 - Y0 - 3), z0, h - 0.6)
    b.finish("rack_cavity", 0)

    # 랙 속 몸통 (앞판 뒤를 어둡게 채움): 그림엔 앞판만 있어 속이 비었는데, 사진에선 앞판 사이 틈(2 mm)으로
    # 빈 속이 들여다보이고 안에 넣어 둔 트레이의 열 빛까지 새어 보였음 → 꺼내는 칸만 비우고 위아래를 채움
    b = Builder()
    inner = R(X0 + 2, Y0 + 2, W - 4, (Y1 - FT - 0.6) - (Y0 + 2))
    b.box(M['cavity'], inner, BASE_H, pulled['z'] - BASE_H)
    b.box(M['cavity'], inner, pulled['z'] + pulled['h'], TOP - pulled['z'] - pulled['h'])
    b.finish("rack_inner", 0)

    # 앞판들 (꺼낸 트레이 칸 제외)
    fronts = Builder()
    for s in L['stack']:
        if s is pulled or (s['kind'] == 'compute' and s['index'] == L['pulled']):
            continue
        front_plate(fronts, s, Y1)
    fronts.finish("fronts", 0.0006)

    # ---- 꺼내지는 13번 트레이 (그림 trayBody 와 같은 배치) — 빈 물체 TRAY 를 앞으로 움직임 ----
    tray = empty("TRAY")
    TZ, TX0, TW, TY0, FLOOR_T, TOPZ, BZ, BT = L['TZ'], L['TX0'], L['TW'], L['TY0'], L['FLOOR_T'], L['TOPZ'], L['BZ'], L['BT']
    GPU_H, BAR, BAR_H, HR, HZG, HZC = L['GPU_H'], L['BAR'], L['BAR_H'], L['HR'], L['HZ_GPU'], L['HZ_CPU']
    TRAY_D = L['TRAY_D']
    t = Builder()
    t.box(M['silver'], R(TX0, TY0, TW, TRAY_D - FT), TZ, FLOOR_T)                                   # 바닥판
    for x in (TX0, TX0 + TW - 1.2):
        t.box(M['silver'], R(x, TY0, 1.2, TRAY_D - FT), TOPZ, pulled['h'] - 3.4)                    # 옆 레일
    board = R(TX0 + 2, TY0 + 3, TW - 4, Y1 - FT - 2 - (TY0 + 3))
    t.box(M['pcb'], board, BZ, BT - BZ)                                                           # 메인보드
    for g in L['GPUS']:
        for dx in (-4, 4):                                                                        # 냉각판 앞면 바브 2개
            t.disc(M['steel'], (g['cx'] + dx, g['y'] + g['d'], HZG), (0, 1, 0), 0, 1.0, 0.95, 20)
    t.box(M['steel'], BAR, BT, BAR_H)                                                             # 매니폴드 막대
    for x in (-30, 0, 30):
        t.cylz(M['chip'], x, BAR['y'] + BAR['d'] / 2, 0.45, BT + BAR_H, 0.05, 12)
    for g in L['GPUS']:
        for dx, ring in ((-4, M['supply']), (4, M['return'])):
            x = g['cx'] + dx
            t.disc(ring, (x, BAR['y'], HZG), (0, -1, 0), 0, 1.0, 1.05, 20)                     # 막대 이음쇠 (파랑·빨강)
    for x, ring in ((-51, M['supply']), (51, M['return'])):
        t.disc(ring, (x, BAR['y'], HZG), (0, -1, 0), 0, 1.0, 1.05, 20)
    for c in L['CPUS']:
        t.box(M['copper'], c, BT, c['h'])                                                         # CPU 구리 냉각판
        outline(t, M['ink'], c, BT + c['h'], 2.4, 0.3, 0.05)
        for dx in (-15.6, -12.4, 9.8, 13.0):                                                     # SOCAMM 메모리
            sp = R(c['cx'] + dx, c['y'], 2.6, 16)
            t.box(M['chip'], sp, BT, 0.6)
            outline(t, M['ink'], R(c['cx'] + dx + 0.5, c['y'] + 1.2, 1.6, 13.6), BT + 0.6, 0, 0.2, 0.04)
        for dx, ring in ((-4, M['supply']), (4, M['return'])):
            x = c['cx'] + dx
            t.disc(ring, (x, BAR['y'] + BAR['d'], HZC), (0, 1, 0), 0, 3.0, 1.05, 20)            # 막대 앞쪽 이음쇠 (길게)
            t.disc(M['steel'], (x, c['y'], HZC), (0, -1, 0), 0, 1.0, 0.95, 20)                  # CPU 바브
    for n in L['NICS']:
        t.box(M['copper'], n, BT, 0.8)                                                            # NIC 구리 틀
        t.box(M['chip'], R(n['cx'] - 3, n['y'] + 2.5, 6, 5), BT + 0.8, 0.5)                       # NIC 칩
    e1s = R(-48, 74, 18, 42)
    t.box(M['chip'], e1s, BT, 5.4)                                                                # 저장장치 케이지
    for i in (1, 2, 3):
        t.box(M['ink'], R(e1s['x'] + i * e1s['w'] / 4 - 0.15, e1s['y'], 0.3, e1s['d']), BT + 5.4, 0.05)
    for i in range(4):
        t.box(M['chip'], R(FX0 + 44 + i * 6.6, 100, 5.4, 16.8), BT, 3.4)                          # OSFP 포트 케이지
    t.box(M['chip'], R(30, 80, 7, 7), BT, 0.7)                                                    # 관리 칩 (BMC)
    t.cylz(M['led_g'], 31.2, 86, 0.4, BT + 0.7, 0.05, 12)
    front_plate(t, pulled, Y1)                                                                   # 트레이 앞판
    t.finish("tray_body", 0.0005, tray)
    # GPU 냉각판 4개: 열 재질 (윗면만 빛), 물체마다 따로 → 가운데가 더 밝은 빛이 판마다
    for g in L['GPUS']:
        gb = Builder()
        gb.box(M['hot_copper'], g, BT, g['h'])
        gb.finish(f"gpu_plate_{g['id']}", 0.0012, tray)
        gt = Builder()
        outline(gt, M['ink'], g, BT + g['h'], 2.2, 0.3, 0.04)                                     # 윗면 홈
        for (x, y) in corners(g, 1.3):
            gt.cylz(M['steel'], x, y, 0.5, BT + g['h'], 0.15, 12)                                 # 모서리 나사
        gt.box(M['ink'], R(g['x'] + 5, g['y'] + g['d'] - 4.6 - 0.2, 9, 0.4), BT + g['h'], 0.04)   # 각인 한 줄
        gt.finish(f"gpu_top_{g['id']}", 0, tray)
    # 호스 (검정): GPU → 막대, 막대 → 뒤 퀵커넥터, 막대 → CPU
    for g in L['GPUS']:
        for dx in (-4, 4):
            x = g['cx'] + dx
            hose(M['hose'], [(x, g['y'] + g['d'] + 1.0, HZG), (x, BAR['y'] - 1.0, HZG)], HR, "hose_gpu", tray)
    for x in (-51, 51):
        hose(M['hose'], [(x, BAR['y'] - 1.0, HZG), (x, TY0 + 6, HZG)], HR, "hose_feed", tray)
    for c in L['CPUS']:
        for dx in (-4, 4):
            x = c['cx'] + dx
            hose(M['hose'], [(x, BAR['y'] + BAR['d'] + 3.0, HZC), (x, c['y'] - 1.0, HZC)], HR, "hose_cpu", tray)
    return {"tray": tray}


def front_plate(b, s, Y1):
    """1U 칸 하나의 앞판 (그림 frontPlate): 컴퓨트 = 은색(나사·저장장치 칸·포트·LED·라벨 줄), 스위치·전원 = 어두운 금속"""
    FX0, FW, FT = L['FRONT_X0'], L['FRONT_W'], L['FRONT_T']
    z0, h = s['z'] + 0.4, s['h'] - 0.8
    kind = s['kind']
    b.box(M['silver'] if kind == 'compute' else M['metal'], R(FX0, Y1 - FT, FW, FT), z0, h)
    if kind == 'compute':
        for x in (FX0 + 4.2, FX0 + FW - 4.2):
            b.disc(M['steel'], (x, Y1, z0 + h / 2), (0, 1, 0), 0, 1.1, 1.9, 24)                 # 고정 나사 (둥근 손잡이)
        for i in range(4):
            b.box(M['chip'], R(FX0 + 9 + i * 3.4, Y1, 2.5, 0.3), z0 + 1.3, h - 2.6)             # 저장장치 칸
        for i in range(4):
            b.box(M['chip'], R(FX0 + 44 + i * 6.6, Y1, 5.4, 0.35), z0 + 2.0, h - 4.0)           # OSFP 포트
        for dz in (-1.2, 1.2):
            b.disc(M['led_g'], (FX0 + 26, Y1, z0 + h / 2 + dz), (0, 1, 0), 0, 0.12, 0.6, 12)
        for dz, ln in ((-1.3, 22), (1.3, 14)):
            b.box(M['ink'], R(FX0 + 76, Y1, ln, 0.06), z0 + h / 2 + dz - 0.2, 0.4)
    elif kind == 'switch':
        for x in (FX0 + 10, FX0 + FW - 46):
            b.box(M['chip'], R(x, Y1, 36, 1.2), z0 + 1.6, h - 3.2)                              # QSFP 포트 묶음
        for x in (FX0 + 52, FX0 + 56):
            b.disc(M['led_b'], (x, Y1, z0 + h / 2), (0, 1, 0), 0, 0.12, 0.6, 12)
    else:
        for i in range(20):
            for j in range(3):
                b.disc(M['cavity'], (FX0 + 18 + i * 4, Y1, z0 + 4 + j * 3.6), (0, 1, 0), -0.1, 0.06, 0.55, 10)   # 흡기 구멍
        for x in (FX0 + 5, FX0 + FW - 11):
            b.box(M['chip'], R(x, Y1, 6, 1.4), z0 + 3, h - 6)                                   # 손잡이


# =============================================================
# 2) GPU 모듈 장면 (gpu.mjs 의 bench·fixed·lidLayer·plateLayer) — 단위 1 mm
# =============================================================
def build_gpu():
    BENCH, BZ0, FOOT = L['BENCH'], L['BENCH_Z'], L['FOOT']
    PZ, PT, FT, MT, ST, IT, DT, LT, PTOP = L['PZ'], L['PT'], L['FT'], L['MT'], L['ST'], L['IT'], L['DT'], L['LT'], L['PTOP']
    BOARD, FO, FI = L['BOARD'], L['FRAME_OUT'], L['FRAME_IN']

    # 전시용 받침대 + 발 + 앞쪽 눈금자 띠
    b = Builder()
    b.box(M['bench'], BENCH, BZ0, -BZ0)
    for (x, y) in corners(BENCH, 14):
        b.cylz(M['chip'], x, y, 6, BZ0 - FOOT, 1.4, 32)
        b.cylz(M['steel'], x, y, 4.4, BZ0 - FOOT + 1.4, FOOT - 1.4, 28)
    outline(b, M['silk'], BENCH, 0, 5, 0.5, 0.05)
    strip = R(BENCH['x'] + 18, BENCH['y'] + BENCH['d'] - 12, BENCH['w'] - 36, 6)
    b.box(M['frame'], strip, 0, 0.6)
    x = strip['x'] + 3
    i = 0
    while x <= strip['x'] + strip['w'] - 3:
        ln = 3.4 if i % 4 == 0 else 1.8
        b.box(M['silk'], R(x - 0.15, strip['y'] + 0.8, 0.3, ln), 0.6, 0.04)
        x += 5; i += 1
    for (x, y) in corners(BENCH, 8):
        b.cylz(M['steel'], x, y, 1.2, 0, 0.3, 16)
    b.finish("bench", 0.0006)

    # 메인보드 + 받침 기둥 + 흰 인쇄 + 기준점
    b = Builder()
    for (x, y) in corners(BOARD, 7):
        b.cylz(M['brass'], x, y, 3, 0, PZ, 24)
    b.box(M['pcb'], BOARD, PZ, PT - PZ)
    for r in [R(FO['x'] - 1.5, FO['y'] - 1.5, FO['w'] + 3, FO['d'] + 3), R(-85.5, -41.5, 28.5, 77), R(57, -41.5, 28.5, 77)]:
        outline(b, M['silk'], r, PT, 0, 0.4, 0.03)
    for (x, y) in corners(BOARD, 7):
        b.cylz(M['steel'], x, y, 3.6, PT, 0.03, 24)
    for (x, y) in [(-56, 58), (56, -58), (84, 59)]:
        b.cylz(M['copper'], x, y, 1.6, PT, 0.03, 20)
    b.finish("board", 0.0003)

    # 부품들 (전원부·커넥터·콘덴서·라벨·소켓 틀·모듈 기판·패키지·인터포저·HBM·매니폴드) — gpu.mjs fixed() 의 숫자 그대로
    b = Builder()
    for side in (-1, 1):
        for y in (-40, -27, -14, -1, 12, 25):
            for x0 in ((-84, -73) if side < 0 else (64, 75)):
                pl = R(x0, y, 9, 9)
                b.box(M['choke'], pl, PT, 5.5)                                                     # 인덕터
                outline(b, M['ink'], pl, PT + 5.5, 2.2, 0.3, 0.03)
                b.box(M['ink'], R(x0 + 3.4, y + 4.35, 2.2, 0.3), PT + 5.5, 0.03)
            b.box(M['chip'], R(-63.5 if side < 0 else 58.5, y + 1.5, 5, 6), PT, 1.2)                # 파워 스테이지
    for (x, y) in [(-82, 36), (70, -56)]:
        b.box(M['chip'], R(x, y, 6, 6), PT, 0.9)                                                    # 전원 컨트롤러
        b.cylz(M['silk'], x + 1.2, y + 1.2, 0.45, PT + 0.9, 0.03, 12)
    NV = R(-84, -61, 24, 9)
    b.box(M['orange'], NV, PT, 9)                                                                   # NVLink 커넥터
    for dx in (2, 13):
        b.box(M['chip'], R(NV['x'] + dx, NV['y'] + 2.5, 9, 4), PT + 9, 0.3)
    PWR = R(62, 44, 20, 9)
    b.box(M['chip'], PWR, PT, 7)                                                                    # 전원 커넥터
    for i in range(12):
        b.cylz(M['cavity'], PWR['x'] + 2.6 + (i % 6) * 2.96, PWR['y'] + 3 + (i // 6) * 3, 0.55, PT + 7, 0.04, 12)
    for (xs, y) in ((range(-40, 41, 8), 58.5), (range(-36, 5, 8), -58.5)):
        for x in xs:
            b.cylz(M['steel'], x, y, 2.4, PT, 5, 28)                                               # 고분자 콘덴서
            b.cylz(M['ink'], x, y, 1.3, PT + 5, 0.03, 16)
    for y in (53.4, -54.2):
        for x in range(-50, 51, 4):
            b.box(M['mlcc'], R(x - 0.8, y, 1.6, 0.8), PT, 0.5)                                     # MLCC 줄
    lab = R(-84, 45, 22, 12)
    b.box(M['paper'], lab, PT, 0.4)                                                                 # 라벨 (글줄 3)
    for dy, ln in ((3.5, 15), (6, 11), (8.5, 13)):
        b.box(M['ink'], R(lab['x'] + 2.5, lab['y'] + dy - 0.2, ln, 0.4), PT + 0.4, 0.03)
    bars = [R(FO['x'], FO['y'], FO['w'], FI['y'] - FO['y']),
            R(FO['x'], FI['y'] + FI['d'], FO['w'], FO['y'] + FO['d'] - FI['y'] - FI['d']),
            R(FO['x'], FI['y'], FI['x'] - FO['x'], FI['d']),
            R(FI['x'] + FI['w'], FI['y'], FO['x'] + FO['w'] - FI['x'] - FI['w'], FI['d'])]
    for bar in bars:
        b.box(M['frame'], bar, PT, FT - PT)                                                         # 소켓 고정 틀
    for (x, y) in L['SCREWS']:
        b.cylz(M['cavity'], x, y, 2.2, FT, 0.03, 20)                                                # 나사 구멍
    for (x, y) in [(-36, -47), (36, 47)]:
        b.cylz(M['steel'], x, y, 1.3, FT, 2.2, 16)                                                  # 정렬 핀
    b.box(M['modpcb'], L['MOD'], PT, MT - PT)                                                       # GPU 모듈 기판
    for x in (-43.6, 41.6):
        for y in range(-34, 35, 5):
            b.box(M['mlcc'], R(x, y - 0.4, 2, 0.8), MT, 0.5)
    b.box(M['substrate'], L['SUB'], MT, ST - MT)                                                    # 패키지 기판
    for x in (-37.6, 35.6):
        yy = -30.0
        while yy <= 30.01:
            b.box(M['mlcc'], R(x, yy, 2, 1.2), ST, 0.6)
            yy += 7.5
    b.box(M['interposer'], L['INTP'], ST, IT - ST)                                                  # 인터포저
    for h in L['HBM']:
        b.box(M['hbm'], h, IT, DT - IT)                                                             # HBM 8개
        outline(b, M['ink'], h, DT, 1.8, 0.25, 0.02)
        for dy in (4.4, 6.6):
            b.box(M['ink'], R(h['x'] + 3.2, h['y'] + dy - 0.15, 4.6, 0.3), DT, 0.02)
    MB = L['MB']
    for line, blk in zip(L['LINES'], L['BLOCKS']):
        b.box(M['steel'], blk, 0, MB)                                                               # 매니폴드 블록
        cx, cy = line['socket']
        d = line['cap']
        face = (cx + d[0] * blk['w'] / 2, cy + d[1] * blk['d'] / 2, MB / 2)
        b.disc(M['steel'], face, d, 0, 3, 2.3, 6)                                                   # 옆면 육각 마개
        ring = M['supply'] if line['name'] == 'supply' else M['return']
        for (z0, z1, r, *kind) in L['SOCK']:
            b.cylz(ring if kind and kind[0] == 'sleeve' else M['steel'], cx, cy, r, z0, z1 - z0, 40)   # 소켓 (색 슬리브)
    b.finish("parts", 0.00025)
    for i, die in enumerate(L['DIES']):                                                            # 다이 2개 (열 재질)
        db = Builder()
        db.box(M['hot_die'], die, IT, DT - IT)
        db.finish(f"die_{i}", 0.0003)

    # ---- 앞층 (그림의 svg.rk-front): 뚜껑·냉각판. 재질은 faded() 복사본 → 기판 확대 때 흐려짐 ----
    # 뚜껑 (들림 2단계) — 빈 물체 LID 를 움직임
    lid = empty("LID")
    b = Builder()
    LIDP = L['LID']
    b.box(faded('lid'), LIDP, ST, LT - ST)
    for (x, y, ln) in ((-27, 18, 24), (-27, 22, 18), (-27, 26, 21)):
        b.box(faded('ink'), R(x, y - 0.2, ln, 0.4), LT, 0.02)                                           # 레이저 각인
    code = R(18, 16, 10, 10)
    outline(b, faded('ink'), code, LT, 0, 0.3, 0.02)
    for i in range(16):
        if (i * 7) % 3 != 1:
            b.box(faded('ink'), R(code['x'] + 1.6 + (i % 4) * 2.3 - 0.5, code['y'] + 1.6 + (i // 4) * 2.3 - 0.5, 1.0, 1.0), LT, 0.02)
    b.cylz(faded('ink'), LIDP['x'] + 4, LIDP['y'] + LIDP['d'] - 4, 0.9, LT, 0.02, 16)
    b.finish("lid", 0.0006, lid)

    # 냉각판 (들림 1단계): 구리 판 + 스프링 나사 + 이음쇠 + 호스 + 퀵커넥터 플러그 — 빈 물체 PLATE 를 위로
    plate = empty("PLATE")
    b = Builder()
    PL = L['PLATE']
    b.box(faded('copper'), PL, LT, L['PLATE_H'])
    outline(b, faded('ink'), PL, PTOP, 8, 0.4, 0.03)
    for (x, y, ln) in ((-40, 36, 30), (-40, 40, 22)):
        b.box(faded('ink'), R(x, y - 0.2, ln, 0.4), PTOP, 0.03)
    for (x, y) in L['SCREWS']:
        b.cylz(faded('steel'), x, y, 2.6, PTOP, 2.4, 24)                                                 # 스프링 나사
        b.cylz(faded('ink'), x, y, 1.1, PTOP + 2.4, 0.03, 16)
    RB, RR, RBARB, RF, RH, EZ = L['RB'], L['RR'], L['RBARB'], L['RF'], L['RH'], L['EZ']
    F0, F1 = L['FERRULE']
    DIRV = L['DIR']
    for line in L['LINES']:
        x, y = line['x'], line['y']
        b.cylz(faded('steel'), x, y, 6, PTOP, 3, 6)                                                     # 육각 너트
        riser_top = EZ - math.sqrt(RB * RB - RR * RR)
        b.cylz(faded('steel'), x, y, RR, PTOP + 3, riser_top - PTOP - 3, 28)                            # 세운 관
        b.disc(faded('steel'), line['elbow'], DIRV, math.sqrt(RB * RB - RBARB * RBARB), F0, RBARB, 28)  # 바브
        b.disc(faded('steel'), line['elbow'], DIRV, F0, F1, RF, 28)                                     # 페룰
        ring = faded('supply') if line['name'] == 'supply' else faded('return')
        sx, sy = line['socket']
        for (z0, z1, r, *kind) in L['PLUG']:
            b.cylz(ring if kind and kind[0] == 'ring' else faded('steel'), sx, sy, r, z0, z1 - z0, 40)  # 퀵커넥터 플러그
    b.finish("plate", 0.0006, plate)
    for line in L['LINES']:
        ball(faded('steel'), line['elbow'], RB, plate, "elbow")                                         # 엘보 (공)
        c = line['corner']
        hose(faded('hose'), [line['start'], c, (c[0], c[1], L['HOSE_END'])], RH, "hose", plate, fillet=RH * 3.2)
    return {"plate": plate, "lid": lid}


# =============================================================
# 3) 카메라: 그림과 같은 정사영 (그림 화면 = 640×560 / 560×443 px, 이 숫자의 정수배로 찍으면 픽셀 단위로 겹침)
# =============================================================
PR = L['proj']
A_, E_ = math.radians(PR['azimuth']), math.radians(PR['elevation'])
sA, cA, sE, cE = math.sin(A_), math.cos(A_), math.sin(E_), math.cos(E_)
KPX = L['k']                                        # 그림 1 단위 = 몇 px
RIGHT = Vector((sA, cA, 0))                          # 화면 오른쪽 (Blender 좌표)
UP = Vector((-cA * sE, sA * sE, cE))                 # 화면 위
TOWARD = Vector((cA * cE, -sA * cE, sE))             # 보는 사람 쪽 (카메라는 그 반대를 봄)
WPX, HPX = L['W'], L['H']


def make_camera():
    cd = bpy.data.cameras.new("cam")
    cd.type = 'ORTHO'
    cd.sensor_fit = 'HORIZONTAL'
    cd.clip_start, cd.clip_end = 0.01, S * 6000
    cam = bpy.data.objects.new("cam", cd)
    COL.objects.link(cam)
    scene.camera = cam
    return cam


def set_view(cam, rect):
    """그림의 보이는 범위 rect = [x, y, 폭, 높이] (그림 px) 를 그대로 찍게 카메라를 놓음 (돋보기 확대도 같은 식)"""
    rx, ry, rw, rh = rect
    cx, cy = rx + rw / 2, ry + rh / 2
    a, b = (cx - PR['origin'][0]) / KPX, (PR['origin'][1] - cy) / KPX
    center = (RIGHT * a + UP * b) * S
    rot = Matrix((RIGHT, UP, TOWARD)).transposed().to_4x4()
    cam.matrix_world = Matrix.Translation(center + TOWARD * (S * 2000)) @ rot   # 정사영이라 거리는 그림에 영향 없음 (랙 10 m, GPU 2 m)
    cam.data.ortho_scale = rw / KPX * S


def iso_px(p):
    """그림의 투영식 (iso-kit iso) — 맞춤 검사용"""
    x, y, z = p
    k = KPX
    return (PR['origin'][0] + (x * sA - y * cA) * k, PR['origin'][1] + ((x * cA + y * sA) * sE - z * cE) * k)


# =============================================================
# 4) 빛·바닥 그림자·렌더 설정
# =============================================================
# 시험 촬영(랙)에서 고른 빛: 이름, 위치(m), 크기(m), 세기(W), 색 — 랙 장면 기준 세계 좌표, 랙 가운데 LIGHT_O 를 겨눔
#   key = 왼쪽 앞 위 큰 주광, fill = 카메라 쪽 약한 보조광, rim = 뒤 위 테두리 빛, strip = 앞판 금속에 길게 맺히는 반사
RACK_LIGHTS = [
    ("key", (-2.8, -3.2, 4.2), (2.4, 2.4), 950, (1, 1, 1)),
    ("fill", (3.0, -3.8, 1.6), (2.0, 2.0), 90, (0.92, 0.96, 1.0)),
    ("rim", (-0.6, 3.4, 3.4), (1.4, 2.4), 380, (1, 1, 1)),
    ("strip", (0.9, -3.4, 1.0), (0.5, 2.6), 200, (1, 1, 1)),
]
LIGHT_O = Vector((0, -0.3, 1.0))


def basis_of(proj):
    """그림 투영(방위·높이) → Blender 의 화면 오른쪽·위·보는 사람 쪽 단위 벡터"""
    a, e = math.radians(proj['azimuth']), math.radians(proj['elevation'])
    return (Vector((math.sin(a), math.cos(a), 0)), Vector((-math.cos(a) * math.sin(e), math.sin(a) * math.sin(e), math.cos(e))),
            Vector((math.cos(a) * math.cos(e), -math.sin(a) * math.cos(e), math.sin(e))))


def studio(center, scale, floor_z):
    """조명: 랙 시험 촬영의 빛을 '화면 기준 자리'로 옮겨 씀 → 두 그림이 같은 쪽에서 같은 느낌으로 빛을 받음
    center = 장면 가운데(m), scale = 랙 장면 대비 크기 (거리·빛 크기 × scale, 세기 × scale² → 받는 밝기는 같음)"""
    rb = basis_of(LAY['rack']['proj'])
    mine = (RIGHT, UP, TOWARD)
    for (name, pos, size, power, color) in RACK_LIGHTS:
        d = Vector(pos) - LIGHT_O
        comp = [d.dot(v) for v in rb]                              # 랙 화면 기준 성분 (오른쪽·위·보는 쪽)
        loc = center + sum((v * c for v, c in zip(mine, comp)), Vector()) * scale
        ld = bpy.data.lights.new(name, 'AREA')
        ld.shape, ld.size, ld.size_y, ld.energy, ld.color = 'RECTANGLE', size[0] * scale, size[1] * scale, power * scale * scale, color
        ob = bpy.data.objects.new(name, ld)
        COL.objects.link(ob)
        ob.location = loc
        ob.rotation_euler = (center - loc).to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new("w")
    scene.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    bg = next((n for n in w.node_tree.nodes if n.type == 'BACKGROUND'), None)
    if bg:
        bg.inputs['Color'].default_value = (*lin('#f4f5f7'), 1)   # 옅은 하늘빛 (그림자 쪽이 새까맣지 않게)
        bg.inputs['Strength'].default_value = 0.18
    bpy.ops.mesh.primitive_plane_add(size=scale * 60, location=(0, 0, floor_z))
    bpy.context.active_object.is_shadow_catcher = True     # 바닥은 그림자만 (배경은 투명 → 카드 색 위에 얹음)


def render_setup(res_x, samples):
    scene.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for dv in prefs.devices:
            dv.use = True
        scene.cycles.device = 'GPU'
    except Exception as e:
        print("GPU 를 못 써서 CPU 로:", e)
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.transparent_max_bounces = 64   # 흐려지는 앞층(호스·플러그 겹겹)을 지나도 광선이 끊기지 않게
    scene.cycles.max_bounces, scene.cycles.diffuse_bounces, scene.cycles.glossy_bounces = 8, 3, 4   # 제품 사진엔 충분
    scene.cycles.caustics_reflective = scene.cycles.caustics_refractive = False   # 구리 반사가 위 판에 주황 얼룩을 만들지 않게
    # 프레임 사이 데이터 유지(빠름)는 랙에만: GPU 장면은 기판 확대 때 앞층(냉각판·뚜껑)을 숨겼다(hide_render) 다시 보이는데,
    # 데이터를 유지하면 숨긴 판의 그림자 같은 이전 상태가 남아 렌더 순서에 따라 밝기가 계단처럼 바뀜(깜빡임) → GPU 는 매 프레임 새로
    scene.render.use_persistent_data = PANEL == 'rack'
    try:
        scene.cycles.denoising_use_gpu = True   # 잡음 제거도 GPU 로
    except AttributeError:
        pass
    scene.cycles.seed = 7                       # 프레임마다 같은 잡음 무늬 → 영상에서 반짝임이 덜함
    scene.render.film_transparent = True
    scene.render.resolution_x = res_x
    scene.render.resolution_y = 2 * round(res_x * HPX / WPX / 2)   # 영상(yuv420)은 짝수 높이만 됨
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.exposure = -0.2
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass


# =============================================================
# 5) 둘러보기 흉내 (build.mjs LIVE 의 tourAt · zoomer(둘러보기 부분) · settle 와 같은 식, 같은 시간 상수)
# =============================================================
def sm(a, b, x):
    q = min(1.0, max(0.0, (x - a) / (b - a)))
    return q * q * (3 - 2 * q)


def tour_at(t):
    u = t % TOUR
    ramp = lambda a, b: min(1.0, max(0.0, (u - a) / (b - a)))
    rz, gz = 3 <= u < 11.6, 17.3 <= u < 25.3
    return {
        'pull': LAY['rack']['STROKE'] * (ramp(0, 2.5) - ramp(12.5, 14.5)),
        'lift': ramp(14.5, 17) - ramp(25.6, 27.6),
        'load': 1.0 if (2 < u < 12.5) or (16 < u < 25.6) else 0.0,
        'rz': rz, 'rs': min(3, int((u - 3) // 2.15)) if rz else -1,
        'gz': gz, 'gs': min(3, int((u - 17.3) // 2)) if gz else -1,
    }


class Zoom:
    """돋보기 확대 (zoomer 의 둘러보기 부분): 짚는 부품 자리(fx, fy)가 확대돼도 화면의 같은 자리에 오게"""
    def __init__(self, lay):
        self.W, self.H, self.zoom, self.stops = lay['W'], lay['H'], lay['zoom'], lay['stops']
        self.auto, self.stop, self.k = False, None, 0.0
        self.fx = self.fy = self.tfx = self.tfy = 0.5

    def tour(self, on, i):
        self.auto = on
        s = self.stops[i] if on and i >= 0 else None
        if s is not self.stop:
            self.stop = s
            if s:
                self.tfx, self.tfy = s['fx'], s['fy']

    def step(self, dt):
        zk = 1.0 if self.auto else 0.0
        self.k += (zk - self.k) * (1 - math.exp(-dt / 0.3))
        if abs(zk - self.k) < 0.002:
            self.k = zk
        zf = 1 - math.exp(-dt / 0.35)
        self.fx += (self.tfx - self.fx) * zf
        self.fy += (self.tfy - self.fy) * zf

    def rect(self):
        s = 1 + (self.zoom - 1) * sm(0, 1, self.k)
        w, h = self.W / s, self.H / s
        return (self.fx * (self.W - w), self.fy * (self.H - h), w, h)


def settle(st, target, dt, seconds):
    w = 1 / seconds
    for _ in range(4):
        h = dt / 4
        st['v'] += (w * w * (target - st['x']) - 2 * w * st['v']) * h
        st['x'] += st['v'] * h
    if abs(target - st['x']) < 1e-4 and abs(st['v']) < 1e-4:
        st['x'], st['v'] = target, 0.0


def simulate():
    """두 바퀴를 흉내 내고 두 번째 바퀴의 프레임 상태를 돌려줌 (꼬리까지 이어져 반복 이음매가 매끄러움)
    프레임 f = 둘러보기 시계 u = f / FPS 초의 상태 (JS 처럼 시계를 먼저 올린 뒤 따라가는 값들을 갱신)"""
    dt, n = 1 / FPS, int(round(TOUR * FPS))
    pull = lift = 0.0
    load = {'x': 0.0, 'v': 0.0}
    clock = 0.0
    Z = Zoom(L)
    out = []
    for i in range(2 * n):
        clock += dt
        t = tour_at(clock)
        if PANEL == 'rack':
            Z.tour(t['rz'], t['rs'])
        else:
            Z.tour(t['gz'], t['gs'])
        pull += (t['pull'] - pull) * (1 - math.exp(-dt / 0.6))
        if abs(t['pull'] - pull) < 0.05:
            pull = t['pull']
        lift += (t['lift'] - lift) * (1 - math.exp(-dt / 0.6))
        if abs(t['lift'] - lift) < 0.002:
            lift = t['lift']
        Z.step(dt)
        settle(load, t['load'], dt, 1.8)
        if n - 1 <= i < 2 * n - 1:      # 시계 = TOUR + f·dt (f = 0 … n−1)
            out.append({'pull': pull, 'lift': lift, 'load': load['x'], 'rect': Z.rect(), 'k': Z.k})
    return out


# =============================================================
# 6) 장면에 상태 적용 · 렌더
# =============================================================
HEAT = {'rack': 4.0, 'gpu': 2.2}   # 부하 1 일 때 열 빛 세기 (너무 세면 AgX 가 흰색으로 바램)


def apply_state(rig, cam, st):
    if PANEL == 'rack':
        rig['tray'].location = V(0, st['pull'], 0)
        M['hot_copper'].node_tree.nodes['heat'].outputs[0].default_value = st['load'] * HEAT['rack']
    else:
        pl = L['plateLift'] * sm(0, .65, st['lift'])
        ld = sm(.35, 1, st['lift'])
        rig['plate'].location = V(0, 0, pl)
        lm = L['lidMove']
        rig['lid'].location = V(lm[0] * ld, lm[1] * ld, lm[2] * ld)
        M['hot_die'].node_tree.nodes['heat'].outputs[0].default_value = st['load'] * HEAT['gpu']
        fade = st['fade'] if 'fade' in st else sm(0, .6, st['k'])   # 기판 확대 때 앞층(냉각판·뚜껑) 흐림
        for m in FADES:
            m.node_tree.nodes['fade'].outputs[0].default_value = fade
        for ob in rig['plate'].children + rig['lid'].children:      # 다 흐려졌으면 렌더에서 뺌 (빠르고 깨끗함)
            ob.hide_render = fade > 0.999
    set_view(cam, st['rect'])


def visible_key(st):
    """화면에 보이는 것만으로 만든 열쇠 — 앞 프레임과 같으면 렌더하지 않고 복사"""
    r = tuple(round(v, 2) for v in st['rect'])
    if PANEL == 'rack':
        # 트레이 냉각판이 랙 앞면(Y1) 밖으로 나와야 열 빛이 보임 (그 전엔 부하가 바뀌어도 화면은 같음)
        out = st['pull'] > L['Y1'] - max(g['y'] + g['d'] for g in L['GPUS']) - 4
        return (round(st['pull'], 2), r, round(st['load'], 2) if out else None)
    # 다이는 뚜껑이 들리거나 앞층이 흐려질 때(확대)만 보임
    ld = sm(.35, 1, st['lift'])
    return (round(st['lift'], 4), r, round(st['load'], 2) if (ld > 0.001 or st['k'] > 0.001) else None)


def render_to(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def check_alignment(cam):
    """맞춤 검사: 그림 투영식과 Blender 카메라로 같은 점을 찍어 px 차이 (전체 화면 보기에서)"""
    from bpy_extras.object_utils import world_to_camera_view
    set_view(cam, (0, 0, WPX, HPX))
    bpy.context.view_layer.update()
    pts = [(L['X0'], L['Y0'], 0), (L['X1'], L['Y1'], L['TOP']), (0, L['Y1'], 50)] if PANEL == 'rack' else \
          [(L['BENCH']['x'], L['BENCH']['y'], 0), (54, 50, L['PTOP']), (0, 0, L['DT'])]
    worst = 0
    for p in pts:
        n = world_to_camera_view(scene, cam, V(*p))
        bx, by = n.x * WPX, (1 - n.y) * HPX
        ix, iy = iso_px(p)
        worst = max(worst, abs(bx - ix), abs(by - iy))
    print(f"맞춤 검사: 그림과 최대 {worst:.3f} px 차이 (그림 {WPX}×{HPX} px 기준)")


def main():
    if MODE == 'count':   # 렌더할 장 수만 셈 (장면은 안 씀)
        frames = simulate()
        keys = [visible_key(st) for st in frames]
        unique = sum(1 for i, k in enumerate(keys) if FROM <= i <= TO and (i == 0 or k != keys[i - 1]))
        print(f"{PANEL}: {len(frames)} 프레임 중 렌더 {unique} 장" + (f" ({FROM}번부터)" if FROM else ""))
        return
    os.makedirs(OUT, exist_ok=True)
    rig = build_rack() if PANEL == 'rack' else build_gpu()
    cam = make_camera()
    if PANEL == 'rack':
        studio(LIGHT_O, 1.0, -L['FOOT_H'] * S)
    else:
        studio(Vector((0, 0, 0.03)), 0.15, (L['BENCH_Z'] - L['FOOT']) * S)   # GPU 장면은 랙의 약 0.15 배 크기
    render_setup(RES_X, SAMPLES)
    check_alignment(cam)
    full = (0, 0, WPX, HPX)
    if MODE == 'still':
        # 다 연 모습 (움직임 줄이기 설정 + 랙 직접 확대): 랙 = 트레이 끝까지 꺼냄, GPU = 냉각판·뚜껑 들림, 부하 1, 확대 없음
        st = {'pull': LAY['rack']['STROKE'], 'lift': 1.0, 'load': 1.0, 'rect': full, 'k': 0}
        apply_state(rig, cam, st)
        render_to(os.path.join(OUT, f"{PANEL}-open.png"))
        if PANEL == 'gpu':   # GPU 직접 확대용: 앞층이 다 흐려진 기판만 (그림도 확대하면 냉각판·뚜껑을 감춤)
            time.sleep(REST)
            apply_state(rig, cam, {**st, 'fade': 1.0})
            render_to(os.path.join(OUT, "gpu-board.png"))
        return
    frames = simulate()
    if MODE == 'at':      # 한 순간만 (다듬기용)
        apply_state(rig, cam, frames[min(len(frames) - 1, int(round(AT * FPS)))])
        render_to(os.path.join(OUT, f"at-{PANEL}-{AT:04.1f}.png"))
        return
    if MODE == 'test':    # 확인용: 둘러보기의 몇 순간
        for u in ((0.5, 2.8, 4.2, 9.6, 13.4) if PANEL == 'rack' else (0.5, 16.2, 17.2, 18.6, 24.0)):
            apply_state(rig, cam, frames[min(len(frames) - 1, int(round(u * FPS)))])
            render_to(os.path.join(OUT, f"test-{PANEL}-{u:04.1f}.png"))
        return
    d = os.path.join(OUT, PANEL)
    os.makedirs(d, exist_ok=True)
    prev_key, prev_path, rendered, t0 = None, None, 0, time.time()
    for f, st in enumerate(frames):
        path = os.path.join(d, f"f{f:04d}.png")
        key = visible_key(st)
        if LIST:   # 점검용: 고른 번호만 (복사 없이 그대로 렌더)
            if f in LIST:
                apply_state(rig, cam, st)
                render_to(path)
                rendered += 1
                if REST:
                    time.sleep(REST)
            continue
        if f < FROM:   # 이어 렌더·구간 렌더: 앞쪽 프레임은 건너뜀 (있으면 다음 프레임 복사 판단에만 씀)
            prev_key, prev_path = key, (path if os.path.exists(path) else None)
            continue
        if f > TO:
            break
        if key == prev_key and prev_path:
            shutil.copyfile(prev_path, path)
        else:
            apply_state(rig, cam, st)
            render_to(path)
            rendered += 1
            if REST:
                time.sleep(REST)                  # 쉬어 가며 (노트북 열 식히기)
        prev_key, prev_path = key, path
        if f % 24 == 0:
            print(f"{PANEL} 프레임 {f}/{len(frames)} · 렌더 {rendered} · {time.time() - t0:.0f}초", flush=True)
    print(f"끝: {len(frames)} 프레임 중 {rendered} 장 렌더, {time.time() - t0:.0f}초")


main()
