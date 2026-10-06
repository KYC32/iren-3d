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
import { Html } from '@react-three/drei'
import { BackSide, AdditiveBlending, Color, Object3D, Quaternion, Vector3 } from 'three'
import { useAppStore, isStatusActive } from '../store/useAppStore.js'
import { styleOf } from '../data/statusStyle.js'
import { GLOBE_RADIUS, latLngToVec3, spreadPins, fmtMw } from './geo.js'
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
      <Atmosphere />
      {visible && sites.map((s) => <GlobePin key={s.id} site={s} pos={display[s.id]} rank={ranks[s.id]} />)}
    </group>
  )
}

// 가까이 모인 사이트(예: 텍사스 4곳)를 무리로 묶습니다.
// 멀리서 볼 때는 무리의 대표(가장 큰 사이트) 라벨만 "+N" 과 함께 보여 겹침을 막고,
// 가까이 줌하거나 호버하면 모든 라벨을 펼칩니다.
function labelRanks(sites, nearDeg = 4) {
  const leads = []
  const ranks = {}
  // 계통 전력이 큰 사이트가 대표가 되도록 큰 순서로 처리
  for (const s of [...sites].sort((a, b) => b.grid_mw - a.grid_mw)) {
    const lead = leads.find((l) => Math.hypot(l.lat - s.lat, (l.lng - s.lng) * Math.cos((s.lat * Math.PI) / 180)) < nearDeg)
    if (lead) {
      ranks[s.id] = { lead: false, more: 0 }
      ranks[lead.id].more += 1
    } else {
      leads.push(s)
      ranks[s.id] = { lead: true, more: 0 }
    }
  }
  return ranks
}

const EXPAND_DISTANCE = 300 // 카메라가 이보다 가까우면 무리 라벨을 모두 펼침

// ---------- 육지 육각 타일 ----------
function LandHexes() {
  const [cells, setCells] = useState(null)
  const ref = useRef()

  useEffect(() => {
    fetch('/data/land-hex.json')
      .then((r) => r.json())
      .then((d) => setCells(d.cells))
      .catch(() => setCells([]))
  }, [])

  const count = cells ? cells.length / 3 : 0

  // 인스턴스마다 위치·방향·높이·색을 한 번만 계산해 넣습니다
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh || !cells) return
    const dummy = new Object3D()
    const up = new Vector3(0, 1, 0)
    const color = new Color()
    for (let i = 0; i < count; i++) {
      const lat = cells[i * 3], lng = cells[i * 3 + 1], home = cells[i * 3 + 2] === 1
      const h = home ? 1.3 : 0.7 // 홈 국가는 살짝 더 솟게
      const n = latLngToVec3(lat, lng, 0).normalize()
      dummy.position.copy(n).multiplyScalar(GLOBE_RADIUS + h / 2 - 0.2)
      dummy.quaternion.setFromUnitVectors(up, n)
      dummy.scale.set(1, h, 1)
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
    <instancedMesh ref={ref} args={[null, null, count]} frustumCulled={false}>
      {/* 반지름 0.95: h3 해상도3 육각형(약 1.08)보다 조금 작게 → 타일 사이 틈 */}
      <cylinderGeometry args={[0.95, 0.95, 1, 6]} />
      <meshLambertMaterial />
    </instancedMesh>
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
    float rim = pow(1.0 - abs(dot(-vNormal, vView)), 3.0);
    gl_FragColor = vec4(uColor, rim * 0.9);
  }
`
function Atmosphere() {
  const uniforms = useMemo(() => ({ uColor: { value: new Color('#b3c2ff') } }), [])
  return (
    <mesh scale={1.12}>
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

function GlobePin({ site, pos, rank = { lead: true, more: 0 } }) {
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
  const h = 3 + Math.sqrt(site.grid_mw) * 0.45
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
      // 지구 앞면에 있고 + (무리 대표이거나 / 가까이 줌했거나 / 호버 중) 일 때만 보임
      const show = facing > 0.15 && (rank.lead || near || useAppStore.getState().hoverId === site.id)
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
      {/* 이름·MW 라벨 (HTML) */}
      <Html position={[0, h + 3.2, 0]} center zIndexRange={[20, 0]}>
        <button
          ref={labelRef}
          className={`pin-label${hovered ? ' is-hover' : ''}`}
          onPointerEnter={() => setHover(site.id)}
          onPointerLeave={() => setHover(null)}
          onClick={() => requestSite(site.id)}
        >
          <span className="dot" style={{ background: style.color }} />
          <span className="name">{pickName(site, lang)}</span>
          <span className="mw">{fmtMw(site.grid_mw)}</span>
          {rank.more > 0 && <span className="more">+{rank.more}</span>}
        </button>
      </Html>
    </group>
  )
}
