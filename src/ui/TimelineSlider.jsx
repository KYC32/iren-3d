// =============================================================
// 타임라인 슬라이더 (화면 아래 가운데)
// - 2024-01 ~ 2028-12 를 한 달 단위로 이동, 재생하면 약 12초에 끝까지
// - 기준일(데이터 조사 날짜) 표시, 그 이후 구간은 빗금 = "회사 발표 목표 기준"
// - 키보드 ←/→ 로 한 달씩
// =============================================================
import { useEffect, useMemo, useRef } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { useAppStore, MONTH_MIN, MONTH_MAX } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { monthLabel } from '../data/timeline.js'
import { eventTicks } from '../data/events.js'

const STEP_MS = 200 // 재생 속도: 한 달에 0.2초 → 60개월 = 12초

// 재생 중에는 rAF 로 시간을 재며 한 달씩 넘김
function usePlayer() {
  const playing = useAppStore((s) => s.playing)
  const acc = useRef(0)
  useEffect(() => {
    if (!playing) return
    let raf, last = performance.now()
    const st = useAppStore.getState()
    if (st.month >= MONTH_MAX) st.setMonth(MONTH_MIN) // 끝에서 누르면 처음부터
    const tick = (now) => {
      acc.current += now - last
      last = now
      const s = useAppStore.getState()
      while (acc.current >= STEP_MS) {
        acc.current -= STEP_MS
        if (s.month >= MONTH_MAX) { s.setPlaying(false); return }
        s.setMonth(s.month + 1)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])
}

export default function TimelineSlider() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const month = useAppStore((s) => s.month)
  const asOf = useAppStore((s) => s.asOfMonth)
  const playing = useAppStore((s) => s.playing)
  const setMonth = useAppStore((s) => s.setMonth)
  const setPlaying = useAppStore((s) => s.setPlaying)
  const events = useAppStore((s) => s.events)
  // 사건 눈금: 같은 달 사건을 묶고, 슬라이더 범위 안의 것만
  const ticks = useMemo(
    () => eventTicks(events, asOf ?? 0).filter((k) => k.month >= MONTH_MIN && k.month <= MONTH_MAX),
    [events, asOf],
  )
  usePlayer()

  // 키보드 ←/→ (입력창에 쓰는 중이 아닐 때)
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return
      const st = useAppStore.getState()
      if (e.key === 'ArrowRight') { st.setPlaying(false); st.setMonth(st.month + 1) }
      if (e.key === 'ArrowLeft') { st.setPlaying(false); st.setMonth(st.month - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (month == null) return null
  const span = MONTH_MAX - MONTH_MIN
  const pct = (m) => ((m - MONTH_MIN) / span) * 100
  const future = month > asOf
  const years = [2024, 2025, 2026, 2027, 2028]

  return (
    <div className="timeline panel">
      <button className="tl-play" onClick={() => setPlaying(!playing)} aria-label={playing ? t.timeline.pause : t.timeline.play}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <div className="tl-main">
        <div className="tl-head">
          <span className="tl-date">{monthLabel(month, lang)}</span>
          {future ? <span className="tl-badge future">{t.timeline.future}</span> : month === asOf ? <span className="tl-badge">{t.timeline.asOf}</span> : null}
          {month !== asOf && (
            <button className="tl-reset" onClick={() => { setPlaying(false); setMonth(asOf) }}>
              <RotateCcw size={11} /> {t.timeline.today}
            </button>
          )}
        </div>
        <div className="tl-track" style={{ '--asof': `${pct(asOf)}%` }}>
          <input
            type="range"
            min={MONTH_MIN}
            max={MONTH_MAX}
            step={1}
            value={month}
            onChange={(e) => { setPlaying(false); setMonth(Number(e.target.value)) }}
            aria-label={t.timeline.label}
          />
          <span className="tl-asof" style={{ left: `${pct(asOf)}%` }} />
          {/* 사건 눈금: 회색 = 지난 일, 노랑 = 예정. 마우스를 올리면 내용, 누르면 그 달로 이동 */}
          {ticks.map((k) => (
            <button
              key={k.month}
              className={`tl-tick${k.future ? ' future' : ''}${k.month === month ? ' on' : ''}`}
              style={{ left: `${pct(k.month)}%` }}
              title={`${monthLabel(k.month, lang)}\n` + k.events.map((e) => '· ' + (lang === 'ko' ? e.title_ko : e.title_en)).join('\n')}
              aria-label={monthLabel(k.month, lang)}
              onClick={() => { setPlaying(false); setMonth(k.month) }}
            />
          ))}
        </div>
        <div className="tl-years">
          {years.map((y) => <span key={y} style={{ left: `${pct(y * 12)}%` }}>{y}</span>)}
        </div>
      </div>
    </div>
  )
}
