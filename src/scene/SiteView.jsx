// =============================================================
// SiteView — 선택한 사이트의 아이소메트릭 캠퍼스
// layoutCampus() 가 계산한 좌표를 받아 그리기만 합니다.
// =============================================================
import { CustomerLogo, logoKeyOf, BRAND_COLOR } from '../ui/logos/index.jsx'
import { useMemo } from 'react'
import { Line, RoundedBox } from '@react-three/drei'
import Html from './SafeHtml.jsx'
import { useAppStore, isStatusActive, EMPTY } from '../store/useAppStore.js'
import { useT, pickName } from '../i18n/useT.js'
import { styleOf } from '../data/statusStyle.js'
import { layoutCampus, campusStateAt } from './layoutCampus.js'
import { fmtMw } from './geo.js'
import Block from './buildings/Block.jsx'
import { Substation, PowerLine, Crane, Truck, FlowDots, Trees } from './buildings/Infrastructure.jsx'

export default function SiteView({ site }) {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const hoverId = useAppStore((s) => s.hoverId)
  const setHover = useAppStore((s) => s.setHover)
  const selectedId = useAppStore((s) => s.selectedBuildingId)
  const selectBuilding = useAppStore((s) => s.selectBuilding)
  const activeStatuses = useAppStore((s) => s.activeStatuses)

  const month = useAppStore((s) => s.month)
  const companies = useAppStore((s) => s.data?.companies ?? EMPTY)
  const contracts = useMemo(() => companies.flatMap((c) => c.contracts ?? []), [companies])
  // 고정 배치는 사이트가 바뀔 때만, 상태는 날짜가 바뀔 때마다 계산
  const group = companies.find((c) => c.id === site.primary)?.group
  const defaultKind = group === 'hyperscaler' ? 'datahall_liquid' : 'datahall_air'
  const layout = useMemo(() => layoutCampus(site._raw, { defaultKind }), [site._raw, defaultKind])
  const S = useMemo(() => campusStateAt(layout, site._raw, month), [layout, site._raw, month])
  const L = { ...layout, ...S } // 아래 코드가 L.blocks / L.substation / L.cranes … 로 읽음
  // 라벨에 쓰는 건물 정보 (그 날짜의 화면용 값: 상태·날짜·진행률)
  const byId = useMemo(() => Object.fromEntries(site.buildings.map((b) => [b.id, b])), [site])
  const half = L.side / 2

  // 전력 흐름 점: 가동/시운전 건물의 첫 블록으로
  const flowTargets = L.blocks.filter((b) => b.isAnchor && !b.asLot && (b.status === 'operating' || b.status === 'commissioning'))

  return (
    <group name={`site-${site.id}`}>
      {/* 넓은 바닥 (그림자 받기) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.32, 0]} receiveShadow>
        <circleGeometry args={[L.side * 3, 48]} />
        <meshStandardMaterial color="#e4e8f4" roughness={1} />
      </mesh>
      {/* 부지 판 */}
      <RoundedBox args={[L.side, 0.5, L.side]} radius={0.25} position={[0, -0.25, 0]} receiveShadow>
        <meshStandardMaterial color="#f2f4fa" roughness={0.95} />
      </RoundedBox>
      {/* 도로 */}
      <mesh position={[0, 0.01, L.road.z]} receiveShadow>
        <boxGeometry args={[L.side + 14, 0.04, L.road.depth]} />
        <meshStandardMaterial color="#cdd2e2" roughness={1} />
      </mesh>
      {/* 도로 중앙 점선 */}
      {Array.from({ length: Math.floor((L.side + 14) / 2.4) }, (_, i) => (
        <mesh key={i} position={[-half - 7 + 1.2 + i * 2.4, 0.04, L.road.z]}>
          <boxGeometry args={[1.1, 0.01, 0.12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      <PowerLine line={L.powerLine} />
      <Substation sub={L.substation} t={t} />
      {L.powerLine.energized && flowTargets.length > 0 && (
        <FlowDots from={[L.substation.x, L.substation.z]} targets={flowTargets} />
      )}

      {/* 블록들 */}
      {L.blocks.map((b) => (
        <Block
          key={b.key}
          block={b}
          hovered={b.buildingId && hoverId === b.buildingId}
          selected={b.buildingId && selectedId === b.buildingId}
          dimmed={!isStatusActive(activeStatuses, b.status)}
          onHover={(id) => setHover(id, '3d')}
          onLeave={(id) => useAppStore.getState().clearHover(id, '3d')}
          onSelect={(id) => selectBuilding(id)}
        />
      ))}

      {/* 고객 계약 구역: 건물마다 고객 칩을 반복하는 대신, 바닥 테두리 + 고객 배지 한 번 */}
      <CustomerZones blocks={L.blocks} byId={byId} contracts={contracts} />

      {/* 건물 라벨 (첫 블록 위) */}
      {L.blocks
        .filter((b) => b.isAnchor && !b.asLot && (b.buildingId ? byId[b.buildingId] : L.lotCount > 0))
        .map((b) => {
          const bld = b.buildingId ? byId[b.buildingId] : null
          const st = styleOf(b.status)
          const hovered = bld && hoverId === bld.id
          const selected = bld && selectedId === bld.id
          const pct = bld && b.status === 'under_construction' && bld.progress != null ? Math.round(bld.progress * 100) : null
          const date = bld?.dates?.target ?? bld?.dates?.end
          // zIndexRange 는 호버와 상관없이 고정: 호버할 때 라벨을 맨 위로 올리면 겹친 두 라벨이
          // 서로 위로 올라오며 마우스 아래 요소가 계속 바뀌는 진동(깜빡임)이 생김
          return (
            <Html key={`lbl-${b.key}`} position={[b.x, b.h + 1.3, b.z]} center zIndexRange={[12, 0]}>
              <div
                className={`bld-label${hovered ? ' is-hover' : ''}${selected ? ' is-selected' : ''}`}
                onPointerEnter={() => bld && setHover(bld.id)}
                onPointerLeave={() => bld && useAppStore.getState().clearHover(bld.id)}
                // stopPropagation: 라벨 클릭이 3D 쪽으로 퍼져 뒤에 있는 건물 블록도 "클릭"되면 선택이 바로 다시 풀림
                onClick={(e) => { e.stopPropagation(); if (bld) selectBuilding(bld.id) }}
              >
                <div className="row">
                  <span className="dot" style={{ background: st.color }} />
                  <span className="name">{bld ? pickName(bld, lang) : `${fmtMw(L.remainingMw)}`}</span>
                  {/* 건설중이면 진행률 막대 (마우스를 올리지 않아도 보이게) */}
                  {pct != null && (
                    <span className="prog" aria-label={`${pct}%`}>
                      <i style={{ width: `${pct}%` }} />
                    </span>
                  )}
                </div>
                {!bld && <div className="sub">{lang === 'ko' ? '용도 미발표 전력' : 'Unallocated power'}</div>}
                {bld && hovered && (
                  <div className="detail">
                    <div>{t.status[b.status]}{b.status === 'under_construction' && bld.progress != null ? ` · ${Math.round(bld.progress * 100)}%` : ''}</div>
                    <div>{bld.it_mw ? `${bld.it_mw}MW IT / ` : ''}{bld.gross_mw}MW gross</div>
                    {bld.gpu && <div>GPU · {bld.gpu.model}{bld.gpu.count ? ` × ${bld.gpu.count.toLocaleString()}` : ''}</div>}
                    {date && <div className="pending">{t.panel.target} · {date}</div>}
                    {bld.dates?.delivered && <div>{t.panel.delivered} · {bld.dates.delivered}</div>}
                  </div>
                )}
              </div>
            </Html>
          )
        })}

      {/* 블록 1칸이 몇 MW 인지 항상 표시 — 빈 부지(점선 칸)가 얼마만큼의 전력인지 읽을 수 있게 */}
      <Html position={[-L.side / 2 + 3, 0.5, L.side / 2 - 1]} center zIndexRange={[10, 0]}>
        <div className="tag">{lang === 'ko' ? `1칸 = ${L.blockMw}MW` : `1 block = ${L.blockMw}MW`}</div>
      </Html>
      {L.cranes.map((c, i) => <Crane key={c.key} x={c.x} z={c.z} seed={i} />)}
      {L.trucks.map((tr, i) => <Truck key={tr.key} truck={tr} index={i} lang={lang} />)}
      <Trees side={L.side} seed={site.id.length * 7 + site.grid_mw} roadZ={L.road.z} />
    </group>
  )
}

// ---------- 고객 계약 구역 ----------
// 같은 고객(예: Microsoft)의 건물 블록마다 바닥에 고객 색 테두리를 두르고, 고객 배지는 한 번만
// (그 블록들의 가운데, 앞쪽 도로 쪽에). 계약 정보(색·금액)가 있으면 함께 표시합니다.
const ZONE_PAD = 0.55 // 블록 둘레에서 테두리까지 여백
function CustomerZones({ blocks, byId, contracts }) {
  const zones = useMemo(() => {
    const map = new Map()
    for (const b of blocks) {
      if (!b.buildingId || b.asLot) continue // 그 날짜에 아직 없는 칸은 제외 → 구역이 시간에 따라 자람
      const bld = byId[b.buildingId]
      if (!bld?.customer) continue
      const logo = logoKeyOf(bld.customer)
      const key = logo ?? bld.customer
      const k = contracts.find((c) => c.buildings?.includes(b.buildingId))
      if (!map.has(key)) {
        map.set(key, { key, name: bld.customer, logo, color: k?.color ?? BRAND_COLOR[key] ?? '#55627f', value: k?.value_usd_bn, blocks: [] })
      }
      map.get(key).blocks.push(b)
    }
    return [...map.values()]
  }, [blocks, byId, contracts])

  return zones.map((zn) => {
    const cx = zn.blocks.reduce((a, b) => a + b.x, 0) / zn.blocks.length
    const front = Math.max(...zn.blocks.map((b) => b.z + b.d / 2))
    return (
      <group key={zn.key}>
        {zn.blocks.map((b) => {
          const x0 = b.x - b.w / 2 - ZONE_PAD, x1 = b.x + b.w / 2 + ZONE_PAD
          const z0 = b.z - b.d / 2 - ZONE_PAD, z1 = b.z + b.d / 2 + ZONE_PAD
          return <Line key={b.key} points={[[x0, 0.1, z0], [x1, 0.1, z0], [x1, 0.1, z1], [x0, 0.1, z1], [x0, 0.1, z0]]} color={zn.color} lineWidth={2.4} />
        })}
        <Html position={[cx, 0.3, front + 1.4]} center zIndexRange={[11, 0]}>
          <div className="zone-badge" style={{ borderColor: zn.color, color: zn.color }}>
            {zn.logo && <CustomerLogo name={zn.logo} size={12} />}
            <b>{zn.name}</b>
            {zn.value != null && <span>${zn.value}bn</span>}
          </div>
        </Html>
      </group>
    )
  })
}
