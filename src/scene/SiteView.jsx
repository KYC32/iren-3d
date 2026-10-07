// =============================================================
// SiteView — 선택한 사이트의 아이소메트릭 캠퍼스
// layoutCampus() 가 계산한 좌표를 받아 그리기만 합니다.
// =============================================================
import { useMemo } from 'react'
import { Html, RoundedBox } from '@react-three/drei'
import { useAppStore, isStatusActive, EMPTY } from '../store/useAppStore.js'
import { useT, pickName } from '../i18n/useT.js'
import { styleOf, PENDING_COLOR } from '../data/statusStyle.js'
import { layoutCampus, campusStateAt } from './layoutCampus.js'
import { fmtMw } from './geo.js'
import Block from './buildings/Block.jsx'
import { Substation, PowerLine, Crane, Truck, FlowDots, Trees } from './buildings/Infrastructure.jsx'

export default function SiteView({ site }) {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const hoverId = useAppStore((s) => s.hoverId)
  const setHover = useAppStore((s) => s.setHover)
  const activeStatuses = useAppStore((s) => s.activeStatuses)

  const month = useAppStore((s) => s.month)
  const companies = useAppStore((s) => s.data?.companies ?? EMPTY)
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
          dimmed={!isStatusActive(activeStatuses, b.status)}
          onHover={setHover}
          onLeave={() => setHover(null)}
        />
      ))}

      {/* 건물 라벨 (첫 블록 위) */}
      {L.blocks
        .filter((b) => b.isAnchor && !b.asLot && (b.buildingId ? byId[b.buildingId] : L.lotCount > 0))
        .map((b) => {
          const bld = b.buildingId ? byId[b.buildingId] : null
          const st = styleOf(b.status)
          const hovered = bld && hoverId === bld.id
          const date = bld?.dates?.target ?? bld?.dates?.end
          return (
            <Html key={`lbl-${b.key}`} position={[b.x, b.h + 1.3, b.z]} center zIndexRange={hovered ? [40, 30] : [12, 0]}>
              <div
                className={`bld-label${hovered ? ' is-hover' : ''}`}
                onPointerEnter={() => bld && setHover(bld.id)}
                onPointerLeave={() => setHover(null)}
              >
                <div className="row">
                  <span className="dot" style={{ background: st.color }} />
                  <span className="name">{bld ? pickName(bld, lang) : `${fmtMw(L.remainingMw)}`}</span>
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
                {bld?.customer && (
                  <div className="customer" style={{ borderColor: b.status === 'operating' ? st.color : PENDING_COLOR }}>
                    {bld.customer}
                  </div>
                )}
              </div>
            </Html>
          )
        })}

      {L.blockMw > 75 && (
        <Html position={[-L.side / 2 + 3, 0.5, L.side / 2 - 1]} center zIndexRange={[10, 0]}>
          <div className="tag">{lang === 'ko' ? `1칸 = ${L.blockMw}MW` : `1 block = ${L.blockMw}MW`}</div>
        </Html>
      )}
      {L.cranes.map((c, i) => <Crane key={c.key} x={c.x} z={c.z} seed={i} />)}
      {L.trucks.map((tr, i) => <Truck key={tr.key} truck={tr} index={i} lang={lang} />)}
      <Trees side={L.side} seed={site.id.length * 7 + site.grid_mw} roadZ={L.road.z} />
    </group>
  )
}
