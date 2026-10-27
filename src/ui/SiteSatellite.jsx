// =============================================================
// SiteSatellite — 캠퍼스 패널 "현황" 탭의 "위성으로 본 변화" 칸 (Sentinel-2, 한 달에 한 장)
//   왼쪽 = 처음 사진, 오른쪽 = 고른 달(기본: 보고 있는 달까지의 마지막 사진). 아래 막대로 달을 옮김
//   ▶ 단추 = 고른 달부터 한 달씩 자동으로 넘김 (마지막 사진에서 멈춤) · '크게' = 같은 두 장을 큰 대화상자로 (2026-10-28)
//   사진: public/satellite/<부지>/<YYYY-MM>.jpg · 목록: public/data/satellite.json (fetch_sentinel.py 가 매달 늘림)
// 따로 불러옴(React.lazy) — 코드·목록·사진이 첫 화면에 안 들어감. 사진은 보일 때만 받음(loading="lazy")
// 위성 사진은 관찰 자료 — 공식 상태(건설·가동)를 바꾸지 않음. 코페르니쿠스 출처 표기 필수
// =============================================================
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Maximize2, Pause, Play, Satellite, X } from 'lucide-react'
import { satelliteAt, nextFrame } from '../data/satellite.js'
import { loadSatellite as load } from '../data/loadSatellite.js'   // 목록은 한 번만 받음 (현황 페이지와 함께 씀)
import { fmtWhen } from '../data/events.js'
import './satellite.css'

const STEP_MS = 900   // 자동 넘김: 한 달에 0.9초 (사진을 비교해 볼 틈)

export default function SiteSatellite({ site, month, lang }) {
  const ko = lang === 'ko'
  const [man, setMan] = useState(null)
  const [pick, setPick] = useState(null)   // 고른 사진 순번 (null = 마지막)
  const [playing, setPlaying] = useState(false)
  const [big, setBig] = useState(false)    // 크게 보기 대화상자
  const dialog = useRef(null)
  useEffect(() => { let alive = true; load().then((m) => alive && setMan(m)); return () => { alive = false } }, [])
  useEffect(() => { setPick(null); setPlaying(false) }, [site.id, month])   // 부지·달이 바뀌면 다시 마지막 사진으로
  const list = satelliteAt(man, site.id, month)
  const n = list.length
  const i = pick == null ? n - 1 : Math.min(pick, n - 1)
  // 자동 넘김: STEP_MS 마다 다음 달, 마지막 사진이면 멈춤
  //   사람이 누른 동작이라 '움직임 줄이기' 설정이어도 함 (사진만 바뀌고 미끄러지는 효과는 없음)
  useEffect(() => {
    if (!playing) return
    const id = setTimeout(() => { const nx = nextFrame(i, n - 1); if (nx == null) setPlaying(false); else setPick(nx) }, STEP_MS)
    return () => clearTimeout(id)
  }, [playing, i, n])
  // 크게 보기: <dialog> showModal (Esc·바깥 누르면 닫힘). 열 때 모든 달 사진을 미리 받아 자동 넘김이 끊기지 않게
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (big && !d.open) { d.showModal(); for (const img of list) { const im = new Image(); im.src = img.src } }
    if (!big && d.open) d.close()
  }, [big]) // eslint-disable-line react-hooks/exhaustive-deps -- 열 때 한 번만 미리 받음
  if (n < 1) return null
  const first = list[0], cur = list[i]
  const name = ko ? site.name_ko ?? site.name : site.name
  const alt = (img) => `${name} · ${img.date} Sentinel-2`
  // ▶: 마지막 사진에서 누르면 처음 다음 달부터 다시
  const togglePlay = () => { if (playing) return setPlaying(false); if (i >= n - 1) setPick(1); setPlaying(true) }
  const pair = (isBig) => (
    <div className={`sat-pair${isBig ? ' sat-pair-big' : ''}`}>
      {[first, cur].map((img, k) => <figure key={k}>
        {isBig
          ? <img src={img.src} alt={alt(img)} width="400" height="400" decoding="async" />
          : <button type="button" className="sat-img-btn" onClick={() => setBig(true)} aria-label={ko ? `${alt(img)} — 크게 보기` : `${alt(img)} — enlarge`}>
              <img src={img.src} alt="" width="400" height="400" loading="lazy" decoding="async" />
            </button>}
        <figcaption>{k === 0 ? (ko ? '처음 ' : 'First ') : ''}{img.date.replaceAll('-', '.')}</figcaption>
      </figure>)}
    </div>
  )
  const controls = n > 2 && (
    <div className="sat-controls">
      <button type="button" className="sat-play" onClick={togglePlay} aria-pressed={playing}
        aria-label={playing ? (ko ? '자동 넘김 멈춤' : 'Pause') : (ko ? '달마다 자동으로 넘겨 보기' : 'Play through the months')}
        title={playing ? (ko ? '멈춤' : 'Pause') : (ko ? '달마다 자동으로 넘겨 보기' : 'Play through the months')}>
        {playing ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
      </button>
      <label className="sat-range">
        <span>{fmtWhen(list[1].month, lang)}</span>
        <input type="range" min="1" max={n - 1} step="1" value={Math.max(1, i)} onChange={(e) => { setPlaying(false); setPick(Number(e.target.value)) }}
          aria-label={ko ? '오른쪽 사진의 달' : 'Month of the right image'} aria-valuetext={fmtWhen(cur.month, lang)} />
        <span>{fmtWhen(list.at(-1).month, lang)}</span>
      </label>
    </div>
  )
  const note = (
    <p className="facts-note">
      {ko ? `부지 중심 4km × 4km · 10m 해상도 · 한 달에 구름·눈이 가장 적은 한 장 · 위성 사진은 관찰 자료라 공식 상태를 바꾸지 않음 · ` : `4 km × 4 km around the site · 10 m resolution · clearest scene per month (least cloud and snow) · imagery is observation only and never changes official status · `}
      <a href={man.source.url} target="_blank" rel="noreferrer">{man.source.attribution}<ArrowUpRight size={10} aria-hidden="true" /></a>
    </p>
  )
  return <section className="sat">
    <h3>
      <Satellite size={13} aria-hidden="true" />{ko ? '위성으로 본 변화 · Sentinel-2' : 'Seen from space · Sentinel-2'}
      <button type="button" className="sat-zoom" onClick={() => setBig(true)}><Maximize2 size={11} aria-hidden="true" />{ko ? '크게' : 'Enlarge'}</button>
    </h3>
    {pair(false)}
    {controls}
    {note}
    {/* 크게 보기 — 같은 두 장·같은 달 막대·같은 ▶ (상태를 함께 씀) */}
    <dialog ref={dialog} className="sat-dialog" aria-labelledby={`sat-title-${site.id}`}
      onCancel={() => setBig(false)} onClose={() => setBig(false)}
      onClick={(e) => { if (e.target === e.currentTarget) setBig(false) }}>
      <div className="sat-dialog-body">
        <div className="sat-dialog-head">
          <b id={`sat-title-${site.id}`}>{name} · {ko ? '위성으로 본 변화' : 'Seen from space'}</b>
          <button type="button" onClick={() => setBig(false)} aria-label={ko ? '닫기' : 'Close'}><X size={16} aria-hidden="true" /></button>
        </div>
        {big && pair(true)}
        {controls}
        {note}
      </div>
    </dialog>
  </section>
}
