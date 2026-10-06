// =============================================================
// GlobeView — 파스텔 저폴리 지구본 + 사이트 핀
// - 바다: 단색 구(sphere)
// - 육지: 미리 계산한 h3 육각형 타일(public/data/land-hex.json)을 육각기둥으로
//         InstancedMesh 하나에 1만 개를 한 번에 그림 (드로우콜 1회)
// - 대기: 뒷면 구에 가장자리만 빛나는(fresnel) 셰이더
// - 핀(GlobePin): R3F 로 직접 그려서 호버·클릭·필터 흐림을 자유롭게 제어
// =============================================================
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import { BackSide, AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Object3D, Quaternion, Vector3 } from 'three'
import { useAppStore, isStatusActive } from '../store/useAppStore.js'
import { styleOf } from '../data/statusStyle.js'
import { GLOBE_RADIUS, latLngToVec3, spreadPins, fmtMw, labelRanks, pinHeight } from './geo.js'
import { pickName } from '../i18n/useT.js'

const OCEAN = '#a8c3ef'      // 파스텔 바다
const LAND = '#fffaf0'       // 아이보리 육지
const HOME_LAND = '#8fd6b8'  // IREN 사이트가 있는 나라(미국·캐나다·호주·스페인): 민트

export default function GlobeView({ visible }) {
  const sites = useAppStore((s) => s.data?.sites ?? [])
  // 가까운 핀은 화면에서 살짝 벌려서 표시
  const display = useMemo(() => spreadPins(sites), [sites])
  const ranks = useMemo(() => labelRanks(sites), [sites])

  return (
    <group visible={visible}>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 72, 48]} />
        <meshLambertMaterial color={OCEAN} />
      </mesh>
      <LandHexes />
      <Borders />
      <Atmosphere />
      {visible && <CityLabels />}
      {visible && sites.map((s) => <GlobePin key={s.id} site={s} pos={display[s.id]} rank={ranks[s.id]} />)}
    </group>
  )
}

const EXPAND_DISTANCE = 300 // 카메라가 이보다 가까우면 무리 라벨을 모두 펼침

// ---------- 육지 육각 타일 ----------
function LandHexes() {
  const [cells, setCells] = useState(null)
  const ref = useRef()

  useEffect(() => {
    fetch('/data/land-hex.json')
      .then((r) => r.json())
      .then((d) => setCells({ data: d.cells, stride: d.stride ?? 3 }))
      .catch(() => setCells([]))
  }, [])

  const count = cells ? cells.data.length / cells.stride : 0

  // 인스턴스마다 위치·방향·높이·색을 한 번만 계산해 넣습니다
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh || !cells) return
    const dummy = new Object3D()
    const up = new Vector3(0, 1, 0)
    const color = new Color()
    const { data, stride } = cells
    for (let i = 0; i < count; i++) {
      const lat = data[i * stride], lng = data[i * stride + 1], home = data[i * stride + 2] === 1
      // 사이트 주변 고해상도(h3 해상도4) 타일은 면적이 1/7 → 반지름은 √(1/7) ≈ 0.378배
      const fine = stride > 3 && data[i * stride + 3] === 1
      const r = fine ? 0.378 : 1
      const h = home ? 1.3 : 0.7 // 홈 국가는 살짝 더 솟게
      const n = latLngToVec3(lat, lng, 0).normalize()
      dummy.position.copy(n).multiplyScalar(GLOBE_RADIUS + h / 2 - 0.2)
      dummy.quaternion.setFromUnitVectors(up, n)
      dummy.scale.set(r, h, r)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      // 결정적 미세 명암 변화 → 타일 질감 (같은 타일은 항상 같은 색)
      const jitter = (Math.sin(i * 12.9898) * 43758.5453) % 1
      color.set(home ? HOME_LAND : LAND).offsetHSL(0, 0, jitter * 0.03)
      mesh.setColorAt(i, color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [cells, count])

  if (!count) return null
  return (
    <instancedMesh ref={ref} name="land-hexes" args={[null, null, count]} frustumCulled={false}>
      {/* 반지름 0.95: h3 해상도3 육각형(약 1.08)보다 조금 작게 → 타일 사이 틈 */}
      <cylinderGeometry args={[0.95, 0.95, 1, 6]} />
      <meshLambertMaterial />
    </instancedMesh>
  )
}

// ---------- 경계선: 국경·해안선, 미국 주 경계, 사이트가 있는 주 강조 ----------
const LINE_RADIUS = GLOBE_RADIUS + 1.25 // 홈 국가 타일(높이 1.3) 윗면보다 살짝 위

// [경도, 위도, ...] 선 → 지구본 표면을 따라가는 3D 점 목록
// 점 사이가 1도보다 멀면 중간점을 끼워 넣어야 선이 지구 속으로 파고들지 않습니다
function toSpherePoints(flat) {
  const pts = []
  for (let i = 0; i < flat.length; i += 2) {
    const lng = flat[i], lat = flat[i + 1]
    if (i > 0) {
      const plng = flat[i - 2], plat = flat[i - 1]
      // 날짜변경선(경도 ±180)을 건너뛰는 구간은 선을 끊음 (지구를 가로지르는 선 방지)
      if (Math.abs(lng - plng) > 180) { pts.push(null); pts.push(latLngToVec3(lat, lng, LINE_RADIUS / GLOBE_RADIUS - 1)); continue }
      const steps = Math.floor(Math.max(Math.abs(lng - plng), Math.abs(lat - plat)) / 1)
      for (let k = 1; k < steps; k++) {
        const t = k / steps
        pts.push(latLngToVec3(plat + (lat - plat) * t, plng + (lng - plng) * t, LINE_RADIUS / GLOBE_RADIUS - 1))
      }
    }
    pts.push(latLngToVec3(lat, lng, LINE_RADIUS / GLOBE_RADIUS - 1))
  }
  return pts
}
// 여러 선을 한 번에 그리는 LineSegments 용 지오메트리 (드로우콜 1회)
function segmentsGeometry(lines) {
  const pos = []
  for (const flat of lines) {
    const pts = toSpherePoints(flat)
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]
      if (!a || !b) continue // 끊긴 구간
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  return g
}

function Borders() {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetch('/data/borders.json').then((r) => r.json()).then(setData).catch(() => {})
  }, [])
  const geo = useMemo(() => {
    if (!data) return null
    return {
      countries: segmentsGeometry(data.countries),
      states: segmentsGeometry(data.states),
      focus: data.focus.map(toSpherePoints),
    }
  }, [data])
  if (!geo) return null
  return (
    <group name="borders">
      <lineSegments geometry={geo.countries}>
        <lineBasicMaterial color="#7d8db0" transparent opacity={0.6} />
      </lineSegments>
      <lineSegments geometry={geo.states}>
        <lineBasicMaterial color="#7d8db0" transparent opacity={0.3} />
      </lineSegments>
      {/* 사이트가 있는 주(텍사스·오클라호마)는 굵은 선으로 */}
      {geo.focus.map((pts, i) => (
        <Line key={i} points={pts} color="#4f6390" lineWidth={1.6} transparent opacity={0.85} />
      ))}
    </group>
  )
}

// ---------- 기준 도시 라벨: "이 사이트가 어디쯤인지" 감을 주는 큰 도시 ----------
const CITIES = [
  { ko: '댈러스', en: 'Dallas', lat: 32.78, lng: -96.8 },
  { ko: '애머릴로', en: 'Amarillo', lat: 35.22, lng: -101.83 },
  { ko: '오클라호마시티', en: 'Oklahoma City', lat: 35.47, lng: -97.52 },
  { ko: '밴쿠버', en: 'Vancouver', lat: 49.28, lng: -123.12 },
  { ko: '캘거리', en: 'Calgary', lat: 51.05, lng: -114.07 },
  { ko: '시애틀', en: 'Seattle', lat: 47.61, lng: -122.33 },
  { ko: '애들레이드', en: 'Adelaide', lat: -34.93, lng: 138.6 },
  { ko: '시드니 (IREN 본사)', en: 'Sydney (IREN HQ)', lat: -33.87, lng: 151.21 },
  { ko: '마드리드', en: 'Madrid', lat: 40.42, lng: -3.7 },
  { ko: '리스본', en: 'Lisbon', lat: 38.72, lng: -9.14 },
]
const CITY_SHOW_DISTANCE = 420 // 이보다 가까이 줌하면 도시 이름 표시

function CityLabels() {
  const lang = useAppStore((s) => s.lang)
  return CITIES.map((c) => <City key={c.en} city={c} name={lang === 'ko' ? c.ko : c.en} />)
}

function City({ city, name }) {
  const ref = useRef()
  const { position, normal } = useMemo(() => {
    const p = latLngToVec3(city.lat, city.lng, 0.014)
    return { position: p, normal: p.clone().normalize() }
  }, [city])
  const tmp = useMemo(() => new Vector3(), [])
  useFrame(({ camera }) => {
    if (!ref.current) return
    tmp.copy(camera.position).sub(position).normalize()
    const show = tmp.dot(normal) > 0.2 && camera.position.length() < CITY_SHOW_DISTANCE
    ref.current.style.opacity = show ? 1 : 0
  })
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.32, 8, 6]} />
        <meshBasicMaterial color="#55627f" />
      </mesh>
      <Html center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={ref} className="city-label">{name}</div>
      </Html>
    </group>
  )
}

// ---------- 대기 글로우 (가장자리만 은은하게) ----------
const atmoVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const atmoFragment = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // 뒷면을 그리므로 법선을 뒤집어 계산. 시선과 수직인 가장자리일수록 밝게
    float rim = pow(1.0 - abs(dot(-vNormal, vView)), 6.0);
    gl_FragColor = vec4(uColor, rim * 0.45);
  }
`
function Atmosphere() {
  const uniforms = useMemo(() => ({ uColor: { value: new Color('#b3c2ff') } }), [])
  return (
    <mesh scale={1.08}>
      <sphereGeometry args={[GLOBE_RADIUS, 48, 32]} />
      <shaderMaterial
        vertexShader={atmoVertex}
        fragmentShader={atmoFragment}
        uniforms={uniforms}
        side={BackSide}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  )
}

const UP = new Vector3(0, 1, 0)

function GlobePin({ site, pos, rank = { lead: true, members: [] } }) {
  const lang = useAppStore((s) => s.lang)
  const hoverId = useAppStore((s) => s.hoverId)
  const setHover = useAppStore((s) => s.setHover)
  const requestSite = useAppStore((s) => s.requestSite)
  const activeStatuses = useAppStore((s) => s.activeStatuses)

  const style = styleOf(site.status)
  const active = isStatusActive(activeStatuses, site.status)
  const hovered = hoverId === site.id

  // 지표면 위 위치와 "위쪽" 방향(지구 중심 → 바깥)
  const { position, quaternion, normal } = useMemo(() => {
    const p = latLngToVec3(pos.lat, pos.lng, 0)
    const n = p.clone().normalize()
    return { position: p, normal: n, quaternion: new Quaternion().setFromUnitVectors(UP, n) }
  }, [pos.lat, pos.lng])

  // 막대 높이 ∝ √MW (면적 감각에 가깝게): 30MW ≈ 5, 1,600MW ≈ 21
  const h = pinHeight(site.grid_mw)
  const ringRef = useRef()
  const labelRef = useRef()
  const tmp = useMemo(() => new Vector3(), [])

  useFrame(({ camera, clock }) => {
    // (a) 바닥 링 펄스: 상태별 속도로 커졌다가 사라짐
    if (ringRef.current) {
      const speed = style.ringSpeed
      const t = speed > 0 ? (clock.elapsedTime * speed * 0.6) % 1 : 0
      const s = 1 + t * 2.4
      ringRef.current.scale.set(s, s, s)
      ringRef.current.material.opacity = speed > 0 ? (1 - t) * (active ? 0.7 : 0.15) : 0
    }
    // (b) 지구 뒤편에 있는 핀의 라벨은 숨기기: 카메라 방향과 지표 법선의 내적으로 판단
    if (labelRef.current) {
      tmp.copy(camera.position).sub(position).normalize()
      const facing = tmp.dot(normal)
      const near = camera.position.length() < EXPAND_DISTANCE
      // 무리 대표 라벨만 그립니다. 가까이 줌하면 무리 구성원 목록이 펼쳐집니다.
      const show = facing > 0.15
      labelRef.current.dataset.expanded = near ? '1' : '0'
      labelRef.current.style.opacity = show ? (active ? 1 : 0.35) : 0
      labelRef.current.style.pointerEvents = show ? 'auto' : 'none'
    }
  })

  const color = active ? style.color : '#c3c9d8'
  const onOver = (e) => { e.stopPropagation(); setHover(site.id); document.body.style.cursor = 'pointer' }
  const onOut = () => { setHover(null); document.body.style.cursor = '' }
  const onClick = (e) => { e.stopPropagation(); requestSite(site.id) }

  return (
    <group position={position} quaternion={quaternion}>
      {/* 막대 (계통 전력 규모) */}
      <mesh position={[0, h / 2, 0]} scale={hovered ? 1.25 : 1} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} castShadow>
        <cylinderGeometry args={[1.1, 1.4, h, 12]} />
        <meshStandardMaterial color={color} roughness={0.55} transparent opacity={site.status === 'planned' ? 0.75 : 1} />
      </mesh>
      {/* 꼭대기 캡 */}
      <mesh position={[0, h + 0.8, 0]} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <sphereGeometry args={[1.9, 16, 12]} />
        <meshStandardMaterial color={new Color(color).offsetHSL(0, 0, 0.12)} roughness={0.4} />
      </mesh>
      {/* 바닥 펄스 링 */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25, 0]}>
        <ringGeometry args={[1.8, 2.5, 32]} />
        <meshBasicMaterial color={style.color} transparent depthWrite={false} />
      </mesh>
      {/* 이름·MW 라벨 (HTML) — 무리 대표만. 구성원은 대표 라벨 아래 목록으로 */}
      {rank.lead && (
        <Html position={[0, h + 3.2, 0]} center zIndexRange={[20, 0]}>
          <div ref={labelRef} className="pin-cluster" data-expanded="0">
            {[site, ...rank.members].map((m, i) => {
              const ms = styleOf(m.status)
              return (
                <button
                  key={m.id}
                  className={`pin-label${hoverId === m.id ? ' is-hover' : ''}${i > 0 ? ' member' : ''}`}
                  onPointerEnter={() => setHover(m.id)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => requestSite(m.id)}
                >
                  <span className="dot" style={{ background: ms.color }} />
                  <span className="name">{pickName(m, lang)}</span>
                  <span className="mw">{fmtMw(m.grid_mw)}</span>
                  {i === 0 && rank.members.length > 0 && <span className="more">+{rank.members.length}</span>}
                </button>
              )
            })}
          </div>
        </Html>
      )}
    </group>
  )
}
