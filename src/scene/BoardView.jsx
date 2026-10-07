// =============================================================
// BoardView — 보드판 지도 (북미 서부 본판 + 스페인·남호주 삽입판)
// -------------------------------------------------------------
// 지구본은 사이트가 없는 바다·대륙이 화면 대부분을 차지해서,
// IREN 사이트가 있는 지역만 잘라 보드게임판처럼 펼쳐 놓았습니다.
//   - 판 받침: 흰 테두리 + 파스텔 바다
//   - 육지: 미리 계산한 h3 육각 타일(board-hex.json)을 InstancedMesh 하나로
//   - 경계선: 국경·해안선, 주 경계, 사이트가 있는 주는 진하게
//   - 핀: 상태색 막대 + 링 펄스, 가까운 사이트는 무리 라벨로 묶음
// 좌표 변환은 boards.js 의 projectToBoard 하나로 통일합니다.
// =============================================================
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line, QuadraticBezierLine, RoundedBox } from '@react-three/drei'
import { BufferGeometry, Color, Float32BufferAttribute, Object3D, Vector3 } from 'three'
import { useAppStore, isSiteActive, EMPTY } from '../store/useAppStore.js'
import { styleOf } from '../data/statusStyle.js'
import { BOARDS, boardPos, projectLocal, projectToBoard, layoutKind } from './boards.js'
import { spreadPins, labelRanks, fmtMw } from './geo.js'
import { CITIES } from './cities.js'
import { pickName, useT } from '../i18n/useT.js'
import { toMonth } from '../data/timeline.js'
import { CustomerLogo } from '../ui/logos/index.jsx'

const OCEAN = '#a8c3ef'
const FRAME = '#f7f8fc'
const LAND = '#fffaf0'
const HOME_LAND = '#8fd6b8'
const TILE_R = 0.62        // 육각 타일 반지름 (h3 해상도4 ≈ 0.7 단위보다 조금 작게 → 틈)
const LINE_Y = 1.0         // 경계선 높이 (홈 국가 타일 윗면 0.9 보다 살짝 위)
export const BOARD_EXPAND_DISTANCE = 120 // 카메라가 이보다 가까우면 무리 라벨을 펼침

// 사이트 → 보드 위 위치 (가까운 핀은 화면용으로 살짝 벌림). CameraRig 도 같은 함수를 씁니다.
export function boardPinPositions(sites) {
  const display = spreadPins(sites, 0.5)
  const out = {}
  for (const s of sites) {
    const d = display[s.id]
    const p = projectToBoard(d.lat, d.lng) ?? projectToBoard(s.lat, s.lng)
    if (p) out[s.id] = p
  }
  return out
}

// 핀 높이: √MW 비례 (30MW ≈ 2.9, 1,600MW ≈ 11.5)
export const boardPinHeight = (mw) => 2 + Math.sqrt(Math.max(0, mw)) * 0.3

export default function BoardView({ visible }) {
  const [geo, setGeo] = useState(null)
  useEffect(() => {
    fetch('/data/board-hex.json').then((r) => r.json()).then(setGeo).catch(() => {})
  }, [])
  return (
    <group visible={visible}>
      {BOARDS.map((b) => <Plate key={b.id} board={b} />)}
      {geo && <LandTiles geo={geo} />}
      {geo && <BoardLines geo={geo} />}
      {visible && <BoardCities />}
      {visible && <BoardPins />}
      {visible && <ContractLinks />}
    </group>
  )
}

// ---------- 판 받침대 + 이름표 ----------
function Plate({ board }) {
  const lang = useAppStore((s) => s.lang)
  const [px, pz] = boardPos(board.id)
  return (
    <group position={[px, 0, pz]}>
      {/* 흰 테두리 받침 */}
      <RoundedBox args={[board.w + 2.4, 1.6, board.d + 2.4]} radius={0.8} smoothness={3} position={[0, -0.9, 0]} receiveShadow>
        <meshStandardMaterial color={FRAME} roughness={0.9} />
      </RoundedBox>
      {/* 바다 */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[board.w, 0.1, board.d]} />
        <meshLambertMaterial color={OCEAN} />
      </mesh>
      {/* 판 이름표: 삽입판은 왼쪽 위, 본판은 앞쪽 오른쪽 모서리 (위쪽은 사이트 라벨과 겹치기 쉬움) */}
      <Html
        position={board.inset ? [-board.w / 2 + 1, 0.2, -board.d / 2 - 1.2] : [board.w / 2 - 1, 0.2, board.d / 2 + 2.2]}
        zIndexRange={[6, 0]}
        style={{ pointerEvents: 'none', transform: board.inset ? undefined : 'translateX(-100%)' }}
      >
        <div className={`board-tag${board.inset ? ' inset' : ''}`}>
          {lang === 'ko' ? board.name_ko : board.name_en}
          {board.inset && <span>{lang === 'ko' ? '같은 축척' : 'same scale'}</span>}
        </div>
      </Html>
    </group>
  )
}

// ---------- 육지 육각 타일 (모든 판을 InstancedMesh 하나로) ----------
function LandTiles({ geo }) {
  const ref = useRef()
  const items = useMemo(() => {
    const arr = []
    for (const b of BOARDS) {
      const flat = geo.boards[b.id] ?? []
      const [px, pz] = boardPos(b.id)
      for (let i = 0; i < flat.length; i += geo.stride) {
        const [x, z] = projectLocal(b, flat[i], flat[i + 1])
        arr.push({ x: px + x, z: pz + z, home: flat[i + 2] === 1 })
      }
    }
    return arr
  }, [geo])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new Object3D()
    const color = new Color()
    items.forEach((t, i) => {
      const h = t.home ? 0.9 : 0.5 // 홈 국가는 살짝 더 솟게
      dummy.position.set(t.x, h / 2, t.z)
      dummy.scale.set(1, h, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      const jitter = (Math.sin(i * 12.9898) * 43758.5453) % 1 // 결정적 미세 명암 → 타일 질감
      color.set(t.home ? HOME_LAND : LAND).offsetHSL(0, 0, jitter * 0.03)
      mesh.setColorAt(i, color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])

  return (
    <instancedMesh ref={ref} name="board-tiles" args={[null, null, items.length]} receiveShadow>
      <cylinderGeometry args={[TILE_R, TILE_R, 1, 6]} />
      <meshLambertMaterial />
    </instancedMesh>
  )
}

// ---------- 경계선 ----------
// [경도, 위도, ...] 선 목록 → 월드 좌표 선분 (LineSegments 하나 = 드로우콜 1회)
function segments(board, list) {
  const [px, pz] = boardPos(board.id)
  const pos = []
  for (const flat of list) {
    for (let i = 2; i < flat.length; i += 2) {
      const [ax, az] = projectLocal(board, flat[i - 1], flat[i - 2])
      const [bx, bz] = projectLocal(board, flat[i + 1], flat[i])
      pos.push(px + ax, LINE_Y, pz + az, px + bx, LINE_Y, pz + bz)
    }
  }
  return pos
}
function BoardLines({ geo }) {
  const built = useMemo(() => {
    const countries = [], states = [], focus = []
    for (const b of BOARDS) {
      const L = geo.lines?.[b.id]
      if (!L) continue
      countries.push(...segments(b, L.countries))
      states.push(...segments(b, L.states))
      const [px, pz] = boardPos(b.id)
      for (const flat of L.focus) {
        const pts = []
        for (let i = 0; i < flat.length; i += 2) {
          const [x, z] = projectLocal(b, flat[i + 1], flat[i])
          pts.push([px + x, LINE_Y + 0.02, pz + z])
        }
        focus.push(pts)
      }
    }
    const g = (arr) => {
      const bg = new BufferGeometry()
      bg.setAttribute('position', new Float32BufferAttribute(arr, 3))
      return bg
    }
    return { countries: g(countries), states: g(states), focus }
  }, [geo])
  return (
    <group name="board-lines">
      <lineSegments geometry={built.countries}>
        <lineBasicMaterial color="#7d8db0" transparent opacity={0.65} />
      </lineSegments>
      <lineSegments geometry={built.states}>
        <lineBasicMaterial color="#7d8db0" transparent opacity={0.32} />
      </lineSegments>
      {built.focus.map((pts, i) => (
        <Line key={i} points={pts} color="#4f6390" lineWidth={1.8} transparent opacity={0.85} />
      ))}
    </group>
  )
}

// ---------- 기준 도시 ----------
function BoardCities() {
  const lang = useAppStore((s) => s.lang)
  const placed = useMemo(
    () => CITIES.map((c) => ({ c, p: projectToBoard(c.lat, c.lng) })).filter((x) => x.p),
    [],
  )
  return placed.map(({ c, p }) => (
    <group key={c.en} position={[p.x, LINE_Y, p.z]}>
      <mesh>
        <sphereGeometry args={[0.28, 8, 6]} />
        <meshBasicMaterial color="#55627f" />
      </mesh>
      <Html center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="city-label board">{lang === 'ko' ? c.ko : c.en}</div>
      </Html>
    </group>
  ))
}

// ---------- 사이트 핀 ----------
function BoardPins() {
  const sites = useAppStore((s) => s.data?.sites ?? EMPTY)
  const positions = useMemo(() => boardPinPositions(sites), [sites])
  // 가까운 사이트(예: 스위트워터 1·2·칠드레스)는 무리로 묶어 라벨 하나로
  const ranks = useMemo(() => labelRanks(sites, 3.8), [sites]) // 3.8°: 칠드레스·스위트워터 1·2·카이오와를 한 무리로
  return sites
    .filter((s) => positions[s.id])
    .map((s) => <BoardPin key={s.id} site={s} pos={positions[s.id]} rank={ranks[s.id]} />)
}

function BoardPin({ site, pos, rank }) {
  const lang = useAppStore((s) => s.lang)
  const hoverId = useAppStore((s) => s.hoverId)
  const setHover = useAppStore((s) => s.setHover)
  const requestSite = useAppStore((s) => s.requestSite)
  const active = useAppStore((s) => isSiteActive(s, site))
  const style = styleOf(site.status)
  const hovered = hoverId === site.id
  const h = boardPinHeight(site.grid_mw)
  const ringRef = useRef()
  const labelRef = useRef()
  const world = useMemo(() => new Vector3(pos.x, 0, pos.z), [pos.x, pos.z])

  useFrame(({ camera, clock }) => {
    // 바닥 링 펄스: 상태별 속도
    if (ringRef.current) {
      const speed = style.ringSpeed
      const t = speed > 0 ? (clock.elapsedTime * speed * 0.6) % 1 : 0
      const s = 1 + t * 2.2
      ringRef.current.scale.set(s, 1, s)
      ringRef.current.material.opacity = speed > 0 ? (1 - t) * (active ? 0.75 : 0.15) : 0
    }
    // 가까이 줌하면 무리 라벨을 펼침
    if (labelRef.current) {
      labelRef.current.dataset.expanded = camera.position.distanceTo(world) < BOARD_EXPAND_DISTANCE ? '1' : '0'
      labelRef.current.style.opacity = active ? 1 : 0.4
    }
  })

  const color = active ? style.color : '#c3c9d8'
  const onOver = (e) => { e.stopPropagation(); setHover(site.id); document.body.style.cursor = 'pointer' }
  const onOut = () => { setHover(null); document.body.style.cursor = '' }
  const onClick = (e) => { e.stopPropagation(); requestSite(site.id) }

  return (
    <group position={[pos.x, 0.9, pos.z]}>
      <mesh position={[0, h / 2, 0]} scale={hovered ? 1.25 : 1} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} castShadow>
        <cylinderGeometry args={[0.75, 0.9, h, 12]} />
        <meshStandardMaterial color={color} roughness={0.55} transparent opacity={site.status === 'planned' ? 0.8 : 1} />
      </mesh>
      <mesh position={[0, h + 0.6, 0]} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <sphereGeometry args={[1.25, 16, 12]} />
        <meshStandardMaterial color={new Color(color).offsetHSL(0, 0, 0.12)} roughness={0.4} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <ringGeometry args={[1.1, 1.55, 32]} />
        <meshBasicMaterial color={style.color} transparent depthWrite={false} />
      </mesh>
      {rank?.lead && (
        <Html position={[0, h + 2.6, 0]} center zIndexRange={[20, 0]}>
          <div ref={labelRef} className="pin-cluster" data-expanded="0">
            {[site, ...rank.members].map((m, i) => (
              <button
                key={m.id}
                className={`pin-label${hoverId === m.id ? ' is-hover' : ''}${i > 0 ? ' member' : ''}`}
                onPointerEnter={() => setHover(m.id)}
                onPointerLeave={() => setHover(null)}
                onClick={() => requestSite(m.id)}
              >
                <span className="dot" style={{ background: styleOf(m.status).color }} />
                <span className="name">{pickName(m, lang)}</span>
                <span className="mw">{fmtMw(m.grid_mw)}</span>
                {i === 0 && rank.members.length > 0 && <span className="more">+{rank.members.length}</span>}
              </button>
            ))}
          </div>
        </Html>
      )}
    </group>
  )
}

// ---------- 고객 계약 연결선 ----------
// 본판 북쪽 가장자리 위에 고객 배지(로고·금액)를 띄우고, 배지 → 사이트 핀까지 흐르는 아치선을 그립니다.
// 계약끼리 구분: 고객 고유색 + 로고 배지 + 핀 옆 도착 로고 칩 (선은 모두 같은 흐르는 점선)
// 같은 사이트로 가는 계약이 여럿이면 도착 지점을 핀 좌우로 벌려 선이 겹치지 않게 합니다.
// 배지에 마우스를 올리면 그 계약선만 강조, 나머지는 흐리게.
// 선 굵기 ∝ 계약 금액, 타임라인이 서명일 이전이면 그 계약은 보이지 않습니다.
const DASH = [2.4, 1.2] // 점선 길이·간격 (모든 계약 공통)
// 계약 배지를 보드판 북쪽 가장자리에서 얼마나 띄울지 (CameraRig 의 첫 화면 맞춤도 이 값을 씀)
export const CONTRACT_GAP = 18

function ContractLinks() {
  const show = useAppStore((s) => s.showContracts)
  const month = useAppStore((s) => s.month)
  const data = useAppStore((s) => s.data)
  const contracts = useMemo(() => (data?.companies ?? []).flatMap((c) => c.contracts ?? []), [data])
  const positions = useMemo(() => boardPinPositions(data?.sites ?? []), [data])
  if (!show || !contracts.length) return null
  const na = BOARDS.find((b) => b.id === 'na')
  const [px, pz] = boardPos('na')
  // 사이트별로 도착하는 계약 순서 (도착 지점 좌우 분리용)
  const active = contracts.filter((k) => month >= toMonth(k.signed))
  const slot = {}
  for (const k of active) for (const sid of k.sites) (slot[sid] ??= []).push(k.id)
  // 배지는 판 폭 전체에 퍼뜨리고 높이를 번갈아 달리해 원근 때문에 겹치지 않게
  // 배지가 넓으니 판 폭만큼 퍼뜨리되, 데스크톱은 왼쪽 사이트 목록에 가리지 않게 묶음 전체를 오른쪽으로
  // 세로 화면(모바일)은 가로 폭이 좁아 양쪽 배지가 잘리므로 간격을 좁힘
  const portrait = layoutKind() === 'portrait'
  const span = portrait ? na.w * 0.78 : na.w - 4
  const shift = !portrait && typeof window !== 'undefined' && window.innerWidth >= 768 ? 12 : 0
  return contracts.map((k, i) => {
    if (month < toMonth(k.signed)) return null // 아직 서명 전
    const x = shift + (contracts.length === 1 ? px : px - span / 2 + (span * i) / (contracts.length - 1))
    const anchor = new Vector3(x, 8 + (i % 2) * 6, pz - na.d / 2 - CONTRACT_GAP)
    return <Contract key={k.id} contract={k} anchor={anchor} positions={positions} sites={data.sites} slot={slot} />
  })
}

function Contract({ contract: k, anchor, positions, sites, slot }) {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const hoverContract = useAppStore((s) => s.hoverContract)
  const setHoverContract = useAppStore((s) => s.setHoverContract)
  const requestSite = useAppStore((s) => s.requestSite)
  const lineRefs = useRef([])
  // 흐르는 점선: 매 프레임 점선 시작 위치를 옮김 (고객 → 사이트 방향)
  useFrame((_, delta) => {
    for (const l of lineRefs.current) if (l?.material) l.material.dashOffset -= delta * 3
  })
  const dim = hoverContract && hoverContract !== k.id
  const focus = hoverContract === k.id
  const width = (1.5 + (k.value_usd_bn ?? 1) / 2.5) * (focus ? 1.5 : 1)
  const targets = k.sites
    .map((sid) => ({ site: sites.find((s) => s.id === sid), pos: positions[sid] }))
    .filter((x) => x.site && x.pos)
  const name = lang === 'ko' ? k.customer_ko ?? k.customer : k.customer
  const bNames = (site) => (k.buildings ?? []).map((id) => site.buildings.find((b) => b.id === id)).filter(Boolean)
  return (
    <group>
      {targets.map(({ site, pos }, i) => {
        // 같은 사이트로 오는 계약이 여럿이면 핀 좌우로 벌림 (2개면 -1.8 / +1.8)
        const list = slot[site.id] ?? [k.id]
        const off = (list.indexOf(k.id) - (list.length - 1) / 2) * 3.6
        const end = new Vector3(pos.x + off, 0.9 + boardPinHeight(site.grid_mw) * 0.75, pos.z)
        const mid = anchor.clone().lerp(end, 0.5)
        mid.y = 22 + anchor.distanceTo(end) * 0.12 // 거리가 멀수록 높게 휘어짐
        const bs = bNames(site)
        return (
          <group key={site.id}>
            <QuadraticBezierLine
              ref={(el) => (lineRefs.current[i] = el)}
              start={anchor}
              end={end}
              mid={mid}
              color={k.color}
              lineWidth={width}
              dashed
              dashSize={DASH[0]}
              gapSize={DASH[1]}
              transparent
              opacity={dim ? 0.15 : 0.95}
            />
            {/* 도착 로고 칩: 핀 옆에서 "이 선이 어느 고객인지" 바로 보이게 */}
            <Html position={end} center zIndexRange={[19, 0]} style={{ pointerEvents: 'none' }}>
              <div className={`contract-end${dim ? ' dim' : ''}`} style={{ borderColor: k.color }}>
                {k.logo ? <CustomerLogo name={k.logo} size={12} /> : <span className="ce-dot" style={{ background: k.color }} />}
                {/* 짧은 대상 이름: 데이터의 scope 우선, 없으면 건물 이름 */}
                {(lang === 'ko' ? k.scope_ko : k.scope_en) ? (
                  <span>{lang === 'ko' ? k.scope_ko : k.scope_en}</span>
                ) : bs.length > 0 && (
                  <span>{bs.length > 1 ? `${pickName(bs[0], lang)}–${bs.at(-1).name.replace(/^\D+/, '')}` : pickName(bs[0], lang)}</span>
                )}
              </div>
            </Html>
          </group>
        )
      })}
      <Html position={anchor} center zIndexRange={[18, 0]}>
        <div
          className={`contract-badge${dim ? ' dim' : ''}${focus ? ' focus' : ''}`}
          style={{ borderColor: k.color, '--cb': k.color }}
          onPointerEnter={() => setHoverContract(k.id)}
          onPointerLeave={() => setHoverContract(null)}
          onClick={() => targets[0] && requestSite(targets[0].site.id)}
        >
          <span className="cb-name">
            {k.logo && <CustomerLogo name={k.logo} size={15} />}
            <span style={{ color: k.color }}>{name}</span>
          </span>
          <span className="cb-meta">
            {k.value_usd_bn != null && <b>${k.value_usd_bn}bn</b>}
            {k.term_years != null && <span> · {k.term_years}{t.contracts.years}</span>}
            {k.it_mw != null && <span> · {k.it_mw}MW IT</span>}
          </span>
          <span className="cb-where">
            {targets.length
              ? targets.map(({ site }) => pickName(site, lang)).join(', ')
              : t.contracts.undisclosed}
          </span>
        </div>
      </Html>
    </group>
  )
}
