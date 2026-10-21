# =============================================================
# horizon-hall.py — 차일드레스 Horizon 액체냉각 홀 3D 모형 (Blender 5.2 에서 실행)
# -------------------------------------------------------------
# 이 파일 하나가 모형의 "설계도"입니다. 실행하면 장면을 비우고 처음부터 다시 세웁니다.
#   · 겉모습(A): 닫힌 건물 + 마당 설비 (건식 냉각기·칠러·펌프·발전기·변압기·1차 배관)
#   · 속(B): 지붕·앞쪽 벽 윗부분을 걷으면 전기실·CDU·천장 배관·버스웨이·광케이블 트레이
#   · 랙 틀 2개: 멀리용(rack_lo, 상자 몇 개)·확대용(rack_hi, 매니폴드·호스·버스바까지)
#     → 랙 348대는 GLB 에 한 대씩 넣지 않고 "자리 목록"만 넣어, 웹이 틀 하나를 348번 찍음(인스턴싱)
#
# 근거 (회사 자료 = scripts/anatomy/horizon/model.mjs 의 SOURCES)
#   · Horizon 1 = 전체 75 MW / IT 50 MW, 랙 130~200 kW, Tier III 수준 동시 유지보수
#   · 냉각 = 칠러 플랜트·칠러·건식 냉각기·CDU, 백업 = UPS·디젤 발전기, 중압 변압기 2대, GPU = Dell 공급 GB300 NVL72
#   · 그림 표현(회사 미공개): 건물 크기, 설비 대수·배치, 랙 줄 배치·배관 경로
#     (랙 348대 = 사이트 가정: IT 50 MW ÷ GPU 1개당 2.0 kW ÷ 랙당 GPU 72개)
#
# 실행 방법
#   1) Blender 안(또는 Blender MCP)에서:
#        exec(open(이 파일).read(), {"__name__": "__main__", "OUT": "저장 폴더", "WEB_GZ": "웹용 .glb.gz 경로"})
#   2) 터미널에서:  blender -b -P scripts/blender/horizon-hall.py -- 저장폴더 [웹용 .glb.gz 경로]
#   → 저장 폴더: horizon-hall.blend · horizon-hall.glb · preview-A/B/C.png
#     웹용 경로(주면): 같은 GLB 를 gzip 으로 줄인 파일 (iren-3d 는 public/models/horizon-hall.glb.gz)
#
# 좌표: 1 = 1 m. Blender 는 z 가 위, 부지 가운데가 원점, -y(남쪽) = 마당.
#   GLB 는 y 가 위 → (x, y, z)Blender = (x, -z, y)GLB, 마당은 +z (웹 3D 화면의 카메라 쪽)
# =============================================================
import bpy
import gzip
import json
import math
import os
import sys
from mathutils import Vector

# ---------- 1) 숫자 ----------
ROWS, PER_ROW = 12, 29                 # 랙 12줄 × 29대 = 348대 (model.mjs 의 EST.racks 와 같은 값)
CDU_PER_ROW = 3                        # 줄마다 CDU 3대: 2대 가동 + 1대 대기 (2D 그림의 동시 유지보수 표현과 같음)
LOT_X, LOT_Y = 30, 45                  # 부지 반폭: 60 × 90 m (웹 캠퍼스 블록 4 × 6 과 같은 비율)
BX0, BX1, BY0, BY1 = -28, 28, 20, 44   # 건물 바깥 모서리 (56 × 24 m)
H, T, FL, LOW = 8.0, 0.3, 0.3, 1.5     # 벽 높이 · 벽 두께 · 바닥판 높이 · 속 보기에서 남기는 앞벽 높이
EX = -12                               # 전기실 | 데이터홀 칸막이 x
PAIR = 5.4                             # 등 맞댄 두 줄 + 통로 = 랙 1.2 + 더운 통로 1.2 + 랙 1.2 + 찬 통로 1.8
RACK_D, RACK_W, RACK_H = 1.2, 0.6, 2.3 # NVL72 랙 깊이·폭·높이 (대략)
CDU_W = 0.8                            # CDU 한 대 폭 (줄 방향)
SUP_Z, RET_Z = 3.0, 3.3                # 천장 2차 배관 높이 (바닥 위): 공급(찬물) · 회수(데워진 물)
BUS_Z, FIB_Z = 2.7, 2.5                # 버스웨이 · 광케이블 트레이 높이 (바닥 위)
TEMPLATE_Z = -20.0                     # 랙 틀을 땅속에 숨겨 둠 (일반 GLB 뷰어에서 마당과 겹쳐 보이지 않게)

# 랙 줄: 줄 가운데 x 와 앞면 방향 (-1 = 서쪽 찬 통로를 봄, +1 = 동쪽). 두 줄씩 뒷면(매니폴드)이 더운 통로를 사이에 두고 마주 봄
RX0 = EX + 4.7
ROW_LIST = []
for _p in range(ROWS // 2):
    _x0 = RX0 + _p * PAIR
    ROW_LIST += [(_x0 + RACK_D / 2, -1), (_x0 + 2 * RACK_D + 1.2 - RACK_D / 2, +1)]
CDU_Y0 = BY0 + T + 0.7                 # CDU 는 남쪽 벽 바로 안쪽부터 (1차 배관이 벽을 지나 들어옴)
RACK_Y0 = CDU_Y0 + CDU_PER_ROW * CDU_W # 그 뒤로 랙 29대
Y_END = RACK_Y0 + PER_ROW * RACK_W

# 마당 배치
SUP_Y, RET_Y, P_SUP_Z, P_RET_Z = 17.6, 16.2, 1.2, 2.2   # 1차 공급(찬물)·회수(데워진 물) 본관 위치·높이
DC_COLS = [-14, 0, 14]                                   # 건식 냉각기 열 가운데 x (모듈 길이 12 m)
DC_ROWS = [9.5, 5.0, 0.5, -4.0, -8.5]                    # 건식 냉각기 줄 가운데 y
CHILLER_X = [-21, -7, 7, 21]                             # 칠러 패키지 4대
GEN_COUNT = 12                                           # 디젤 발전기 (대수는 그림 표현)
XFMR_X = [-24.0, -17.0]                                  # 중압 변압기 A·B (회사 영상: 2대)
XFMR_Y = 14.4


# ---------- 2) 장면 비우기 ----------
def clear_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for blocks in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.collections):
        for item in list(blocks):
            blocks.remove(item)


# ---------- 3) 색과 재질 ----------
def lin(hexstr):
    """sRGB 16진수 색 → Blender 가 쓰는 선형 값"""
    h = hexstr.lstrip('#')
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb)


def make_mat(name, hexstr, rough=0.6, metal=0.0, emit=0.0):
    """Principled BSDF 재질 (노드는 이름이 아니라 종류로 찾음 — 한글 UI 에서도 동작)"""
    m = bpy.data.materials.new("HZ_" + name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:  # 노드가 비어 있으면 직접 만들어 출력에 연결
        bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
        out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(bsdf.outputs[0], out.inputs[0])
    c = lin(hexstr)
    bsdf.inputs['Base Color'].default_value = (*c, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*c, 1)
        bsdf.inputs['Emission Strength'].default_value = emit
    m.diffuse_color = (*c, 1)  # 솔리드 보기용 색
    return m


# 이름: (색, 거칠기, 금속성, 빛남) — 웹은 재질 이름(HZ_status 등)으로 색을 바꾸기도 함
MAT_SPEC = {
    'pad':     ('#cdc9c0', 0.9),           # 콘크리트 부지
    'slab':    ('#b9bec5', 0.85),          # 건물 바닥판·벽 아랫단
    'floor':   ('#d7dbe0', 0.45),          # 홀 바닥 (에폭시)
    'wall':    ('#eceff2', 0.6),           # 단열 금속 패널 벽
    'rib':     ('#d9dee4', 0.5),           # 벽 골 (세로 줄)
    'roof':    ('#e2e5e8', 0.7),
    'trim':    ('#0b344f', 0.5),           # IREN 남색 띠
    'status':  ('#3fbf6f', 0.5),           # 상태색 띠 (웹이 가동·시운전 색으로 바꿈)
    'rack':    ('#1b2230', 0.45, 0.35),    # NVL72 랙 몸체
    'led':     ('#55f0cc', 0.4, 0.0, 3.0), # 랙 앞 표시등 (빛남)
    'tray':    ('#b9bfc7', 0.35, 0.8),     # 컴퓨트 트레이
    'switch':  ('#121418', 0.4, 0.3),      # NVLink 스위치 트레이
    'pshelf':  ('#7d8590', 0.5, 0.5),      # 전원 선반
    'cdu':     ('#e9ebee', 0.5),           # 냉각수 분배기
    'screen':  ('#0f1720', 0.2),           # 화면·창
    'supply':  ('#2f6fd6', 0.4, 0.2),      # 찬물 (2차 공급)
    'return':  ('#d6453a', 0.4, 0.2),      # 데워진 물 (2차 회수)
    'insul':   ('#cdd2d7', 0.35, 0.7),     # 보온 알루미늄 배관 (1차)
    'busway':  ('#9aa2ab', 0.4, 0.6),      # 버스웨이 (굵은 전원 통로)
    'copper':  ('#c27a45', 0.3, 0.9),      # 직류 버스바
    'fiber':   ('#f2c230', 0.5),           # 노란 광케이블
    'hose':    ('#20242a', 0.6),           # 검정 호스·전원 코드
    'swgr':    ('#c9ced6', 0.5, 0.2),      # 배전반
    'ups':     ('#2b313b', 0.5, 0.2),      # UPS
    'battery': ('#3d4450', 0.6, 0.1),      # 배터리 함
    'coil':    ('#9fb09c', 0.6, 0.3),      # 핀 코일 (건식 냉각기·칠러)
    'unit':    ('#eef0f2', 0.55),          # 설비 외함 흰색
    'fan':     ('#3a414c', 0.5, 0.3),      # 팬 날개 자리 (어두움)
    'shroud':  ('#c7ccd2', 0.5, 0.3),      # 팬 둘레 통
    'steel':   ('#8b939c', 0.5, 0.6),      # 강철 받침·기둥
    'gen':     ('#e4dac2', 0.6),           # 발전기 외함 (크림색)
    'tank':    ('#3a3f47', 0.7),           # 발전기 밑 연료 탱크
    'xfmr':    ('#9aa1a8', 0.55, 0.3),     # 변압기
    'pump':    ('#2e5fa8', 0.4, 0.3),      # 펌프
    'bollard': ('#f2c230', 0.5),           # 노란 보호 기둥·안전선
    'green':   ('#71da80', 0.5, 0.0, 1.5), # IREN 초록 (가동 표시등)
}
M = {}


# ---------- 4) 메시 모으개 ----------
class Builder:
    """상자·원통 여러 개를 메시 하나로 모읍니다 (면마다 재질 번호) → 물체 수·그리기 호출이 적음"""

    def __init__(self, name):
        self.name = name
        self.v, self.f, self.fm, self.fs = [], [], [], []  # 점 · 면 · 면 재질 번호 · 면 매끈함
        self.mats = []

    def _mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _face(self, idx, m, smooth=False):
        self.f.append(tuple(idx))
        self.fm.append(self._mi(m))
        self.fs.append(smooth)

    def box(self, m, cx, cy, z0, sx, sy, sz):
        """가운데 (cx, cy), 바닥 높이 z0, 크기 sx·sy·sz 인 상자"""
        hx, hy, b = sx / 2, sy / 2, len(self.v)
        for (x, y, z) in [(-hx, -hy, 0), (hx, -hy, 0), (hx, hy, 0), (-hx, hy, 0),
                          (-hx, -hy, sz), (hx, -hy, sz), (hx, hy, sz), (-hx, hy, sz)]:
            self.v.append((cx + x, cy + y, z0 + z))
        # 면 6개 (바깥에서 볼 때 반시계 방향 → 법선이 바깥을 향함)
        for q in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (3, 0, 4, 7), (1, 2, 6, 5)]:
            self._face([b + i for i in q], m)

    def cyl(self, m, p0, p1, r, seg=12, cap0=True, cap1=True):
        """p0 → p1 을 잇는 원통 (관·굴뚝). 옆면은 매끈하게, 뚜껑은 평평하게 (안 보이는 뚜껑은 끌 수 있음)"""
        p0, p1 = Vector(p0), Vector(p1)
        d = (p1 - p0).normalized()
        u = d.cross(Vector((0, 0, 1)))
        if u.length < 1e-6:  # 세로 원통이면 x 축으로 기준을 잡음
            u = d.cross(Vector((1, 0, 0)))
        u.normalize()
        w = d.cross(u)  # (u, w, d) 가 오른손 좌표계 → 둘레가 반시계로 돎
        b = len(self.v)
        for p in (p0, p1):
            for i in range(seg):
                a = 2 * math.pi * i / seg
                self.v.append(tuple(p + r * (math.cos(a) * u + math.sin(a) * w)))
        for i in range(seg):
            j = (i + 1) % seg
            self._face([b + i, b + j, b + seg + j, b + seg + i], m, smooth=True)
        if cap0:
            self._face([b + i for i in reversed(range(seg))], m)
        if cap1:
            self._face([b + seg + i for i in range(seg)], m)

    def disk(self, m, x, y, z, r, seg=16):
        """위를 보는 납작한 원판 하나 (팬 날개 자리처럼 위에서만 보이는 것)"""
        b = len(self.v)
        for i in range(seg):
            a = 2 * math.pi * i / seg
            self.v.append((x + r * math.cos(a), y + r * math.sin(a), z))
        self._face([b + i for i in range(seg)], m)

    def finish(self, parent, **props):
        """모은 점·면으로 물체 하나를 만들고 정보(웹에서 userData 로 읽힘)를 붙임"""
        me = bpy.data.meshes.new(self.name)
        me.from_pydata(self.v, [], self.f)
        for m in self.mats:
            me.materials.append(m)
        me.polygons.foreach_set("material_index", self.fm)
        me.polygons.foreach_set("use_smooth", self.fs)
        me.update()
        ob = bpy.data.objects.new(self.name, me)
        link(ob, parent, **props)
        return ob


def link(ob, parent, **props):
    """물체를 부모(컬렉션 또는 빈 물체) 아래에 넣고 정보 붙이기"""
    if isinstance(parent, bpy.types.Collection):
        parent.objects.link(ob)
    else:
        parent.users_collection[0].objects.link(ob)
        ob.parent = parent
    for k, v in props.items():
        ob[k] = v
    return ob


def empty(name, parent, loc=(0, 0, 0), **props):
    ob = bpy.data.objects.new(name, None)
    ob.location = loc
    return link(ob, parent, **props)


# 웹이 읽는 정보 (GLB extras → three.js userData)
#   part 부품 이름 · show(always 늘 / closed 닫혔을 때 / open 속을 열었을 때 / template 틀) · count 대수
#   label_* 이름 · role_* 하는 일 · basis_* 무엇이 회사 자료이고 무엇이 그림 표현인지 (한국어 ko / 영어 en)
#   → 확대 보기 창(HorizonViewer)에서 부품을 누르면 이 글이 카드로 뜸
TEXT = {
    "pad": ("부지", "Site pad",
            "건물과 설비가 놓인 콘크리트 부지", "Concrete pad under the building and equipment",
            "그림 표현", "Illustrative"),
    "shell": ("건물", "Building",
              "단열 금속 패널 건물. 확대 창의 '지붕' 단추로 지붕을 덮거나 걷을 수 있음",
              "Insulated metal-panel building. The roof button shows or lifts the roof",
              "그림 표현: 크기·모양 (회사 미공개)", "Illustrative: size and shape not disclosed"),
    "status": ("상태 띠", "Status band",
               "가동·시운전 같은 건물 상태 색 (캠퍼스 화면과 같은 색)", "Building status color, as on the campus view",
               "사이트 표시", "Site marker"),
    "dry_cooler": ("건식 냉각기", "Dry coolers",
                   "데워진 냉각수를 바깥 공기로 식힘. 팬이 핀 코일 사이로 공기를 위로 뽑아냄 — 물을 증발시키지 않아 물을 거의 안 씀",
                   "Cool the warm water with outside air; fans pull air up through finned coils — no evaporation, so little water use",
                   "회사 확인: 설비 종류 (6-K 2025-01) · 그림 표현: 대수·배치",
                   "Company: equipment type (6-K, Jan 2025) · Illustrative: count and layout"),
    "chiller": ("칠러", "Chillers",
                "더운 날 건식 냉각기만으로 물이 덜 식으면 압축기로 더 식혀 거듦",
                "On hot days, compressors help when the dry coolers alone can't cool the water enough",
                "회사 확인: 설비 종류 (6-K 2025-01) · 그림 표현: 대수·배치",
                "Company: equipment type (6-K, Jan 2025) · Illustrative: count and layout"),
    "pump": ("냉각수 펌프", "Pumps",
             "1차 냉각수를 냉각 설비와 건물 사이로 돌림 (1대는 예비)",
             "Circulate the facility water between the cooling plant and the hall (one spare)",
             "그림 표현", "Illustrative"),
    "generator": ("디젤 발전기", "Diesel generators",
                  "전력망이 끊기면 켜져 전기를 대신 공급 — 켜지는 몇 초 동안은 UPS 배터리가 버팀",
                  "Start when the grid fails and carry the load; UPS batteries bridge the seconds while they start",
                  "회사 확인: 설비 종류 (6-K 2025-01) · 그림 표현: 대수·배치",
                  "Company: equipment type (6-K, Jan 2025) · Illustrative: count and layout"),
    "transformer": ("중압 변압기", "MV transformers",
                    "변전소에서 온 중압 전기를 건물에서 쓰는 낮은 전압으로 낮춤 (A·B 두 갈래)",
                    "Step medium-voltage power from the substation down to building voltage (A and B paths)",
                    "회사 확인: 2대 (2025-06 회사 영상) · 그림 표현: 배치",
                    "Company: two units (June 2025 company video) · Illustrative: layout"),
    "pipes_primary": ("1차 냉각수 배관", "Primary water loop",
                      "시설 냉각수: 찬물(파랑 점)은 CDU 로, 데워진 물(빨강 점)은 건식 냉각기·칠러로",
                      "Facility water: cold (blue dots) to the CDUs, warm (red dots) back to the dry coolers and chillers",
                      "회사 영상: 건물 옆 굵은 보온 배관 · 그림 표현: 경로",
                      "Company video: thick insulated pipes along the building · Illustrative: routing"),
    "electrical": ("전기실 (배전반·UPS·배터리)", "Electrical room (switchgear, UPS, batteries)",
                   "배전반이 전기를 나누고 UPS·배터리가 정전 순간을 메움. A·B 두 갈래라 한쪽을 정비해도 GPU 는 계속 돎 (Tier III 수준 동시 유지보수)",
                   "Switchgear distributes power; UPS batteries ride through outages. Two paths (A/B) let one be serviced while GPUs keep running (Tier III-level concurrent maintainability)",
                   "회사 확인: UPS (6-K 2025-01)·동시 유지보수 (2025-11 자료) · 그림 표현: 대수·배치",
                   "Company: UPS (6-K, Jan 2025) and concurrent maintainability (Nov 2025) · Illustrative: count and layout"),
    "cdu": ("냉각수 분배기 (CDU)", "Coolant distribution units (CDU)",
            "랙을 도는 깨끗한 2차 냉각수와 시설 1차 냉각수 사이에서 열을 넘겨주는 열교환기·펌프. 줄마다 2대 가동 + 1대 대기",
            "Heat exchangers and pumps between the clean rack loop and the facility water. Per row: two running, one standby",
            "회사 확인: CDU (6-K 2025-01) · 그림 표현: 줄마다 3대",
            "Company: CDUs (6-K, Jan 2025) · Illustrative: three per row"),
    "overhead": ("천장 배관·버스웨이·광케이블", "Overhead pipes, busways, fiber",
                 "파랑 = 랙으로 가는 찬물, 빨강 = 데워져 돌아오는 물, 회색 버스웨이 = 랙 전원(A·B), 노란 트레이 = GPU 끼리 잇는 광케이블",
                 "Blue = cold water to the racks, red = warm return, grey busways = rack power (A/B), yellow tray = fiber linking the GPUs",
                 "회사 영상: 노란 광케이블·구리 냉각판 · 그림 표현: 경로",
                 "Company video: yellow fiber and copper cold plates · Illustrative: routing"),
    "racks": ("GB300 NVL72 랙", "GB300 NVL72 racks",
              "랙 1대 = GPU 72개(한 NVLink 도메인), 약 130~200 kW. 칩 위 구리 냉각판으로 물이 직접 지나가 열을 가져감",
              "One rack = 72 GPUs (one NVLink domain), about 130–200 kW. Water runs through copper cold plates right on the chips",
              "회사 확인: GB300 NVL72 (Dell 공급)·랙 130~200 kW · 그림 표현: 줄 배치 · 사이트 가정: 348대",
              "Company: GB300 NVL72 (supplied by Dell), 130–200 kW racks · Illustrative: row layout · Site assumption: 348 racks"),
    "rack_template": ("랙 틀", "Rack template", "랙 348대를 찍어 그리는 틀", "Template stamped at every rack slot",
                      "그림 표현", "Illustrative"),
}


def info(part, show, count=None, text=None):
    """부품 정보 묶음 — 글은 TEXT[text 또는 part] 에서"""
    lk, le, rk, re_, bk, be = TEXT[text or part]
    d = {"part": part, "show": show, "label_ko": lk, "label_en": le, "role_ko": rk, "role_en": re_, "basis_ko": bk, "basis_en": be}
    if count is not None:
        d["count"] = count
    return d


# ---------- 5) 부품 그리기 ----------
def fan(b, x, y, z, r=0.9):
    """위로 부는 팬: 둘레 통(옆면 + 윗면) + 어두운 날개 자리 + 가운데 축"""
    b.cyl(M['shroud'], (x, y, z), (x, y, z + 0.3), r, 16, cap0=False)
    b.disk(M['fan'], x, y, z + 0.33, r * 0.88, 16)   # 뚜껑보다 3 cm 위 (멀리서 두 면이 겹쳐 깜빡이지 않게)
    b.cyl(M['steel'], (x, y, z + 0.33), (x, y, z + 0.41), 0.13, 6, cap0=False)


def dry_cooler(b, cx, cy):
    """건식 냉각기 모듈: 다리 위 핀 코일 + 위로 부는 팬 6개 + 끝 헤더 상자 (물이 드나드는 곳)"""
    L, W = 12.0, 2.4
    for dx in (-L / 2 + 0.3, L / 2 - 0.3):
        for dy in (-W / 2 + 0.2, W / 2 - 0.2):
            b.box(M['steel'], cx + dx, cy + dy, 0, 0.15, 0.15, 1.0)
    b.box(M['steel'], cx, cy, 1.0, L, W, 0.12)
    b.box(M['coil'], cx, cy, 1.12, L - 0.1, W - 0.1, 1.5)
    b.box(M['unit'], cx, cy, 2.62, L, W, 0.2)
    for i in range(6):
        fan(b, cx - L / 2 + 1.0 + i * 2.0, cy, 2.82)
    b.box(M['steel'], cx + L / 2 + 0.25, cy, 1.2, 0.5, 1.6, 1.2)


def chiller(b, cx, cy):
    """칠러 패키지: 아래 압축기 칸 + 위 응축 코일 + 팬 4개 (더운 날 건식 냉각기를 거든다)"""
    L, W = 10.0, 3.0
    b.box(M['steel'], cx, cy, 0, L + 0.4, W + 0.4, 0.3)
    b.box(M['unit'], cx, cy, 0.3, L, W, 1.3)
    b.box(M['coil'], cx, cy, 1.6, L, W, 1.2)
    b.box(M['unit'], cx, cy, 2.8, L, W, 0.15)
    for i in range(4):
        fan(b, cx - L / 2 + 1.25 + i * 2.5, cy, 2.95)
    for i in range(4):
        b.box(M['steel'], cx - L / 2 + 1.2 + i * 2.2, cy - W / 2 - 0.02, 0.5, 1.6, 0.04, 0.9)
    b.box(M['screen'], cx + L / 2 - 0.8, cy - W / 2 - 0.03, 1.0, 0.6, 0.04, 0.5)


def pump_skid(b, cx, cy):
    """펌프 받침: 펌프 2대(1대 예비) + 모터"""
    b.box(M['steel'], cx, cy, 0, 4.0, 2.0, 0.25)
    for dx in (-1.0, 1.0):
        b.cyl(M['pump'], (cx + dx - 0.5, cy, 0.7), (cx + dx + 0.3, cy, 0.7), 0.35, 12)
        b.box(M['pump'], cx + dx + 0.6, cy, 0.4, 0.6, 0.5, 0.6)


def generator(b, cx, cy):
    """디젤 발전기: 기초 연료 탱크 + 방음 외함 + 지붕 소음기·굴뚝"""
    L, W = 10.0, 3.0
    b.box(M['tank'], cx, cy, 0, W + 0.2, L + 0.2, 0.9)
    b.box(M['gen'], cx, cy, 0.9, W, L, 3.0)
    for k in range(4):
        b.box(M['steel'], cx + W / 2 + 0.02, cy - L / 2 + 1.5 + k * 2.3, 1.2, 0.04, 1.4, 2.0)
    b.box(M['fan'], cx, cy + L / 2 + 0.02, 1.3, W - 0.6, 0.04, 2.2)
    b.box(M['steel'], cx, cy - 1.0, 3.9, 0.3, 0.3, 0.3)
    b.box(M['steel'], cx, cy + 0.8, 3.9, 0.3, 0.3, 0.3)
    b.cyl(M['steel'], (cx, cy - 2.0, 4.35), (cx, cy + 1.5, 4.35), 0.4, 12)
    b.cyl(M['steel'], (cx, cy + 1.5, 4.35), (cx, cy + 1.5, 5.6), 0.2, 8, cap0=False)


def transformer(b, cx, cy):
    """중압 변압기: 콘크리트 기초 + 탱크 + 옆 방열판 + 부싱 + 저압 목 + 전기실로 가는 버스 덕트"""
    b.box(M['pad'], cx, cy, 0, 5.0, 4.4, 0.25)
    b.box(M['xfmr'], cx, cy, 0.25, 3.2, 2.6, 3.0)
    for side in (-1, 1):
        for k in range(8):
            b.box(M['xfmr'], cx + side * 1.8, cy - 1.05 + k * 0.3, 0.5, 0.4, 0.07, 2.4)
    for k in range(3):
        b.cyl(M['steel'], (cx - 0.8 + k * 0.8, cy - 0.7, 3.25), (cx - 0.8 + k * 0.8, cy - 0.7, 3.9), 0.11, 8, cap0=False)
    b.box(M['xfmr'], cx, cy + 0.8, 3.25, 2.0, 0.8, 0.5)
    duct_len = BY0 - (cy + 1.2)
    b.box(M['busway'], cx, cy + 1.2 + duct_len / 2, 3.5, 0.6, duct_len, 0.5)
    b.box(M['steel'], cx, cy + 1.2 + duct_len / 2, 0, 0.18, 0.18, 3.5)
    for (dx, dy) in [(-2.6, -2.3), (2.6, -2.3), (-2.6, 2.3), (2.6, 2.3)]:
        b.cyl(M['bollard'], (cx + dx, cy + dy, 0), (cx + dx, cy + dy, 1.1), 0.1, 8, cap0=False)


def rack_lo(b):
    """멀리용 랙 틀 (원점 = 랙 바닥 가운데, 앞면 = +x): 몸체 + 앞 표시등 줄 + 뒤 매니폴드 띠 2개"""
    b.box(M['rack'], 0, 0, 0, RACK_D, RACK_W - 0.02, RACK_H)
    b.box(M['led'], RACK_D / 2 + 0.006, 0.2, 0.35, 0.012, 0.04, 1.5)
    b.box(M['supply'], -RACK_D / 2 - 0.006, -0.24, 0.15, 0.012, 0.05, 2.0)
    b.box(M['return'], -RACK_D / 2 - 0.006, 0.24, 0.15, 0.012, 0.05, 2.0)


KINDS = ['p'] * 3 + ['c'] * 8 + ['s'] * 9 + ['c'] * 10 + ['p'] * 3   # 아래부터: 전원 선반·컴퓨트·NVLink 스위치·컴퓨트·전원 선반


def rack_hi(b):
    """확대용 GB300 NVL72 랙 틀 (원점 = 랙 바닥 가운데, 앞면 = +x, 뒷면 = -x)
    뒤: 칸 끝·퀵 커넥터·공급/회수 매니폴드·직류 버스바·호스 / 앞: 트레이 앞판·표시등·노란 광케이블 / 위: 탭오프·전원 코드"""
    bx, fx = -RACK_D / 2, RACK_D / 2
    b.box(M['rack'], 0, 0, 0, RACK_D, RACK_W - 0.02, RACK_H)
    for i, kd in enumerate(KINDS):
        z = 0.12 + i * 0.062
        mt = M['pshelf'] if kd == 'p' else M['switch'] if kd == 's' else M['tray']
        b.box(mt, bx - 0.005, -0.11, z, 0.01, 0.17, 0.05)     # 뒤: 칸 끝 (왼쪽)
        b.box(mt, bx - 0.005, 0.11, z, 0.01, 0.17, 0.05)      # 뒤: 칸 끝 (오른쪽)
        b.box(mt, fx + 0.005, 0, z, 0.01, 0.52, 0.05)         # 앞: 트레이 앞판
        if kd == 'c':
            b.box(M['steel'], bx - 0.04, -0.235, z + 0.01, 0.03, 0.03, 0.03)   # 퀵 커넥터 (공급)
            b.box(M['steel'], bx - 0.04, 0.235, z + 0.01, 0.03, 0.03, 0.03)    # 퀵 커넥터 (회수)
            b.box(M['led'], fx + 0.012, 0.22, z + 0.015, 0.006, 0.03, 0.02)   # 앞 표시등
    b.cyl(M['supply'], (bx - 0.04, -0.255, 0.15), (bx - 0.04, -0.255, 2.2), 0.028, 10)   # 공급 매니폴드
    b.cyl(M['return'], (bx - 0.04, 0.255, 0.15), (bx - 0.04, 0.255, 2.2), 0.028, 10)     # 회수 매니폴드
    b.box(M['copper'], bx - 0.012, 0, 0.12, 0.015, 0.035, 2.05)                          # 직류 버스바
    # 호스: 매니폴드 위 → 천장 배관 (공급은 랙 뒤쪽 위, 회수는 더운 통로 쪽 위 — 아래 overhead() 와 같은 자리)
    b.cyl(M['hose'], (bx - 0.04, -0.255, 2.2), (bx + 0.25, -0.255, SUP_Z - 0.1), 0.022, 8)
    b.cyl(M['hose'], (bx - 0.04, 0.255, 2.2), (bx - 0.15, 0.255, RET_Z - 0.1), 0.022, 8)
    for sy in (-0.18, 0.18):                                                             # 노란 광케이블 묶음
        b.cyl(M['fiber'], (fx + 0.05, sy, 0.12 + 11 * 0.062), (fx + 0.05, sy, FIB_Z), 0.035, 8)
    for tx in (-0.2, 0.2):                                                               # 탭오프 A·B + 전원 코드
        b.box(M['steel'], tx, 0, BUS_Z - 0.2, 0.12, 0.16, 0.18)
        b.cyl(M['hose'], (tx, 0, BUS_Z - 0.2), (tx, 0, RACK_H), 0.015, 6, cap0=False, cap1=False)


def rack_slots():
    """랙 348대 자리: (x, y, 바닥 z, 앞면 방향) — Blender 좌표"""
    out = []
    for (rx, face) in ROW_LIST:
        for k in range(PER_ROW):
            out.append((rx, RACK_Y0 + RACK_W / 2 + k * RACK_W, FL, face))
    return out


# ---------- 6) 모형 세우기 ----------
def build():
    clear_scene()
    for k, v in MAT_SPEC.items():
        M[k] = make_mat(k, *v)
    scene = bpy.context.scene
    col = bpy.data.collections.new("Horizon_hall")      # 내보내는 것 (GLB)
    scene.collection.children.link(col)
    prev = bpy.data.collections.new("HZ_preview")       # 미리보기용 (땅·빛·카메라·랙 배치) — 내보내지 않음
    scene.collection.children.link(prev)

    root = empty("Horizon_hall", col, model="horizon-hall", version=2,
                 lot_m=json.dumps([LOT_X * 2, LOT_Y * 2]), building_m=json.dumps([BX1 - BX0, BY1 - BY0, H + FL]),
                 it_mw=50, gross_mw=75, rack_kw="130-200", racks=ROWS * PER_ROW,
                 note_ko="회사 자료: IT 50 MW·전체 75 MW, GB300 NVL72, 칠러·건식 냉각기·CDU·UPS·디젤 발전기·중압 변압기 2대. "
                         "건물 크기, 설비 대수·배치, 랙 줄 배치는 회사가 밝히지 않아 그린 그림 표현입니다.",
                 note_en="Company sources: 50 MW IT / 75 MW gross, GB300 NVL72, chillers, dry coolers, CDUs, UPS, diesel generators, two MV transformers. "
                         "Building size, equipment counts, layout and rack rows are illustrative (not disclosed).")

    cy_b, ly_b, lx_b = (BY0 + BY1) / 2, BY1 - BY0, BX1 - BX0

    # 부지 콘크리트판
    b = Builder("HZ_pad")
    b.box(M['pad'], 0, 0, -0.05, LOT_X * 2, LOT_Y * 2, 0.05)
    b.finish(root, **info("pad", "always"))

    # 건물: 늘 보이는 부분 (바닥판·뒤쪽 두 벽·앞쪽 두 벽의 아랫단·칸막이 아랫부분)
    b = Builder("HZ_shell")
    b.box(M['slab'], 0, cy_b, 0, lx_b, ly_b, FL)
    b.box(M['floor'], 0, cy_b, FL, lx_b - 2 * T, ly_b - 2 * T, 0.01)
    b.box(M['wall'], 0, BY1 - T / 2, FL, lx_b, T, H)
    b.box(M['wall'], BX0 + T / 2, cy_b, FL, T, ly_b, H)
    b.box(M['slab'], 0, BY0 + T / 2, FL, lx_b, T, LOW)
    b.box(M['slab'], BX1 - T / 2, cy_b, FL, T, ly_b, LOW)
    b.box(M['wall'], EX, cy_b, FL, 0.2, ly_b - 2 * T, 3.0)
    b.box(M['bollard'], 0, BY0 + T + 0.35, FL + 0.011, lx_b - 2 * T - 0.4, 0.08, 0.004)   # 노란 안전선 (CDU 앞)
    b.finish(root, **info("shell", "always"))

    # 건물: 닫혔을 때만 (지붕·앞쪽 벽 윗부분·벽 골·남색 띠·지붕 공조기·반입문)
    b = Builder("HZ_roof")
    b.box(M['wall'], 0, BY0 + T / 2, FL + LOW, lx_b, T, H - LOW)
    b.box(M['wall'], BX1 - T / 2, cy_b, FL + LOW, T, ly_b, H - LOW)
    b.box(M['wall'], EX, cy_b, FL + 3.0, 0.2, ly_b - 2 * T, H - 3.0)
    b.box(M['roof'], 0, cy_b, FL + H, lx_b, ly_b, 0.25)
    for (cx, cy, sx, sy) in [(0, BY0 + 0.15, lx_b, 0.3), (0, BY1 - 0.15, lx_b, 0.3),
                             (BX0 + 0.15, cy_b, 0.3, ly_b), (BX1 - 0.15, cy_b, 0.3, ly_b)]:
        b.box(M['roof'], cx, cy, FL + H + 0.25, sx, sy, 0.6)
    b.box(M['trim'], 0, BY0 - 0.02, FL + H - 0.9, lx_b + 0.06, 0.04, 0.5)
    b.box(M['trim'], BX1 + 0.02, cy_b, FL + H - 0.9, 0.04, ly_b + 0.06, 0.5)
    for i in range(int(lx_b / 1.2)):
        b.box(M['rib'], BX0 + 0.6 + i * 1.2, BY0 - 0.04, FL + LOW, 0.08, 0.08, H - LOW - 1.0)
    for i in range(int(ly_b / 1.2)):
        b.box(M['rib'], BX1 + 0.04, BY0 + 0.6 + i * 1.2, FL + LOW, 0.08, 0.08, H - LOW - 1.0)
    b.box(M['fan'], BX1 + 0.03, 32, FL, 0.06, 4.5, 4.5)
    for i in range(4):
        ax = -18 + i * 12
        b.box(M['unit'], ax, 32, FL + H + 0.25, 4, 2.4, 1.6)
        for dx in (-1, 1):
            fan(b, ax + dx, 32, FL + H + 1.85, 0.6)
    b.finish(root, **info("roof", "closed", text="shell"))

    # 상태색 띠: 닫혔을 땐 지붕 난간 위, 열었을 땐 잘린 벽 위 (웹이 HZ_status 재질 색을 상태색으로 바꿈)
    b = Builder("HZ_status_roof")
    for (cx, cy, sx, sy) in [(0, BY0 + 0.15, lx_b, 0.32), (BX1 - 0.15, cy_b, 0.32, ly_b)]:
        b.box(M['status'], cx, cy, FL + H + 0.85, sx, sy, 0.08)
    b.finish(root, **info("status", "closed"))
    b = Builder("HZ_status_walls")
    for (cx, cy, sx, sy, z) in [(0, BY0 + T / 2, lx_b, T + 0.02, FL + LOW), (BX1 - T / 2, cy_b, T + 0.02, ly_b, FL + LOW),
                                (0, BY1 - T / 2, lx_b, T + 0.02, FL + H), (BX0 + T / 2, cy_b, T + 0.02, ly_b, FL + H)]:
        b.box(M['status'], cx, cy, z, sx, sy, 0.08)
    b.finish(root, **info("status", "open"))

    # ----- 마당 설비 (부품마다 물체 하나 — 웹에서 눌러 강조하거나 다른 프로젝트에서 골라 쓰기 쉽게) -----
    b = Builder("HZ_dry_coolers")
    for cx in DC_COLS:
        for cy in DC_ROWS:
            dry_cooler(b, cx, cy)
    b.finish(root, **info("dry_cooler", "always", len(DC_COLS) * len(DC_ROWS)))
    b = Builder("HZ_chillers")
    for cx in CHILLER_X:
        chiller(b, cx, -17.0)
    b.finish(root, **info("chiller", "always", len(CHILLER_X)))
    b = Builder("HZ_pumps")
    for cx in CHILLER_X:
        pump_skid(b, cx, -21.5)
    b.finish(root, **info("pump", "always", len(CHILLER_X)))
    b = Builder("HZ_generators")
    for i in range(GEN_COUNT):
        generator(b, -27.5 + i * 5.0, -38.0)
    b.finish(root, **info("generator", "always", GEN_COUNT))
    b = Builder("HZ_transformers")
    for cx in XFMR_X:
        transformer(b, cx, XFMR_Y)
    b.finish(root, **info("transformer", "always", len(XFMR_X)))

    # 1차 배관 (보온 알루미늄): 본관 2개 + 받침 + 줄마다 가지관 (벽을 지나 CDU 로) + 세로관
    b = Builder("HZ_pipes_primary")
    hx0 = ROW_LIST[0][0] - 1.0
    b.cyl(M['insul'], (hx0, SUP_Y, P_SUP_Z), (28.4, SUP_Y, P_SUP_Z), 0.3, 14)
    b.cyl(M['insul'], (hx0, RET_Y, P_RET_Z), (29.2, RET_Y, P_RET_Z), 0.3, 14)
    xs = hx0 + 0.5
    while xs < 28:
        b.box(M['pad'], xs, SUP_Y, 0, 0.5, 0.6, P_SUP_Z - 0.3)
        b.box(M['steel'], xs, RET_Y, 0, 0.15, 0.15, P_RET_Z - 0.3)
        b.box(M['steel'], xs, RET_Y, P_RET_Z - 0.36, 0.15, 0.8, 0.06)
        xs += 4.0
    for (rx, face) in ROW_LIST:
        b.cyl(M['insul'], (rx - 0.25, SUP_Y, P_SUP_Z), (rx - 0.25, CDU_Y0 + 0.2, P_SUP_Z), 0.12, 10, cap0=False)
        b.cyl(M['insul'], (rx + 0.25, RET_Y, P_RET_Z), (rx + 0.25, CDU_Y0 + 0.2, P_RET_Z), 0.12, 10, cap0=False)
    b.cyl(M['insul'], (28.4, SUP_Y + 0.3, P_SUP_Z), (28.4, -21.5, P_SUP_Z), 0.3, 14)
    b.cyl(M['insul'], (29.2, RET_Y + 0.3, P_RET_Z), (29.2, DC_ROWS[-1], P_RET_Z), 0.3, 14)
    for ry in DC_ROWS:
        b.cyl(M['insul'], (29.2, ry, P_RET_Z), (DC_COLS[-1] + 6.5, ry, P_RET_Z), 0.16, 10, cap0=False)
    b.cyl(M['insul'], (CHILLER_X[0] - 2.0, -21.5, P_SUP_Z), (28.4, -21.5, P_SUP_Z), 0.22, 12)
    b.finish(root, **info("pipes_primary", "always"))

    # ----- 홀 속 (열었을 때) -----
    b = Builder("HZ_electrical")
    for (lx, kind) in [(-25.2, 'swgr'), (-21.8, 'ups'), (-18.4, 'ups'), (-15.0, 'swgr')]:
        for k in range(22):
            cy = 23.4 + k * 0.82
            mt = M['swgr'] if kind == 'swgr' else (M['battery'] if k % 3 == 2 else M['ups'])
            b.box(mt, lx, cy, FL, 1.0, 0.8, 2.3)
            if kind == 'swgr':
                b.box(M['screen'], lx + 0.51, cy, FL + 1.5, 0.02, 0.3, 0.2)
            else:
                b.box(M['green'], lx + 0.51, cy, FL + 1.8, 0.02, 0.15, 0.1)
        b.box(M['busway'], lx, 41.8, FL + 2.3, 0.4, 0.4, 1.9)
    trunk_x1 = ROW_LIST[-1][0] + 0.4
    b.box(M['busway'], (-25.4 + trunk_x1) / 2, 42.0, FL + 4.2, trunk_x1 + 25.4, 0.4, 0.3)
    for (rx, face) in ROW_LIST:   # 본선 → 줄 버스웨이로 내려오는 짧은 덕트
        b.box(M['busway'], rx, 41.4, FL + BUS_Z, 0.3, 0.4, 4.2 - BUS_Z)
    b.finish(root, **info("electrical", "open"))

    b = Builder("HZ_cdus")
    for (rx, face) in ROW_LIST:
        front_x, back_x = rx + face * RACK_D / 2, rx - face * RACK_D / 2
        sup_x, ret_x = back_x + face * 0.25, back_x - face * 0.15
        for k in range(CDU_PER_ROW):   # A·B 가동 (초록 표시등), C 대기 (회색)
            cy = CDU_Y0 + CDU_W / 2 + k * CDU_W
            b.box(M['cdu'], rx, cy, FL, RACK_D, CDU_W - 0.02, 2.3)
            b.box(M['screen'], front_x + face * 0.01, cy, FL + 1.5, 0.02, 0.3, 0.22)
            b.box(M['green'] if k < CDU_PER_ROW - 1 else M['steel'], front_x + face * 0.012, cy + 0.25, FL + 1.85, 0.02, 0.08, 0.08)
            b.cyl(M['supply'], (sup_x, cy - 0.15, FL + 2.3), (sup_x, cy - 0.15, FL + SUP_Z), 0.06, 8, cap0=False)
            b.cyl(M['return'], (ret_x, cy + 0.15, FL + 2.3), (ret_x, cy + 0.15, FL + RET_Z), 0.06, 8, cap0=False)
    b.finish(root, **info("cdu", "open", len(ROW_LIST) * CDU_PER_ROW))

    b = Builder("HZ_overhead")
    for (rx, face) in ROW_LIST:
        front_x, back_x = rx + face * RACK_D / 2, rx - face * RACK_D / 2
        sup_x, ret_x = back_x + face * 0.25, back_x - face * 0.15
        b.cyl(M['supply'], (sup_x, CDU_Y0, FL + SUP_Z), (sup_x, Y_END, FL + SUP_Z), 0.1, 10)    # 2차 공급 (파랑)
        b.cyl(M['return'], (ret_x, CDU_Y0, FL + RET_Z), (ret_x, Y_END, FL + RET_Z), 0.1, 10)    # 2차 회수 (빨강)
        for tx in (-0.2, 0.2):                                                                   # 버스웨이 A·B
            b.box(M['busway'], rx + tx, (CDU_Y0 + 41.6) / 2, FL + BUS_Z, 0.14, 41.6 - CDU_Y0, 0.12)
        b.box(M['fiber'], front_x - face * 0.15, (RACK_Y0 + Y_END) / 2, FL + FIB_Z, 0.3, Y_END - RACK_Y0, 0.08)   # 광케이블 트레이
    b.finish(root, **info("overhead", "open"))

    # ----- 랙: 자리 목록 + 틀 2개 -----
    slots = rack_slots()
    to_gltf = lambda x, y, z: [round(x, 3), round(z, 3), round(-y, 3)]   # Blender (x,y,z) → GLB (x,y,z)
    empty("HZ_racks", root, **info("racks", "open", len(slots)),
          slots=json.dumps([to_gltf(x, y, z) + [math.pi if f < 0 else 0.0] for (x, y, z, f) in slots]))
    tpl = empty("HZ_templates", root, loc=(0, 0, TEMPLATE_Z), show="template")
    for name, fn in (("HZ_rack_lo", rack_lo), ("HZ_rack_hi", rack_hi)):
        b = Builder(name)
        fn(b)
        b.finish(tpl, **info("rack_template", "template"))

    # ----- 흐름 경로 (웹이 이 선을 따라 점을 흘림) -----
    flows = {"power": [], "supply": [], "return": []}
    p_main = [(XFMR_X[1], XFMR_Y + 1.2, 3.75), (XFMR_X[1], BY0 + 0.6, 3.75), (-21.8, 23.0, FL + 2.5),
              (-21.8, 41.8, FL + 2.5), (-21.8, 42.0, FL + 4.4), (trunk_x1, 42.0, FL + 4.4)]
    flows["power"].append(p_main)
    for (rx, face) in ROW_LIST:
        flows["power"].append([(rx - 0.2, 42.0, FL + 4.4), (rx - 0.2, 41.4, FL + BUS_Z + 0.06), (rx - 0.2, RACK_Y0, FL + BUS_Z + 0.06)])
        back_x = rx - face * RACK_D / 2
        sup_x, ret_x = back_x + face * 0.25, back_x - face * 0.15
        flows["supply"].append([(sup_x, CDU_Y0 + 0.25, FL + 2.3), (sup_x, CDU_Y0 + 0.25, FL + SUP_Z), (sup_x, Y_END, FL + SUP_Z)])
        flows["return"].append([(ret_x, Y_END, FL + RET_Z), (ret_x, CDU_Y0 + 0.55, FL + RET_Z), (ret_x, CDU_Y0 + 0.55, FL + 2.3)])
        flows["supply"].append([(rx - 0.25, SUP_Y, P_SUP_Z), (rx - 0.25, CDU_Y0, P_SUP_Z)])
        flows["return"].append([(rx + 0.25, CDU_Y0, P_RET_Z), (rx + 0.25, RET_Y, P_RET_Z)])
    flows["supply"].append([(CHILLER_X[-1] + 2.0, -21.5, P_SUP_Z), (28.4, -21.5, P_SUP_Z), (28.4, SUP_Y, P_SUP_Z), (hx0, SUP_Y, P_SUP_Z)])
    flows["return"].append([(hx0, RET_Y, P_RET_Z), (29.2, RET_Y, P_RET_Z), (29.2, DC_ROWS[-1], P_RET_Z)])
    for ry in DC_ROWS:
        flows["return"].append([(29.2, ry, P_RET_Z), (DC_COLS[-1] + 6.5, ry, P_RET_Z)])
    empty("HZ_flows", root, show="data",
          flows=json.dumps({k: [[to_gltf(*p) for p in line] for line in v] for k, v in flows.items()}))
    return col, prev, root, slots


# ---------- 7) 미리보기 (Blender 안에서만: 땅·빛·카메라·랙 배치·랙 한 줄 확대) ----------
def preview_setup(prev, slots):
    scene = bpy.context.scene
    g = Builder("PV_ground")   # 텍사스 흙 (사진 배경)
    g.box(make_mat("ground", "#d6c9aa", 0.95), 40, 0, -0.35, 420, 420, 0.25)
    g.finish(prev)

    # B 미리보기: 멀리용 랙 틀을 348 자리에 연결 복제 (메시를 같이 씀)
    lo = bpy.data.objects["HZ_rack_lo"]
    for i, (x, y, z, f) in enumerate(slots):
        ob = bpy.data.objects.new(f"PV_rack_{i}", lo.data)
        ob.location = (x, y, z)
        ob.rotation_euler = (0, 0, math.pi if f < 0 else 0)
        prev.objects.link(ob)

    # C 미리보기: 부지 옆 x = 100 에 확대용 랙 10대 + CDU 3대 + 천장 배관 (줄은 y 방향, 뒷면이 +x 쪽 카메라를 봄)
    hi = bpy.data.objects["HZ_rack_hi"]
    OX, N = 100.0, 10
    d = Builder("PV_detail")
    d.box(M['floor'], OX, 4.5, -0.1, 7, 14, 0.1)
    d.box(M['bollard'], OX + 1.35, 4.5, 0.0, 0.08, 14, 0.005)
    # 랙 앞면이 -x(face = -1) → 뒷면이 +x: 공급 배관은 랙 뒤쪽 위, 회수 배관은 더운 통로 쪽 위 (홀 안과 같은 자리)
    sup_x, ret_x = OX + RACK_D / 2 - 0.25, OX + RACK_D / 2 + 0.15
    for k in range(CDU_PER_ROW):
        cy = CDU_W / 2 + k * CDU_W
        d.box(M['cdu'], OX, cy, 0, RACK_D, CDU_W - 0.02, 2.3)
        d.box(M['screen'], OX + RACK_D / 2 + 0.01, cy, 1.45, 0.02, 0.3, 0.22)
        d.box(M['green'] if k < 2 else M['steel'], OX + RACK_D / 2 + 0.012, cy + 0.25, 1.8, 0.02, 0.08, 0.08)
        for j in range(5):
            d.box(M['steel'], OX + RACK_D / 2 + 0.01, cy, 0.3 + j * 0.12, 0.02, 0.6, 0.04)
        d.cyl(M['supply'], (sup_x, cy - 0.15, 2.3), (sup_x, cy - 0.15, SUP_Z), 0.06, 12)
        d.cyl(M['return'], (ret_x, cy + 0.15, 2.3), (ret_x, cy + 0.15, RET_Z), 0.06, 12)
    y_end = CDU_PER_ROW * CDU_W + N * RACK_W
    d.cyl(M['supply'], (sup_x, 0, SUP_Z), (sup_x, y_end, SUP_Z), 0.08, 14)
    d.cyl(M['return'], (ret_x, 0, RET_Z), (ret_x, y_end, RET_Z), 0.08, 14)
    for tx in (-0.2, 0.2):
        d.box(M['busway'], OX + tx, y_end / 2, BUS_Z, 0.14, y_end, 0.12)
    d.box(M['steel'], OX - RACK_D / 2 + 0.15, (CDU_PER_ROW * CDU_W + y_end) / 2, FIB_Z, 0.32, N * RACK_W, 0.02)
    d.cyl(M['fiber'], (OX - RACK_D / 2 + 0.15, CDU_PER_ROW * CDU_W, FIB_Z + 0.06), (OX - RACK_D / 2 + 0.15, y_end, FIB_Z + 0.06), 0.07, 10)
    d.finish(prev)
    for k in range(N):
        ob = bpy.data.objects.new(f"PV_rack_hi_{k}", hi.data)
        ob.location = (OX, CDU_PER_ROW * CDU_W + RACK_W / 2 + k * RACK_W, 0)
        ob.rotation_euler = (0, 0, math.pi)   # 앞면 -x, 뒷면(매니폴드)이 +x 카메라 쪽
        prev.objects.link(ob)

    # 해 + 하늘
    sun_d = bpy.data.lights.new("PV_sun", 'SUN')
    sun_d.energy, sun_d.angle = 5.0, math.radians(4)
    sun = bpy.data.objects.new("PV_sun", sun_d)
    sun.rotation_euler = (math.radians(42), 0, math.radians(-35))   # 남서쪽 위에서 비춤
    prev.objects.link(sun)
    w = scene.world or bpy.data.worlds.new("HZ_world")
    scene.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    bg = next((n for n in w.node_tree.nodes if n.type == 'BACKGROUND'), None) if w.node_tree else None
    if bg is not None:
        bg.inputs['Color'].default_value = (*lin('#dfe7ef'), 1)
        bg.inputs['Strength'].default_value = 0.55

    def cam(name, loc, target, lens):
        cd = bpy.data.cameras.new(name)
        cd.lens, cd.clip_end = lens, 2000
        ob = bpy.data.objects.new(name, cd)
        ob.location = loc
        ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        prev.objects.link(ob)
        return ob

    cam("PV_cam_A", (84, -104, 78), (-3, -2, 0), 40)
    cam("PV_cam_B", (52, -14, 46), (2, 31, 0), 35)
    cam("PV_cam_C", (OX + 7.2, 1.2, 3.9), (OX + 0.2, 5.6, 1.4), 30)


def render_previews(out_dir):
    """A(닫힘)·B(속)·C(랙 확대) 미리보기 PNG"""
    scene = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            scene.render.engine = eng
            break
        except TypeError:
            pass
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1600, 1000, 100
    try:
        scene.eevee.taa_render_samples = 32
    except Exception:
        pass
    racks = [o for o in bpy.data.objects if o.name.startswith("PV_rack_") and not o.name.startswith("PV_rack_hi")]
    closed = [o for o in bpy.data.objects if o.get("show") == "closed"]
    opened = [o for o in bpy.data.objects if o.get("show") == "open"]
    for view in ("A", "B", "C"):
        for o in closed:
            o.hide_render = view != "A"
        for o in opened + racks:
            o.hide_render = view == "A"
        scene.camera = bpy.data.objects["PV_cam_" + view]
        scene.render.filepath = os.path.join(out_dir, f"preview-{view}.png")
        bpy.ops.render.render(write_still=True)
    for o in closed + opened + racks:
        o.hide_render = False


# ---------- 8) 내보내기 ----------
def export(col, out_dir, web_gz=None):
    """Horizon_hall 컬렉션만 GLB 로 (meshopt 압축 + 부품 정보) → 웹용은 gzip 으로 한 번 더 줄임"""
    os.makedirs(out_dir, exist_ok=True)
    glb = os.path.join(out_dir, "horizon-hall.glb")
    bpy.context.view_layer.update()   # 방금 만든 물체들을 뷰 레이어 목록에 반영 (안 하면 빈 항목이 섞임)
    for o in bpy.data.objects:
        o.select_set(o.name in col.all_objects)
    bpy.ops.export_scene.gltf(
        filepath=glb, export_format='GLB', use_selection=True, export_extras=True,
        export_cameras=False, export_lights=False, export_animations=False, export_texcoords=False,
        export_meshopt_compression_enable=True)
    raw = open(glb, "rb").read()
    packed = gzip.compress(raw, 9)
    if web_gz:
        os.makedirs(os.path.dirname(web_gz), exist_ok=True)
        with open(web_gz, "wb") as fh:
            fh.write(packed)
    tris = sum(len(p.vertices) - 2 for o in col.all_objects if o.type == 'MESH' for p in o.data.polygons)
    print(f"GLB {len(raw) / 1024:.1f} KiB · gzip {len(packed) / 1024:.1f} KiB · 삼각형 {tris}")
    return glb


def main(out_dir, web_gz=None, previews=True):
    col, prev, root, slots = build()
    preview_setup(prev, slots)
    export(col, out_dir, web_gz)
    if previews:
        render_previews(out_dir)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "horizon-hall.blend"))


if __name__ == "__main__":
    if "OUT" in globals():                     # Blender 안에서 exec(...) 로 실행
        main(OUT, globals().get("WEB_GZ"), globals().get("PREVIEWS", True))  # noqa: F821
    elif "--" in sys.argv:                     # blender -b -P 이 파일 -- 저장폴더 [웹용 경로]
        args = sys.argv[sys.argv.index("--") + 1:]
        main(args[0], args[1] if len(args) > 1 else None)
