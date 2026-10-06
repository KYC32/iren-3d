// 상태 범례 = 필터 토글. 클릭하면 그 상태만 강조, 다시 클릭하면 해제
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { STATUS_ORDER, styleOf, PENDING_COLOR } from '../data/statusStyle.js'

export default function Legend() {
  const t = useT()
  const active = useAppStore((s) => s.activeStatuses)
  const toggle = useAppStore((s) => s.toggleStatus)
  const clear = useAppStore((s) => s.clearStatuses)
  return (
    <div className="legend panel">
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
