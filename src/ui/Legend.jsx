// 상태 범례 = 필터 토글. 클릭하면 그 상태만 강조, 다시 클릭하면 해제
import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { STATUS_ORDER, styleOf, PENDING_COLOR } from '../data/statusStyle.js'
import { SINGLE_COMPANY } from '../config.js'

// 지역 바로가기: 카메라가 바라볼 위도·경도
const REGIONS = [
  { key: 'na', lat: 40, lng: -100 },
  { key: 'eu', lat: 48, lng: 5 },
  { key: 'asia', lat: 30, lng: 125 },
]

export default function Legend() {
  const t = useT()
  const active = useAppStore((s) => s.activeStatuses)
  const toggle = useAppStore((s) => s.toggleStatus)
  const clear = useAppStore((s) => s.clearStatuses)
  const colorMode = useAppStore((s) => s.colorMode)
  const setColorMode = useAppStore((s) => s.setColorMode)
  // 회사색 범례: 지도에 핀이 있는(대표 사이트가 있는) 회사만
  // 주의: 셀렉터 안에서 filter 하면 매번 새 배열이 나와 zustand 가 "값이 바뀌었다"고 보고 무한 리렌더
  //       → 원본 data 만 구독하고, 거르는 계산은 useMemo 로 (data 가 바뀔 때만 다시 계산)
  const data = useAppStore((s) => s.data)
  const companies = useMemo(
    () => (data?.companies ?? []).filter((c) => data.raw.sites.some((x) => x.primary === c.id)),
    [data],
  )
  const view = useAppStore((s) => s.view)
  const requestRegion = useAppStore((s) => s.requestRegion)
  return (
    <div className="legend panel">
      {view === 'globe' && !SINGLE_COMPANY && (
        <div className="seg small">
          {REGIONS.map((r) => (
            <button key={r.key} onClick={() => requestRegion(r.lat, r.lng)}>{t.regions[r.key]}</button>
          ))}
        </div>
      )}
      {view === 'globe' && !SINGLE_COMPANY && (
        <div className="seg small">
          {['status', 'company'].map((m) => (
            <button key={m} className={colorMode === m ? 'on' : ''} onClick={() => setColorMode(m)}>{t.colorMode[m]}</button>
          ))}
        </div>
      )}
      {view === 'globe' && colorMode === 'company' && (
        <div className="legend-companies">
          {companies.map((c) => (
            <div key={c.id} className="legend-item static">
              <span className="swatch" style={{ background: c.color }} />
              {c.name}
            </div>
          ))}
        </div>
      )}
      <div className="legend-title">
        {t.legend.title}
        {active.size > 0 && <button className="link-btn" onClick={clear}>reset</button>}
      </div>
      {STATUS_ORDER.map((st) => {
        const on = active.size === 0 || active.has(st)
        return (
          <button key={st} className={`legend-item${on ? '' : ' off'}`} onClick={() => toggle(st)}>
            <span className="swatch" style={{ background: styleOf(st).color }} />
            {t.status[st]}
          </button>
        )
      })}
      <div className="legend-item static">
        <span className="swatch" style={{ background: PENDING_COLOR }} />
        {t.panel.deliveries} · {t.panel.energized}
      </div>
      <div className="legend-hint">{t.legend.hint}</div>
    </div>
  )
}
