// =============================================================
// SiteView — 선택한 사이트의 아이소메트릭 캠퍼스
// layoutCampus() 가 계산한 좌표를 받아 그리기만 합니다.
// =============================================================
import { logoKeyOf, BRAND_COLOR } from '../ui/logos/index.jsx'
import { customerKey } from '../data/customerZones.js'
import { Suspense, lazy, useCallback, useMemo, useRef } from 'react'
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
import { contentBox } from './campusCamera.js'
import { devMilestones } from './devMilestones.js'
import { fmtWhen } from '../data/events.js'
import './scene.css' // 3D 화면 전용 스타일 (이 화면 코드와 함께 나중에 불러옴)
import { Check, Activity, HardHat, CircleCheck, Clock, CircleDashed, Cpu } from 'lucide-react'
import { figureIcon } from '../ui/figureIcons.js'
import { openFigure } from '../ui/figureState.js'
import { DryCampusGround } from './buildings/PhotoReferencedCampus.jsx'
import { estimateHall, roundNice } from '../data/hallEstimate.js'
import { buildingMwText, areaKeyOf, gpuLabel, gpuLine } from './buildingLabel.js'
// 주차한 차·공사 장비 소품 (Kenney 모형, 그림 표현): 캠퍼스를 연 뒤 따로 불러옴 → 첫 3D 지도 묶음 밖
const CampusProps = lazy(() => import('./buildings/CampusProps.jsx'))

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
  // 퇴역한 건물까지 모든 건물 — 구역 라벨이 "넘겨받는 건물이 채굴동인가"를 볼 때 씀 (그 채굴동이 이미 퇴역했어도)
  const allById = useMemo(() => Object.fromEntries(site._raw.buildings.map((b) => [b.id, b])), [site._raw])
  const half = L.side / 2
  const detail = useCampusDetail(L.side)

  // 선택한 데이터홀의 추정 랙 수 → 그 건물 블록들에 나눠 그림 (Block 이 완성된 홀일 때만 속을 엶)
  // 사람이 건물을 누를 때: 고르고(새 건물이면 카메라가 다가감), 그 건물에 그림이 있으면 그림 대화상자를 엶
  //   같은 건물을 다시 누르면 선택만 풀림 (둘러보기·공유 링크로 고를 때는 그림을 열지 않음)
  const pickBuilding = (id, fly = id !== selectedId) => {
    const fresh = id !== selectedId
    selectBuilding(id, fly)
    if (fresh && byId[id]?.figure) openFigure(byId[id].figure)
  }
  const selectedEst = useMemo(() => (selectedId && byId[selectedId] ? estimateHall(byId[selectedId]) : null), [selectedId, byId])
  const selectedBlockCount = L.blocks.filter((b) => b.buildingId === selectedId).length || 1
  const racksPerBlock = selectedEst ? Math.ceil(selectedEst.racks / selectedBlockCount) : 0

  // 고객 구역을 골랐으면 그 구역 건물의 공사 장비만 (크레인과 같은 규칙)
  const keepZone = useCallback((id) => !zoneKey || customerKey(byId[id]?.customer) === zoneKey, [zoneKey, byId])

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
          racks={b.buildingId && selectedId === b.buildingId ? racksPerBlock : 0}
          dimmed={!isStatusActive(activeStatuses, b.status) || !!zoneKey && customerKey(byId[b.buildingId]?.customer) !== zoneKey}
          onHover={(id) => setHover(id, '3d')}
          onLeave={(id) => useAppStore.getState().clearHover(id, '3d')}
          onSelect={(id) => pickBuilding(id)} // 새 건물이면 카메라가 다가감(+ 그림이 있으면 엶), 같은 건물이면 선택 해제
        />
      ))}

      {/* 고객 계약 구역: 건물마다 고객 칩을 반복하는 대신, 바닥 테두리 + 고객 배지 한 번 */}
      <CustomerZones blocks={L.blocks} byId={byId} contracts={contracts} box={contentBox(L)} selectedKey={zoneKey} onSelect={selectZone} lang={lang} />
      {!detail && !zoneKey && <AreaLabels blocks={L.blocks} byId={byId} allById={allById} t={t} />}

      {/* 개요 화면의 건물 상태 칩: "Horizon 2 · 시운전" 처럼 이름과 상태를 함께 (전엔 상태만 있어 어느 건물인지 몰랐음)
          건설 중 건물도 칩으로 — "지금 어디까지 지어졌나"가 확대하지 않아도 보이게 (겹치면 낮은 우선순위가 비켜남) */}
      {!detail && L.blocks.filter(b=>b.isAnchor&&!b.asLot&&b.kind!=='miner_hall'&&['delivered','operating','commissioning','under_construction'].includes(b.status)&&(!zoneKey||customerKey(byId[b.buildingId]?.customer)===zoneKey)&&selectedId!==b.buildingId&&hoverId!==b.buildingId).map(b=>{const g=gpuLabel(byId[b.buildingId],lang);/* 칩에 쓸 이름과 GPU 표 (이름에 든 모델 글자는 표로 옮김) */return <CampusLabel key={`signal-${b.key}`} position={[b.x,b.h+1,b.z]} priority={b.status==='under_construction'?50:55}>
        <button className={`building-signal signal-${b.status}`} onClick={(e)=>{e.stopPropagation();pickBuilding(b.buildingId, true)}/* 클릭이 3D 로 퍼져 뒤 블록이 선택을 다시 풀지 않게 · 칩을 누르면 그 건물로 */} title={`${pickName(byId[b.buildingId],lang)} · ${t.status[b.status]}`}>
          {b.status==='delivered'?<Check size={12}/>:b.status==='operating'?<Activity size={12}/>:b.status==='under_construction'?<HardHat size={12}/>:<span className="signal-pending"/>}
          <span className="signal-name">{g.name}</span>
          {b.status==='delivered'?(lang==='ko'?'인수 완료':'Accepted'):t.status[b.status]}
          {/* GPU 표 (Horizon = GB300, 스위트워터 1단계 = Vera Rubin, 공랭 홀 = B300 등): 멀리서 보는 기본 화면에서도 보이게 — 가까이 가면 건물 이름표에 같은 표 */}
          {g.tag && <span className="gpu-tag"><Cpu size={11} aria-hidden="true" />{g.tag}</span>}
        </button>
      </CampusLabel>})}

      {/* 건물 라벨 (첫 블록 위) */}
      {L.blocks
        .filter((b) => (!zoneKey || customerKey(byId[b.buildingId]?.customer) === zoneKey) && b.isAnchor && !b.asLot && (b.buildingId ? byId[b.buildingId] && (detail || selectedId === b.buildingId || hoverId === b.buildingId) : L.lotCount > 0))
        .map((b) => {
          const bld = b.buildingId ? byId[b.buildingId] : null
          const g = bld ? gpuLabel(bld, lang) : null   // 이름표에 쓸 이름과 GPU 표 (이름에 든 모델 글자는 표로 옮김)
          const st = styleOf(b.status)
          const hovered = bld && hoverId === bld.id
          const selected = bld && selectedId === bld.id
          const pct = bld && b.status === 'under_construction' && bld.progress != null ? Math.round(bld.progress * 100) : null
          const date = bld?.dates?.target ?? bld?.dates?.end
          // 속을 연 데이터홀: 라벨이 랙을 가리지 않게 뒤쪽 벽 위로 올리고, 자세한 내용은 패널 카드에 맡겨 한 줄로 줄임
          const opened = selected && selectedEst && b.kind !== 'miner_hall' && ['operating', 'delivered', 'commissioning'].includes(b.status)
          // zIndexRange 는 호버와 상관없이 고정: 호버할 때 라벨을 맨 위로 올리면 겹친 두 라벨이
          // 서로 위로 올라오며 마우스 아래 요소가 계속 바뀌는 진동(깜빡임)이 생김
          return (
            <CampusLabel key={`lbl-${b.key}`} position={opened ? [b.x, b.h + 0.5, b.z - b.d / 2] : [b.x, b.h + 1.3, b.z]} priority={selected ? 100 : hovered ? 90 : bld ? 60 : 10}>
              <div
                className={`bld-label${hovered ? ' is-hover' : ''}${selected ? ' is-selected' : ''}${bld ? '' : ' is-lot'}`}
                onPointerEnter={() => bld && setHover(bld.id)}
                onPointerLeave={() => bld && useAppStore.getState().clearHover(bld.id)}
                // stopPropagation: 라벨 클릭이 3D 쪽으로 퍼져 뒤에 있는 건물 블록도 "클릭"되면 선택이 바로 다시 풀림
                onClick={(e) => { e.stopPropagation(); if (bld) pickBuilding(bld.id) }}
              >
                <div className="row">
                  {b.status==='delivered'?<Check size={13} color={st.color}/>:<span className={`dot${b.status==='operating'?' operating-dot':''}`} style={{ background: st.color }} />}
                  {/* 빈 부지 이름표: 남은 MW. 계획만 있는 부지(Redbank)는 확보 전력이 아니라는 걸 함께 적음 */}
                  <span className="name">{bld ? g.name : `${fmtMw(L.remainingMw)}${L.plannedOnly ? (lang === 'ko' ? ' · 계획 · 계통 미확보' : ' · planned · grid not secured') : ''}`}</span>
                  {/* GPU 표 (Horizon = GB300, 스위트워터 1단계 = Vera Rubin, 공랭 홀 = B300 등) — 규칙은 buildingLabel.js 의 gpuLabel */}
                  {g?.tag && <span className="gpu-tag"><Cpu size={11} aria-hidden="true" />{g.tag}</span>}
                  {/* 건설중이면 진행률 막대 (마우스를 올리지 않아도 보이게) */}
                  {pct != null && (
                    <span className="prog" aria-label={`${pct}%`}>
                      <i style={{ width: `${pct}%` }} />
                    </span>
                  )}
                </div>
                {/* 남는 전력 칸의 설명 줄 — 두 줄을 흰 상자 하나로 감쌈(.is-lot, 예전엔 아랫줄이 배경 없이 건물 선과 섞여 흐려 보였음) */}
                {!bld && <div className="sub">{lang === 'ko' ? '용도 미발표 전력' : 'Unallocated power'}</div>}
                {opened && (
                  <div className="selected-detail compact">
                    {bld.figure && <FigureChip name={bld.figure} lang={lang} />}
                    <div>{t.status[b.status]}{bld.it_mw ? ` · ${bld.it_mw} MW IT` : bld.disclosedMw ? ` · ~${bld.disclosedMw} MW*` : ''}</div>
                    <div className="est">≈ GPU {roundNice(selectedEst.gpus).toLocaleString()} · {lang === 'ko' ? '랙' : 'racks'} {roundNice(selectedEst.racks).toLocaleString()} <i>{selectedEst.gpusReported ? (lang === 'ko' ? '랙 추정' : 'racks est.') : (lang === 'ko' ? '추정' : 'est.')}</i></div>
                  </div>
                )}
                {bld && selected && !opened && (
                  <div className="selected-detail">
                    <div>{t.status[b.status]}{b.status === 'under_construction' && bld.progress != null ? ` · ${Math.round(bld.progress * 100)}%` : ''}</div>
                    {/* 용량 한 줄: IT / 전체 전력 (0 은 "모름"이라 뺌 — buildingLabel.js) */}
                    <div>{buildingMwText(bld)}</div>
                    {bld.gpu && <div>{gpuLine(bld, lang)}</div>}
                    {/* MW → GPU·랙 환산 (회사가 GPU 수를 발표하지 않았으면 추정) — 자세한 가정은 오른쪽 패널 */}
                    {selectedEst && !selectedEst.gpusReported && <div className="est">≈ GPU {roundNice(selectedEst.gpus).toLocaleString()} · {lang === 'ko' ? '랙' : 'racks'} {roundNice(selectedEst.racks).toLocaleString()} <i>{lang === 'ko' ? '추정' : 'est.'}</i></div>}
                    {selectedEst && selectedEst.gpusReported && <div className="est">≈ {lang === 'ko' ? '랙' : 'racks'} {roundNice(selectedEst.racks).toLocaleString()} <i>{lang === 'ko' ? '추정' : 'est.'}</i></div>}
                    {date && <div className="pending">{t.panel.target} · {date}</div>}
                    {bld.dates?.delivered && <div>{t.panel.delivered} · {bld.dates.delivered}</div>}
                    {bld.figure && <FigureChip name={bld.figure} lang={lang} />}
                  </div>
                )}
              </div>
            </CampusLabel>
          )
        })}

      {/* 개발 부지(그 날짜에 건물 기록이 없음): 빈 땅 위에 개발 이정표 */}
      {site.buildings.length === 0 && <DevMilestones site={site} month={month} lang={lang} side={L.side} />}
      {/* 블록 1칸이 몇 MW 인지 항상 표시 — 빈 부지(점선 칸)가 얼마만큼의 전력인지 읽을 수 있게 */}
      <CampusLabel position={[-L.side / 2 + 3, 0.5, L.side / 2 - 1]} priority={5}>
        <div className="tag">{lang === 'ko' ? `1칸 = ${L.blockMw}MW` : `1 block = ${L.blockMw}MW`}</div>
      </CampusLabel>
      {L.cranes.filter((c) => !zoneKey || customerKey(byId[c.buildingId]?.customer) === zoneKey).map((c, i) => <Crane key={c.key} x={c.x} z={c.z} seed={i} />)}
      {L.trucks.some(tr => !tr.targetBuildingId) && <ReceivingBay bay={L.receiving} />}
      {L.trucks.map((tr, i) => <Truck key={tr.key} truck={tr} index={i} lang={lang} />)}
      <Suspense fallback={null}><CampusProps layout={layout} state={S} keep={keepZone} /></Suspense>
      {appearance && <DryCampusGround layout={L} appearance={appearance}/>}
      {landscape ? <CampusLandscape siteId={site.id} layout={layout} profile={landscape}/> : <Trees side={L.side} seed={site.id.length * 7} roadZ={L.road.z} />}
    </group>
  )
}

// ---------- 개발 이정표 ----------
// 건물이 아직 없는 개발 부지: 빈 땅만으로는 "언제 돈이 되나"를 읽을 수 없어 단계별 진행을 카드로
//   ✓ 완료(발표·확인) · 시계 = 회사 목표 · 점선 원 = 미발표 (devMilestones.js)
const STEP_ICON = { done: CircleCheck, target: Clock, unknown: CircleDashed }
function DevMilestones({ site, month, lang, side }) {
  const ko = lang === 'ko'
  const NAME = ko ? { secured: '부지·전력 확보', energized: '통전', construction: '착공', operating: '가동' }
    : { secured: 'Land & power secured', energized: 'Energization', construction: 'Construction', operating: 'Go-live' }
  const when = (s) => s.state === 'unknown' ? (ko ? '미발표' : 'Not announced') : s.state === 'target' ? `${ko ? '목표' : 'Target'} ${fmtWhen(s.when, lang)}` : fmtWhen(s.when, lang)
  return (
    // 부지 가운데: 카메라가 건물 영역을 화면 가운데에 맞추므로 휴대폰에서도 아래 패널에 가리지 않음
    <CampusLabel position={[0, 1.2, 0]} priority={45}>
      <div className="dev-steps" role="group" aria-label={ko ? '개발 단계' : 'Development milestones'}>
        <b>{ko ? '개발 단계' : 'Development milestones'}</b>
        <ol>{devMilestones(site._raw, month).map((s) => {
          const Icon = STEP_ICON[s.state]
          return <li key={s.key} className={`is-${s.state}`}><Icon size={13} aria-hidden="true" /><span>{NAME[s.key]}</span><em>{when(s)}</em></li>
        })}</ol>
      </div>
    </CampusLabel>
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
function CustomerZones({ blocks, byId, contracts, box, selectedKey, onSelect, lang }) {
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
    <ZoneCallouts zones={zones} box={box} selectedKey={selectedKey} onSelect={onSelect} lang={lang}/>
  </>
}

// 계약이 없는 건물도 전체 보기에서는 종류별 구역으로 묶습니다 (종류 규칙은 buildingLabel.js 의 areaKeyOf).
//   계획 중인 건물이 채굴동 전력을 넘겨받으면 "AI 전환 예정" (채굴 → AI — 커낼플랫츠 등),
//   그 밖의 계획 건물은 "확장 예정 부지"
//   라벨 자리는 무리의 평균점이 아니라 평균에 가장 가까운 "그 무리의 블록" 위
//   (흩어진 블록의 평균점은 다른 건물 위로 떨어져, 차일드레스에선 Horizon 건물 위에 "확장 예정 부지"가 얹혔음)
function AreaLabels({ blocks, byId, allById, t }) {
  const groups = new Map()
  for (const b of blocks) {
    if (!b.isAnchor || b.asLot || !b.buildingId || byId[b.buildingId]?.customer) continue
    const key = areaKeyOf(b, byId, allById)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(b)
  }
  return [...groups].map(([key, list]) => {
    const cx = list.reduce((sum, b) => sum + b.x, 0) / list.length, cz = list.reduce((sum, b) => sum + b.z, 0) / list.length
    const at = list.reduce((best, b) => (Math.hypot(b.x - cx, b.z - cz) < Math.hypot(best.x - cx, best.z - cz) ? b : best))
    return <CampusLabel key={key} priority={30} position={[at.x, Math.max(...list.map((b) => b.h)) + 1.5, at.z]}>
      <div className="tag area-label">{list.every(b=>b.status==='operating')&&<span className="dot operating-dot"/>}{t.campus[key]}{list.every(b=>b.status==='operating')&&<small>{t.status.operating}</small>}</div>
    </CampusLabel>
  })
}

// 고른 건물 라벨 안의 "안 자세히 보기" 단추: 그 건물의 그림(전력 경로·홀 안·냉각수 길)을 다시 엶
function FigureChip({ name, lang }) {
  const Icon = figureIcon(name)   // 그림 종류에 맞는 아이콘 (전력 = 플러그, 액체냉각 = 물방울)
  return (
    <button type="button" className="bld-figure" onClick={(e) => { e.stopPropagation(); openFigure(name) }}>
      <Icon size={12} aria-hidden="true" />{lang === 'ko' ? '안 자세히 보기' : 'Look inside'}
    </button>
  )
}
