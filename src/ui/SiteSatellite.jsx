// =============================================================
// SiteSatellite — 캠퍼스 패널 "현황" 탭의 "위성으로 본 변화" 칸 (Sentinel-2, 한 달에 한 장)
//   왼쪽 = 처음 사진, 오른쪽 = 고른 달(기본: 보고 있는 달까지의 마지막 사진). 아래 막대로 달을 옮김
//   사진: public/satellite/<부지>/<YYYY-MM>.jpg · 목록: public/data/satellite.json (fetch_sentinel.py 가 매달 늘림)
// 따로 불러옴(React.lazy) — 코드·목록·사진이 첫 화면에 안 들어감. 사진은 보일 때만 받음(loading="lazy")
// 위성 사진은 관찰 자료 — 공식 상태(건설·가동)를 바꾸지 않음. 코페르니쿠스 출처 표기 필수
// =============================================================
import { useEffect, useState } from 'react'
import { ArrowUpRight, Satellite } from 'lucide-react'
import { satelliteAt } from '../data/satellite.js'
import { fmtWhen } from '../data/events.js'
import './satellite.css'

// 목록은 한 번만 받아 둠 (부지를 바꾸거나 패널을 다시 열어도 다시 받지 않음). 실패하면 칸을 그리지 않음
let pending = null
const load = () => (pending ??= fetch('/data/satellite.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null))

export default function SiteSatellite({ site, month, lang }) {
  const ko = lang === 'ko'
  const [man, setMan] = useState(null)
  const [pick, setPick] = useState(null)   // 고른 사진 순번 (null = 마지막)
  useEffect(() => { let alive = true; load().then((m) => alive && setMan(m)); return () => { alive = false } }, [])
  useEffect(() => setPick(null), [site.id, month])   // 부지·달이 바뀌면 다시 마지막 사진으로
  const list = satelliteAt(man, site.id, month)
  if (list.length < 1) return null
  const i = pick == null ? list.length - 1 : Math.min(pick, list.length - 1)
  const first = list[0], cur = list[i]
  const alt = (img) => `${ko ? site.name_ko ?? site.name : site.name} · ${img.date} Sentinel-2`
  return <section className="sat">
    <h3><Satellite size={13} aria-hidden="true" />{ko ? '위성으로 본 변화 · Sentinel-2' : 'Seen from space · Sentinel-2'}</h3>
    <div className="sat-pair">
      {[first, cur].map((img, k) => <figure key={k}>
        <img src={img.src} alt={alt(img)} width="400" height="400" loading="lazy" decoding="async" />
        <figcaption>{k === 0 ? (ko ? '처음 ' : 'First ') : ''}{img.date.replaceAll('-', '.')}</figcaption>
      </figure>)}
    </div>
    {list.length > 2 && <label className="sat-range">
      <span>{fmtWhen(list[1].month, lang)}</span>
      <input type="range" min="1" max={list.length - 1} step="1" value={Math.max(1, i)} onChange={(e) => setPick(Number(e.target.value))}
        aria-label={ko ? '오른쪽 사진의 달' : 'Month of the right image'} aria-valuetext={fmtWhen(cur.month, lang)} />
      <span>{fmtWhen(list.at(-1).month, lang)}</span>
    </label>}
    <p className="facts-note">
      {ko ? `부지 중심 4km × 4km · 10m 해상도 · 한 달에 구름이 가장 적은 한 장 · 위성 사진은 관찰 자료라 공식 상태를 바꾸지 않음 · ` : `4 km × 4 km around the site · 10 m resolution · least-cloudy scene per month · imagery is observation only and never changes official status · `}
      <a href={man.source.url} target="_blank" rel="noreferrer">{man.source.attribution}<ArrowUpRight size={10} aria-hidden="true" /></a>
    </p>
  </section>
}
