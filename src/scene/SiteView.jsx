// =============================================================
// SiteView — 선택한 사이트의 아이소메트릭 캠퍼스
// layoutCampus() 가 계산한 좌표를 받아 그리기만 합니다.
// =============================================================
import { logoKeyOf, BRAND_COLOR } from '../ui/logos/index.jsx'
import { customerKey } from '../data/customerZones.js'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { SKY } from './nightLights.js'
import { Line, RoundedBox } from '@react-three/drei'
import { CampusLabel, CampusLabelLayout, useCampusDetail } from './CampusLabel.jsx'
import { useAppStore, isStatusActive, EMPTY } from '../store/useAppStore.js'
import { useT, pickName } from '../i18n/useT.js'
import { styleOf } from '../data/statusStyle.js'
import { layoutCampus, campusStateAt } from './layoutCampus.js'
import { fmtMw } from './geo.js'
import Block from './buildings/Block.jsx'
import { Crane, Truck, ReceivingBay, FlowDots, Trees } from './buildings/Infrastructure.jsx'
import GridConnection from './buildings/GridConnection.jsx'
import { campusAppearance } from './campusAppearance.js'
import { campusLandscape } from './campusLandscape.js'
import CampusLandscape from './buildings/CampusLandscape.jsx'
import ZoneCallouts from './ZoneCallouts.jsx'
import { Check, Activity } from 'lucide-react'
import { DryCampusGround } from './buildings/PhotoReferencedCampus.jsx'

export default function SiteView({ site }) {
  const appearance = campusAppearance(site.id)
  const landscape = campusLandscape(site.id)
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const hoverId = useAppStore((s) => s.hoverId)
  const setHover = useAppStore((s) => s.setHover)
  const selectedId = useAppStore((s) => s.selectedBuildingId)
  const selectBuilding = useAppStore((s) => s.selectBuilding)
  const zoneKey = useAppStore((s) => s.selectedZoneKey)
  const selectZone = useAppStore((s) => s.selectZone)
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
  const detail = useCampusDetail(L.side)

  const flowTargets = L.flowTargets.filter((b) => isStatusActive(activeStatuses, b.status)
    && (!zoneKey || customerKey(byId[b.buildingId]?.customer) === zoneKey))

  return (
    <group name={`site-${site.id}`}>
      <CampusLabelLayout />
      {/* 넓은 바닥 (그림자 받기) */}
      <SkyGround radius={L.side * 3} color={landscape?.background ?? appearance?.background ?? '#eceffa'} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.31, 0]} receiveShadow>
        <circleGeometry args={[L.side * 3, 48]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>
      {/* 부지 판 */}
      <RoundedBox args={[L.side, 0.5, L.side]} radius={0.25} position={[0, -0.25, 0]} receiveShadow>
        <meshStandardMaterial color={landscape?.ground ?? appearance?.ground ?? '#e5e5dd'} roughness={0.95} />
      </RoundedBox>
      {/* 도로 */}
      <mesh position={[0, 0.01, L.road.z]} receiveShadow>
        <boxGeometry args={[L.side + 14, 0.04, L.road.depth]} />
        <meshStandardMaterial color={landscape?.road ?? appearance?.road ?? '#8997a9'} roughness={1} />
      </mesh>
      {/* 도로 중앙 점선 */}
      {Array.from({ length: Math.floor((L.side + 14) / 2.4) }, (_, i) => (
        <mesh key={i} position={[-half - 7 + 1.2 + i * 2.4, 0.04, L.road.z]}>
          <boxGeometry args={[1.1, 0.01, 0.12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      <GridConnection line={L.powerLine} sub={L.substation} t={t} showLabel={detail || site.buildings.length === 0} />
      {L.powerLine.flowActive && flowTargets.length > 0 && (
        <FlowDots from={[L.substation.x, L.substation.z]} targets={flowTargets} />
      )}

      {/* 블록들 */}
      {L.blocks.map((b) => (
        <Block
          key={b.key}
          block={b}
          appearance={appearance}
          hovered={b.buildingId && hoverId === b.buildingId}
          selected={b.buildingId && selectedId === b.buildingId}
          dimmed={!isStatusActive(activeStatuses, b.status) || !!zoneKey && customerKey(byId[b.buildingId]?.customer) !== zoneKey}
          onHover={(id) => setHover(id, '3d')}
          onLeave={(id) => useAppStore.getState().clearHover(id, '3d')}
          onSelect={(id) => selectBuilding(id)}
        />
      ))}

      {/* 고객 계약 구역: 건물마다 고객 칩을 반복하는 대신, 바닥 테두리 + 고객 배지 한 번 */}
      <CustomerZones blocks={L.blocks} byId={byId} contracts={contracts} side={L.side} selectedKey={zoneKey} onSelect={selectZone} lang={lang} />
      {!detail && !zoneKey && <AreaLabels blocks={L.blocks} byId={byId} t={t} />}

      {!detail && L.blocks.filter(b=>b.isAnchor&&!b.asLot&&b.kind!=='miner_hall'&&['delivered','operating','commissioning'].includes(b.status)&&(!zoneKey||customerKey(byId[b.buildingId]?.customer)===zoneKey)&&selectedId!==b.buildingId&&hoverId!==b.buildingId).map(b=><CampusLabel key={`signal-${b.key}`} position={[b.x,b.h+1,b.z]} priority={55}>
        <button className={`building-signal signal-${b.status}`} onClick={(e)=>{e.stopPropagation();selectBuilding(b.buildingId)}/* 클릭이 3D 로 퍼져 뒤 블록이 선택을 다시 풀지 않게 */} title={`${pickName(byId[b.buildingId],lang)} · ${t.status[b.status]}`}>
          {b.status==='delivered'?<Check size={12}/>:b.status==='operating'?<Activity size={12}/>:<span className="signal-pending"/>}
          {b.status==='delivered'?(lang==='ko'?'인수 완료':'Accepted'):t.status[b.status]}
        </button>
      </CampusLabel>)}

      {/* 건물 라벨 (첫 블록 위) */}
      {L.blocks
        .filter((b) => (!zoneKey || customerKey(byId[b.buildingId]?.customer) === zoneKey) && b.isAnchor && !b.asLot && (b.buildingId ? byId[b.buildingId] && (detail || selectedId === b.buildingId || hoverId === b.buildingId) : L.lotCount > 0))
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
            <CampusLabel key={`lbl-${b.key}`} position={[b.x, b.h + 1.3, b.z]} priority={selected ? 100 : hovered ? 90 : bld ? 60 : 10}>
              <div
                className={`bld-label${hovered ? ' is-hover' : ''}${selected ? ' is-selected' : ''}`}
                onPointerEnter={() => bld && setHover(bld.id)}
                onPointerLeave={() => bld && useAppStore.getState().clearHover(bld.id)}
                // stopPropagation: 라벨 클릭이 3D 쪽으로 퍼져 뒤에 있는 건물 블록도 "클릭"되면 선택이 바로 다시 풀림
                onClick={(e) => { e.stopPropagation(); if (bld) selectBuilding(bld.id) }}
              >
                <div className="row">
                  {b.status==='delivered'?<Check size={13} color={st.color}/>:<span className={`dot${b.status==='operating'?' operating-dot':''}`} style={{ background: st.color }} />}
                  <span className="name">{bld ? pickName(bld, lang) : `${fmtMw(L.remainingMw)}`}</span>
                  {/* 건설중이면 진행률 막대 (마우스를 올리지 않아도 보이게) */}
                  {pct != null && (
                    <span className="prog" aria-label={`${pct}%`}>
                      <i style={{ width: `${pct}%` }} />
                    </span>
                  )}
                </div>
                {!bld && <div className="sub">{lang === 'ko' ? '용도 미발표 전력' : 'Unallocated power'}</div>}
                {bld && selected && (
                  <div className="selected-detail">
                    <div>{t.status[b.status]}{b.status === 'under_construction' && bld.progress != null ? ` · ${Math.round(bld.progress * 100)}%` : ''}</div>
                    <div>{bld.it_mw ? `${bld.it_mw} MW IT` : bld.disclosedMw ? `~${bld.disclosedMw} MW*` : ''}{bld.gross_mw != null ? `${bld.it_mw ? ' / ' : ''}${bld.gross_mw} MW gross` : ''}</div>
                    {bld.gpu && <div>GPU · {bld.gpu.model}{bld.gpu.count ? ` × ${bld.gpu.count.toLocaleString()}` : ''}</div>}
                    {date && <div className="pending">{t.panel.target} · {date}</div>}
                    {bld.dates?.delivered && <div>{t.panel.delivered} · {bld.dates.delivered}</div>}
                  </div>
                )}
              </div>
            </CampusLabel>
          )
        })}

      {/* 블록 1칸이 몇 MW 인지 항상 표시 — 빈 부지(점선 칸)가 얼마만큼의 전력인지 읽을 수 있게 */}
      <CampusLabel position={[-L.side / 2 + 3, 0.5, L.side / 2 - 1]} priority={5}>
        <div className="tag">{lang === 'ko' ? `1칸 = ${L.blockMw}MW` : `1 block = ${L.blockMw}MW`}</div>
      </CampusLabel>
      {L.cranes.filter((c) => !zoneKey || customerKey(byId[c.buildingId]?.customer) === zoneKey).map((c, i) => <Crane key={c.key} x={c.x} z={c.z} seed={i} />)}
      {L.trucks.some(tr => !tr.targetBuildingId) && <ReceivingBay bay={L.receiving} />}
      {L.trucks.map((tr, i) => <Truck key={tr.key} truck={tr} index={i} lang={lang} />)}
      {appearance && <DryCampusGround layout={L} appearance={appearance}/>}
      {landscape ? <CampusLandscape siteId={site.id} layout={layout} profile={landscape}/> : <Trees side={L.side} seed={site.id.length * 7} roadZ={L.road.z} />}
    </group>
  )
}

// ---------- 넓은 바닥 ----------
// 배경과 같은 색이라 지평선이 자연스럽게 사라짐. 밤·노을엔 SkyRig 가 바꾼 배경색(SKY.bg)을 따라감
function SkyGround({ radius, color }) {
  const mat = useRef()
  useFrame(() => { if (mat.current && SKY.bg) mat.current.color.copy(SKY.bg) })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.32, 0]} receiveShadow>
      <circleGeometry args={[radius, 48]} />
      <meshBasicMaterial ref={mat} color={color} toneMapped={false} />
    </mesh>
  )
}

// ---------- 고객 계약 구역 ----------
// 같은 고객(예: Microsoft)의 건물 블록마다 바닥에 고객 색 테두리를 두르고, 고객 배지는 한 번만
// 배지는 투영된 부지 밖에 배치하고, 고객 구역 중심까지 점선으로 연결합니다.
const ZONE_PAD = 0.55 // 블록 둘레에서 테두리까지 여백
function CustomerZones({ blocks, byId, contracts, side, selectedKey, onSelect, lang }) {
  const zones = useMemo(() => {
    const map = new Map()
    for (const b of blocks) {
      if (!b.buildingId || b.asLot) continue // 그 날짜에 아직 없는 칸은 제외 → 구역이 시간에 따라 자람
      const bld = byId[b.buildingId]
      if (!bld?.customer) continue
      const logo = logoKeyOf(bld.customer)
      const key = customerKey(bld.customer)
      const k = contracts.find((c) => c.buildings?.includes(b.buildingId))
      if (!map.has(key)) {
        map.set(key, { key, name: bld.customer, logo, color: k?.color ?? BRAND_COLOR[key] ?? '#55627f', value: k?.value_usd_bn, blocks: [] })
      }
      map.get(key).blocks.push(b)
    }
    return [...map.values()]
  }, [blocks, byId, contracts])

  return <>
    {zones.map(zn=><group key={zn.key}>
      {zn.blocks.map(b=>{
        const x0=b.x-b.w/2-ZONE_PAD,x1=b.x+b.w/2+ZONE_PAD,z0=b.z-b.d/2-ZONE_PAD,z1=b.z+b.d/2+ZONE_PAD
        return <Line key={b.key} points={[[x0,.1,z0],[x1,.1,z0],[x1,.1,z1],[x0,.1,z1],[x0,.1,z0]]} color={zn.color} lineWidth={selectedKey===zn.key?4:2.4} transparent opacity={selectedKey&&selectedKey!==zn.key? .2:1}/>
      })}
    </group>)}
    <ZoneCallouts zones={zones} side={side} selectedKey={selectedKey} onSelect={onSelect} lang={lang}/>
  </>
}

// 계약이 없는 건물도 전체 보기에서는 종류별 구역으로 묶습니다.
function AreaLabels({ blocks, byId, t }) {
  const groups = new Map()
  for (const b of blocks) {
    if (!b.isAnchor || b.asLot || !b.buildingId || byId[b.buildingId]?.customer) continue
    const key = b.status === 'planned' ? 'planned' : b.kind === 'miner_hall' ? 'mining' : b.kind === 'datahall_liquid' ? 'liquid' : 'air'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(b)
  }
  return [...groups].map(([key, list]) => <CampusLabel key={key} priority={30}
    position={[list.reduce((sum, b) => sum + b.x, 0) / list.length, Math.max(...list.map((b) => b.h)) + 1.5, list.reduce((sum, b) => sum + b.z, 0) / list.length]}>
    <div className="tag area-label">{list.every(b=>b.status==='operating')&&<span className="dot operating-dot"/>}{t.campus[key]}{list.every(b=>b.status==='operating')&&<small>{t.status.operating}</small>}</div>
  </CampusLabel>)
}
