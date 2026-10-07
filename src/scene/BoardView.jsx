// =============================================================
// BoardView — 보드판 지도 (캐나다·미국·스페인·호주 국가 카드 4장, 사이트 있는 주 강조)
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
import { Line, QuadraticBezierLine, RoundedBox } from '@react-three/drei'
import Html from './SafeHtml.jsx' // drei Html 을 이벤트 연결 뒤에 붙이는 포장 (첫 라벨이 비는 문제 방지)
import { BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Object3D, SRGBColorSpace, Vector3 } from 'three'
import { useAppStore, isSiteActive, EMPTY } from '../store/useAppStore.js'
import { styleOf } from '../data/statusStyle.js'
import { BOARDS, boardPos, layoutBounds, projectLocal, projectToBoard, layoutKind } from './boards.js'
import { spreadPins, labelRanksBy, fmtMw } from './geo.js'
import { CITIES } from './cities.js'
import { pickName, useT } from '../i18n/useT.js'
import { toMonth } from '../data/timeline.js'
import { CustomerLogo } from '../ui/logos/index.jsx'

const OCEAN = '#a8c3ef'
const FRAME = '#f7f8fc'
const LAND = '#fbf6e9'      // 나라 육지 (크림색) — 파란 바다 위에 실루엣이 또렷하게
const FOCUS_LAND = '#8fd6b8' // 사이트가 있는 주 (민트) — 타일도 더 솟음
// h3 해상도별 육각형 꼭짓점 반지름(km) → 타일 반지름(월드 단위). 0.92 배로 살짝 줄여 타일 사이에 틈
// 카드마다 배율(k)과 해상도가 달라서 타일마다 크기를 따로 계산합니다.
const HEX_KM = { 3: 59.8, 4: 22.6, 5: 8.54 }
const tileRadius = (res, k) => ((HEX_KM[res] ?? HEX_KM[4]) / 111.2) * k * 0.92
const LINE_Y = 1.0         // 경계선 높이 (강조 주 타일 윗면 0.9 보다 살짝 위)
const PIN_GAP = 1.6        // 같은 카드의 핀끼리 최소 간격 (월드 단위) — 배율이 작은 카드에서 핀이 포개지지 않게
const CLUSTER_NEAR = 4     // 핀끼리 이보다 가까우면(월드 단위) 라벨 하나로 묶음
export const BOARD_EXPAND_DISTANCE = 90 // 카메라가 이보다 가까우면 무리 라벨을 펼침 (첫 화면 거리 ≈ 240)

// 사이트 → 카드 위 위치 (가까운 핀은 화면용으로 살짝 벌림). CameraRig 도 같은 함수를 씁니다.
// 카드마다 배율이 달라서, 벌리는 간격(도)도 카드별로 PIN_GAP ÷ 배율로 맞춥니다.
export function boardPinPositions(sites) {
  const out = {}
  for (const b of BOARDS) {
    const group = sites.filter((s) => s.country === b.country)
    const display = spreadPins(group, PIN_GAP / b.k)
    for (const s of group) {
      const d = display[s.id]
      const p = projectToBoard(d.lat, d.lng, s.country) ?? projectToBoard(s.lat, s.lng, s.country)
      if (p) out[s.id] = p
    }
  }
  return out
}

// 핀 높이: √MW 비례 (30MW ≈ 2.1, 1,600MW ≈ 8.0) — 판 폭(28~38)의 1/4 남짓이 최대가 되도록
export const boardPinHeight = (mw) => 1.2 + Math.sqrt(Math.max(0, mw)) * 0.17

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
      {/* 판 이름 명판: 모든 판 공통으로 오른쪽 아래 모서리 */}
      <BoardTag board={board} lang={lang} />
    </group>
  )
}

// ---------- 판 이름 명판 ----------
// 판 바닥에 "인쇄된" 명판. 공중에 뜬 흰 말풍선(사이트 라벨)과 한눈에 구분되도록
// HTML 이 아니라 캔버스에 글자를 그린 그림(텍스처)을 판 위에 눕힌 평면으로 붙입니다.
//  - 원근에 따라 같이 기울고 작아져서 판의 일부처럼 보임
//  - drei Html 은 처음 붙는 순간 React 루트가 지워지는 경쟁이 있어 본판 이름표가 통째로
//    사라지는 문제가 있었음 → 3D 평면이라 그런 문제가 없음
const TAG_PAD = 1.2     // 판 모서리에서 명판까지 여백 (월드 단위)
const TAG_Y = 1.1       // 육지 타일(≤0.9)·경계선(1.0) 위
const TAG_UNIT = 0.065  // 명판 1px(설계 단위) = 0.065 월드 단위 (카드 폭 35~39 에 맞춘 크기)
const TAG_RES = 4       // 캔버스 해상도 배수 (가까이 줌해도 글자가 또렷하게)
const TAG_FONT = '"Pretendard", "Apple SD Gothic Neo", -apple-system, "Segoe UI", sans-serif'
// lucide "map" 아이콘 경로 (24×24 기준) — 캔버스에 직접 그리기 위해 경로 문자열만 가져옴
const MAP_ICON_PATHS = [
  'M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z',
  'M15 5.764v15',
  'M9 3.236v15',
]

function BoardTag({ board, lang }) {
  const name = lang === 'ko' ? board.name_ko : board.name_en
  const sub = lang === 'ko' ? board.focus_ko : board.focus_en // 강조한 주 이름
  // 웹폰트가 늦게 준비되면 글자 폭이 달라지므로, 준비된 뒤 한 번 더 그림
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => { document.fonts?.ready.then(() => setFontsReady(true)) }, [])
  const tag = useMemo(() => drawTagTexture(name, sub), [name, sub, fontsReady])
  useEffect(() => () => tag.texture.dispose(), [tag]) // 바뀌거나 사라질 때 GPU 메모리 정리

  // 명판의 오른쪽 아래 꼭짓점을 판의 오른쪽 아래 모서리(여백 안쪽)에 맞춤
  const x = board.w / 2 - TAG_PAD - tag.w / 2
  const z = board.d / 2 - TAG_PAD - tag.h / 2
  return (
    <mesh position={[x, TAG_Y, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[tag.w, tag.h]} />
      <meshBasicMaterial map={tag.texture} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

// 명판 그림 만들기: [지도 아이콘] 나라 이름 | 강조한 주
// 반환: 텍스처와 월드 단위 가로·세로
function drawTagTexture(name, sub) {
  const R = TAG_RES
  const padL = 11, padR = 14, gap = 8, icon = 18, h = 34 // 설계 단위(px)
  const nameFont = `800 22px ${TAG_FONT}`
  const noteFont = `600 15px ${TAG_FONT}`

  // 1) 글자 폭을 재서 명판 가로 길이 결정
  const measure = document.createElement('canvas').getContext('2d')
  measure.font = nameFont
  const nameW = measure.measureText(name).width
  measure.font = noteFont
  const subW = sub ? measure.measureText(sub).width : 0
  const subBlock = sub ? gap + 1.5 + 10 + subW : 0 // 간격 + 구분선 + 여백 + 글자
  const w = Math.ceil(padL + icon + gap + nameW + subBlock + padR)

  // 2) 실제 그리기 (해상도 R배)
  const canvas = document.createElement('canvas')
  canvas.width = w * R
  canvas.height = h * R
  const ctx = canvas.getContext('2d')
  ctx.scale(R, R)
  ctx.fillStyle = 'rgba(52, 64, 94, 0.9)' // 진한 남색 바탕
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, 6)
  ctx.fill()

  // 지도 아이콘 (lucide map, 24 → 18 로 축소)
  ctx.save()
  ctx.translate(padL, (h - icon) / 2)
  ctx.scale(icon / 24, icon / 24)
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const d of MAP_ICON_PATHS) ctx.stroke(new Path2D(d))
  ctx.restore()

  // 지역 이름
  let cx = padL + icon + gap
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.font = nameFont
  ctx.fillText(name, cx, h / 2 + 1)
  cx += nameW

  // 강조한 주: 세로 구분선 뒤 민트색 작은 글씨 (지도 위 강조 타일과 같은 색 계열)
  if (sub) {
    cx += gap
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(cx, 9, 1.5, h - 18)
    cx += 1.5 + 10
    ctx.fillStyle = '#a9e6cf'
    ctx.font = noteFont
    ctx.fillText(sub, cx, h / 2 + 1)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace // 색이 CSS 와 같게 보이도록
  texture.anisotropy = 4               // 비스듬히 볼 때도 덜 흐리게
  return { texture, w: w * TAG_UNIT, h: h * TAG_UNIT }
}

// ---------- 육지 육각 타일 (모든 판을 InstancedMesh 하나로) ----------
function LandTiles({ geo }) {
  const ref = useRef()
  const items = useMemo(() => {
    const arr = []
    for (const b of BOARDS) {
      const flat = geo.boards[b.id] ?? []
      const [px, pz] = boardPos(b.id)
      const r = tileRadius(geo.res?.[b.id] ?? b.res, b.k)
      for (let i = 0; i < flat.length; i += geo.stride) {
        const [x, z] = projectLocal(b, flat[i], flat[i + 1])
        arr.push({ x: px + x, z: pz + z, r, focus: flat[i + 2] === 1 })
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
      const h = t.focus ? 0.9 : 0.4 // 사이트가 있는 주는 더 솟게
      dummy.position.set(t.x, h / 2, t.z)
      dummy.scale.set(t.r, h, t.r) // 반지름 1 짜리 육각기둥을 타일 크기로 늘림
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      const jitter = (Math.sin(i * 12.9898) * 43758.5453) % 1 // 결정적 미세 명암 → 타일 질감
      color.set(t.focus ? FOCUS_LAND : LAND).offsetHSL(0, 0, jitter * 0.03)
      mesh.setColorAt(i, color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])

  return (
    <instancedMesh ref={ref} name="board-tiles" args={[null, null, items.length]} receiveShadow>
      <cylinderGeometry args={[1, 1, 1, 6]} />
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
const CITY_SHOW_HEIGHT = 75 // 카메라 높이가 이보다 낮으면 도시 이름 표시 (첫 화면 높이 ≈ 190)
// 나라 전체가 보이는 첫 화면에선 사이트 라벨과 겹치므로, 카메라가 가까이 왔을 때만 보여 줍니다.
function BoardCities() {
  const lang = useAppStore((s) => s.lang)
  const [near, setNear] = useState(false)
  useFrame(({ camera }) => {
    const v = camera.position.y < CITY_SHOW_HEIGHT // 높이로 판단 (보드판은 위에서 내려다봄)
    if (v !== near) setNear(v) // 경계를 넘을 때만 다시 그림
  })
  const placed = useMemo(
    () => CITIES.map((c) => ({ c, p: projectToBoard(c.lat, c.lng, c.cc) })).filter((x) => x.p),
    [],
  )
  if (!near) return null
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
  // 화면에서 가까운 사이트는 무리로 묶어 라벨 하나로 (가까이 줌하거나 마우스를 올리면 펼침).
  // 카드마다 배율이 달라 "몇 도"가 아니라 카드 위 거리(CLUSTER_NEAR 단위)로 묶음
  //  → 텍사스 4곳·BC 3곳은 각각 한 무리, 스페인·남호주는 혼자
  const ranks = useMemo(() => {
    const at = (s) => positions[s.id]
    const dist = (a, b) => (at(a) && at(b) && at(a).board === at(b).board ? Math.hypot(at(a).x - at(b).x, at(a).z - at(b).z) : Infinity)
    return labelRanksBy(sites.filter(at), CLUSTER_NEAR, dist)
  }, [sites, positions])
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
  const onOver = (e) => { e.stopPropagation(); setHover(site.id, '3d'); document.body.style.cursor = 'pointer' }
  const onOut = () => { useAppStore.getState().clearHover(site.id, '3d'); document.body.style.cursor = '' }
  const onClick = (e) => { e.stopPropagation(); requestSite(site.id) }

  return (
    <group position={[pos.x, 0.9, pos.z]}>
      <mesh position={[0, h / 2, 0]} scale={hovered ? 1.25 : 1} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} castShadow>
        <cylinderGeometry args={[0.42, 0.5, h, 12]} />
        <meshStandardMaterial color={color} roughness={0.55} transparent opacity={site.status === 'planned' ? 0.8 : 1} />
      </mesh>
      <mesh position={[0, h + 0.35, 0]} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <sphereGeometry args={[0.75, 16, 12]} />
        <meshStandardMaterial color={new Color(color).offsetHSL(0, 0, 0.12)} roughness={0.4} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <ringGeometry args={[0.65, 0.95, 32]} />
        <meshBasicMaterial color={style.color} transparent depthWrite={false} />
      </mesh>
      {rank?.lead && (
        <Html position={[0, h + 1.8, 0]} center zIndexRange={[20, 0]}>
          <div ref={labelRef} className="pin-cluster" data-expanded="0">
            {/* 대표 줄 */}
            <PinRow m={site} lead more={rank.members.length} hoverId={hoverId} setHover={setHover} requestSite={requestSite} lang={lang} />
            {/* 무리 구성원: 대표 줄 아래로 띄워 펼침 (대표 줄 위치는 그대로) */}
            {rank.members.length > 0 && (
              <div className="members">
                {rank.members.map((m) => (
                  <PinRow key={m.id} m={m} hoverId={hoverId} setHover={setHover} requestSite={requestSite} lang={lang} />
                ))}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

// 무리 라벨의 한 줄 (사이트 이름·MW, 대표 줄이면 +N)
function PinRow({ m, lead = false, more = 0, hoverId, setHover, requestSite, lang }) {
  return (
    <button
      className={`pin-label${hoverId === m.id ? ' is-hover' : ''}`}
      onPointerEnter={() => setHover(m.id)}
      onPointerLeave={() => useAppStore.getState().clearHover(m.id)}
      onClick={() => requestSite(m.id)}
    >
      <span className="dot" style={{ background: styleOf(m.status).color }} />
      {/* 끝의 "(스페인)" 같은 괄호는 뺌 — 국가 카드가 이미 어느 나라인지 보여 줌 (라벨이 짧아져 화면 밖으로 덜 나감) */}
      <span className="name">{pickName(m, lang).replace(/\s*\([^)]*\)$/, '')}</span>
      <span className="mw">{fmtMw(m.grid_mw)}</span>
      {lead && more > 0 && <span className="more">+{more}</span>}
    </button>
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
export const CONTRACT_GAP = 14

function ContractLinks() {
  const show = useAppStore((s) => s.showContracts)
  const month = useAppStore((s) => s.month)
  const data = useAppStore((s) => s.data)
  const contracts = useMemo(() => (data?.companies ?? []).flatMap((c) => c.contracts ?? []), [data])
  const positions = useMemo(() => boardPinPositions(data?.sites ?? []), [data])
  if (!show || !contracts.length) return null
  const b = layoutBounds() // 판 4개 전체 범위 — 배지는 그 북쪽 가장자리 위에 한 줄로
  // 사이트별로 도착하는 계약 순서 (도착 지점 좌우 분리용)
  const active = contracts.filter((k) => month >= toMonth(k.signed))
  const slot = {}
  for (const k of active) for (const sid of k.sites) (slot[sid] ??= []).push(k.id)
  // 배지는 판 폭 전체에 퍼뜨리고 높이를 번갈아 달리해 원근 때문에 겹치지 않게
  // 배지가 넓으니 판 폭만큼 퍼뜨리되, 데스크톱은 왼쪽 사이트 목록에 가리지 않게 묶음 전체를 오른쪽으로
  // 세로 화면(모바일)은 가로 폭이 좁아 양쪽 배지가 잘리므로 간격을 좁힘
  const portrait = layoutKind() === 'portrait'
  const span = portrait ? b.w * 0.78 : b.w - 4
  const shift = !portrait && typeof window !== 'undefined' && window.innerWidth >= 768 ? 12 : 0
  return contracts.map((k, i) => {
    if (month < toMonth(k.signed)) return null // 아직 서명 전
    const x = shift + (contracts.length === 1 ? b.cx : b.cx - span / 2 + (span * i) / (contracts.length - 1))
    const anchor = new Vector3(x, 6 + (i % 2) * 4, b.z0 - CONTRACT_GAP)
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
          onPointerLeave={() => useAppStore.getState().clearHoverContract(k.id)}
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
