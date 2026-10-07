// =============================================================
// GlobeView — 파스텔 저폴리 지구본 + 사이트 핀
// - 바다: 단색 구(sphere)
// - 육지: 미리 계산한 h3 육각형 타일(public/data/land-hex.json)을 육각기둥으로
//         InstancedMesh 하나에 1만 개를 한 번에 그림 (드로우콜 1회)
// - 대기: 뒷면 구에 가장자리만 빛나는(fresnel) 셰이더
// - 핀: Pins.jsx (인스턴싱 핀 + 무리 라벨)
// =============================================================
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import { BackSide, AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Object3D, Vector3 } from 'three'
import { useAppStore, EMPTY } from '../store/useAppStore.js'
import { GLOBE_RADIUS, latLngToVec3 } from './geo.js'
import { PinsInstanced, PinLabels } from './Pins.jsx'
import { CITIES } from './cities.js'

const OCEAN = '#a8c3ef'      // 파스텔 바다
const LAND = '#fffaf0'       // 아이보리 육지
const HOME_LAND = '#8fd6b8'  // 사이트가 있는 나라: 민트 (scripts/build-land-hex.mjs 가 데이터에서 자동 계산)

export default function GlobeView({ visible }) {
  const sites = useAppStore((s) => s.data?.sites ?? EMPTY)

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
      {visible && <PinsInstanced sites={sites} />}
      {visible && <PinLabels sites={sites} />}
    </group>
  )
}


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
