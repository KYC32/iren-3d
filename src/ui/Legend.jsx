// 상태 범례 = 필터 토글. 클릭하면 그 상태만 강조, 다시 클릭하면 해제
import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { STATUS_ORDER, styleOf, PENDING_COLOR } from '../data/statusStyle.js'
import { SINGLE_COMPANY } from '../config.js'
import { Check, Activity } from 'lucide-react'
import { POWER_FLOW_COLOR } from '../scene/powerFlow.js'
import { AI_LIGHT, MINER_LIGHT } from '../scene/nightColors.js'

// 지역 바로가기: 카메라가 바라볼 위도·경도
const REGIONS = [
  { key: 'na', lat: 40, lng: -100 },
  { key: 'eu', lat: 48, lng: 5 },
  { key: 'asia', lat: 30, lng: 125 },
]

export default function Legend() {
  const t = useT()
  const lang=useAppStore(s=>s.lang)
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
  const skyMode = useAppStore((s) => s.skyMode)
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
            {st==='delivered'?<Check size={13} color={styleOf(st).color}/>:st==='operating'?<Activity size={13} color={styleOf(st).color}/>:<span className="swatch" style={{ background: styleOf(st).color }} />}
            {t.status[st]}
          </button>
        )
      })}
      <div className="legend-item static">
        <span className="swatch" style={{ background: PENDING_COLOR }} />
        {t.panel.deliveries} · {t.panel.energized}
      </div>
      {view==='site'&&<div className="legend-item static" title={lang==='ko'?'송전선의 빛과 변전소 표시등은 확인된 통전을 표현합니다.':'Wire pulses and the substation lamp indicate reported energization.'}>
        <span className="swatch" style={{background:POWER_FLOW_COLOR}}/>{lang==='ko'?'전력 흐름 · 통전 확인':'Power flow · energized'}
      </div>}
      {/* 노을·밤·지금 모드: 창문 불빛의 뜻 (불 켜짐 = 가동, 색 = AI/채굴) */}
      {view==='site'&&skyMode!=='day'&&<div className="legend-item static" title={`${t.sky.hint} · ${t.sky.pending}`}>
        <span className="swatch night-swatch" style={{background:AI_LIGHT}}/><span className="swatch night-swatch" style={{background:MINER_LIGHT}}/>
        {lang==='ko'?'불빛 = 가동 (AI · 채굴)':'Lights = live (AI · mining)'}
      </div>}
      <div className="legend-hint">{t.legend.hint}</div>
      {view==='site'&&<div className="legend-hint">{lang==='ko'?<>팬·전력·트럭은 흐름 연출<br/>건물 상태는 지붕색·배지로 구분</>:<>Fans, power & trucks illustrate flows<br/>Roof colors & badges show status</>}</div>}
    </div>
  )
}

// 보드판에서 고객 계약 연결선 켜기/끄기
