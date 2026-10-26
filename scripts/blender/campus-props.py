# campus-props.py — 캠퍼스 3D 소품 모형: 주차한 차 · 공사 장비 · 자재 컨테이너 (Blender 5.2 에서 실행)
# -------------------------------------------------------------------------------------------
# 이 파일이 소품 모형의 "설계도"입니다. 실행하면 빈 장면에서 처음부터 다시 만듭니다.
# 실행 방법 (터미널):
#   blender -b --factory-startup -P scripts/blender/campus-props.py -- <Kenney 폴더> <웹용 .glb.gz 경로>
#     Kenney 폴더: kenney.nl 에서 받은 두 zip 을 풀어 둔 곳
#       <폴더>/car/   ← Car Kit 3.1            https://kenney.nl/assets/car-kit
#       <폴더>/city/  ← City Kit (Industrial) 2.0  https://kenney.nl/assets/city-kit-industrial
#     웹용 경로: iren-3d 는 public/models/campus-props.glb.gz
# 원본 라이선스: 두 묶음 모두 CC0(퍼블릭 도메인) — 출처 표기 의무는 없지만 README 에 적어 둠
#
# 하는 일
#   1) 고른 모델(PROPS)만 불러와 바퀴·삽 같은 조각을 몸체 하나로 합침
#   2) 색표 텍스처(colormap.png)를 꼭짓점 색으로 구움 → 텍스처 없이 가벼워지고, 색을 다시 칠할 수 있음
#      Kenney 의 장난감 같은 원색을 캠퍼스 그림에 맞는 차분한 색으로 바꿈 (차 = 흰색·은색·남색 같은 실제 흔한 색)
#   3) 크기를 캠퍼스 그림 비율에 맞춤 (그림 속 납품 트럭 길이 약 3칸 → 승용차 길이 1.5칸)
#      바닥 가운데가 원점, 앞이 +Z(웹 좌표) — 웹(CampusProps.jsx)이 놓을 자리와 방향만 정하면 됨
#   4) GLB 하나로 내보냄 (meshopt 압축, 법선 없음 = 웹이 면마다 계산) → gzip 으로 한 번 더 줄임 (Vercel 이 .glb 를 압축해 주지 않음)
import bpy
import colorsys
import gzip
import os
import sys
import tempfile

# ---- 고를 모델 ----
# (웹에서 쓸 이름, 묶음 폴더, Kenney 파일 이름, 색 규칙)
PROPS = [
    ('sedan', 'car', 'sedan', ('paint', '#c3c8ce')),          # 은색 세단
    ('suv', 'car', 'suv', ('paint', '#2f4763')),              # 남색 SUV
    ('van', 'car', 'van', ('paint', '#e6e9ec')),              # 흰 밴
    ('pickup', 'car', 'truck', ('paint', '#5d6672')),         # 짙은 회색 픽업
    ('hatchback', 'car', 'hatchback-sports', ('paint', '#9c4a42')),  # 차분한 빨강
    ('loader', 'car', 'tractor-shovel', ('paint', '#d6a23a')),  # 공사 장비 = 호박색 (그림 속 크레인 노랑과 어울리게)
    ('cone', 'car', 'cone', ('mute', 0.85)),                  # 라바콘 주황은 거의 그대로
    ('container', 'city', 'shipping-container-a', ('paint', '#6f8296')),  # 자재 컨테이너 = 회청색
]
CAR_LENGTH = 1.5        # 세단 길이(웹 단위). 다른 차·장비는 세단과 같은 배율 → Kenney 안의 크기 비율 유지
CONE_HEIGHT = 0.34
CONTAINER_LENGTH = 1.75
VEHICLES = {'sedan', 'suv', 'van', 'pickup', 'hatchback', 'loader'}
# 삼각형 줄이기 비율: 캠퍼스 화면에서 차는 수십 픽셀이라 Kenney 원본(약 2천 개)의 일부면 충분
#   색은 굽고 난 뒤에 줄임 (먼저 줄이면 UV 가 색표 칸 경계를 넘어 엉뚱한 색을 읽음)
DECIMATE = 0.35
PREVIEW = os.environ.get('PROPS_PREVIEW')   # 경로를 주면 소품을 늘어놓은 Workbench 미리보기 PNG 도 저장 (확인용)


def args():
    """'--' 뒤의 두 인자: Kenney 폴더, 웹용 .glb.gz 경로"""
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(a) < 2:
        raise SystemExit('사용법: blender -b --factory-startup -P campus-props.py -- <Kenney 폴더> <웹용 .glb.gz 경로>')
    return a[0], a[1]


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def recolor(rgb, rule):
    """색표에서 읽은 한 색(sRGB 0~1)을 규칙에 따라 바꿈
    paint: 채도 높은 칸(차체·장비 몸통)만 지정 색으로, 나머지(유리·바퀴·그림자 칸)는 채도를 낮춤
    mute : 모두 채도만 낮춤"""
    h, s, v = colorsys.rgb_to_hsv(*rgb)
    kind, val = rule
    if kind == 'paint' and s > 0.42 and v > 0.3:
        ph, ps, pv = colorsys.rgb_to_hsv(*hex_rgb(val))
        # 원래 칸의 밝기 차이(그늘진 면·밝은 면)는 조금 남겨 덩어리감이 살게
        return colorsys.hsv_to_rgb(ph, ps, max(0, min(1, pv * (0.85 + 0.3 * v))))
    factor = val if kind == 'mute' else 0.45
    return colorsys.hsv_to_rgb(h, s * factor, v)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_prop(path):
    """GLB 하나를 불러와 조각을 몸체 하나로 합친 물체를 돌려줌"""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    # 빈 껍데기(Empty) 부모가 있으면 변형을 풀어 메시에 넣음
    for o in new:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    bpy.ops.object.select_all(action='DESELECT')
    for o in new:
        o.select_set(True)
    bpy.context.view_layer.objects.active = new[0]
    if len(new) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # 남은 빈 물체 지우기
    for o in [o for o in bpy.data.objects if o not in before and o.type != 'MESH']:
        bpy.data.objects.remove(o)
    return obj


def bake_colors(obj, rule):
    """색표 텍스처 → 꼭짓점(모서리) 색. 색표는 칸마다 한 색이라 UV 자리의 픽셀 하나만 읽으면 정확함"""
    me = obj.data
    img = None
    for mat in me.materials:
        if mat and mat.node_tree:
            img = next((n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
            if img:
                break
    if img is None:
        raise SystemExit(f'{obj.name}: 색표 텍스처를 찾지 못함 (Textures/colormap.png 가 GLB 옆에 있어야 함)')
    W, H = img.size
    pix = list(img.pixels)   # 8비트 PNG 는 저장된 sRGB 값 그대로 (0~1)
    uv = me.uv_layers.active.data
    attr = me.color_attributes.new(name='Col', type='BYTE_COLOR', domain='CORNER')
    for li in range(len(me.loops)):
        u, v = uv[li].uv
        px = min(W - 1, max(0, int((u % 1) * W)))
        py = min(H - 1, max(0, int((v % 1) * H)))
        i = (py * W + px) * 4
        r, g, b = recolor((pix[i], pix[i + 1], pix[i + 2]), rule)
        attr.data[li].color_srgb = (r, g, b, 1.0)
    me.color_attributes.active_color = attr
    # UV 는 더 이상 필요 없음 → 지워서 파일을 줄임
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])


def decimate(obj, ratio):
    """같은 자리의 꼭짓점을 합친 뒤 삼각형 수를 ratio 만큼으로 줄임 (모서리 색은 줄이면서 함께 옮겨짐)"""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0001)
    bpy.ops.object.mode_set(mode='OBJECT')
    mod = obj.modifiers.new('decimate', 'DECIMATE')
    mod.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=mod.name)


def preview(made, path):
    """소품을 한 줄로 늘어놓고 Workbench(가벼운 미리보기 엔진)로 한 장 찍음 — 색·모양 확인용"""
    scene = bpy.context.scene
    try:
        scene.render.engine = 'BLENDER_WORKBENCH'
    except TypeError as e:
        print('Workbench 없음:', e)
        return
    scene.display.shading.color_type = 'VERTEX'
    scene.display.shading.light = 'STUDIO'
    scene.render.resolution_x, scene.render.resolution_y = 1400, 360
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 3 * len(made) + 1
    span = 3 * (len(made) - 1)
    cam.location = (span / 2 + 4, -9, 7)
    cam.rotation_euler = (1.05, 0, 0.42)
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


def shared_material():
    """모든 소품이 같이 쓰는 재질: 꼭짓점 색 → 기본 색 (노드는 이름이 아니라 종류로 찾음)"""
    mat = bpy.data.materials.new('campus_props')   # Blender 5 는 새 재질에 노드가 이미 켜져 있음
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    col = nodes.new('ShaderNodeVertexColor')
    col.layer_name = 'Col'
    links.new(col.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.75
    return mat


def normalize(obj, name, car_scale):
    """길이 방향을 Y 축으로, 바닥 가운데를 원점으로, 크기를 그림 비율로"""
    dx, dy, dz = obj.dimensions
    if dx > dy:   # 길이가 X 쪽이면 90° 돌려 Y 쪽으로 (웹에서 앞 = +Z)
        obj.rotation_euler[2] = 1.5707963
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.ops.object.transform_apply(rotation=True)
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    cx, cy, z0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
    length, height = max(ys) - min(ys), max(zs) - z0
    if name in VEHICLES:
        k = car_scale
    elif name == 'cone':
        k = CONE_HEIGHT / height
    else:
        k = CONTAINER_LENGTH / length
    for v in obj.data.vertices:
        v.co.x = (v.co.x - cx) * k
        v.co.y = (v.co.y - cy) * k
        v.co.z = (v.co.z - z0) * k
    obj.location = (0, 0, 0)
    return length * k


def main():
    src, out = args()
    clear_scene()
    mat = shared_material()
    made = []
    car_scale = None
    for name, pack, file, rule in PROPS:
        path = os.path.join(src, pack, 'Models', 'GLB format', f'{file}.glb')
        obj = import_prop(path)
        bake_colors(obj, rule)
        if name in VEHICLES:
            decimate(obj, DECIMATE)
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        if car_scale is None:   # 첫 모델(세단) 길이로 차 배율을 정함
            dx, dy, _ = obj.dimensions
            car_scale = CAR_LENGTH / max(dx, dy)
        L = normalize(obj, name, car_scale)
        obj.name = obj.data.name = f'prop_{name}'
        obj['source'] = f'Kenney {"Car Kit" if pack == "car" else "City Kit (Industrial)"} · {file} · CC0'
        made.append((obj, L))
    # 쓰다 남은 원래 재질·이미지 정리
    for m in list(bpy.data.materials):
        if m is not mat:
            bpy.data.materials.remove(m)
    for im in list(bpy.data.images):
        bpy.data.images.remove(im)

    # 소품끼리 겹치지 않게 x 로 늘어놓음 (웹은 이름으로 찾아 기하만 씀 — 자리는 상관없음)
    for i, (obj, _) in enumerate(made):
        obj.location.x = i * 3
    bpy.ops.object.select_all(action='DESELECT')
    for obj, _ in made:
        obj.select_set(True)
    if PREVIEW:
        preview(made, PREVIEW)
    tmp = os.path.join(tempfile.mkdtemp(), 'campus-props.glb')
    bpy.ops.export_scene.gltf(
        filepath=tmp, export_format='GLB', use_selection=True,
        # 법선은 빼고 웹에서 평면 음영(flatShading)으로 그림 — 저폴리라 모양이 같고 파일이 줄어듦
        export_texcoords=False, export_normals=False, export_vertex_color='MATERIAL',
        export_extras=True, export_meshopt_compression_enable=True)
    raw = open(tmp, 'rb').read()
    packed = gzip.compress(raw, 9)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    open(out, 'wb').write(packed)
    for obj, L in made:
        tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        print(f'  {obj.name:16s} 길이 {L:.2f} · 높이 {obj.dimensions.z:.2f} · 삼각형 {tris}')
    print(f'GLB {len(raw) / 1024:.1f} KiB · gzip {len(packed) / 1024:.1f} KiB → {out}')


main()
