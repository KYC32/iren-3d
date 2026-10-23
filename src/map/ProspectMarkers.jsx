// =============================================================
// ProspectMarkers — 지도 위 '?' 표: 회사가 발표하지 않았지만 공개 자료에 흔적이 있는 지역 (예: 앨버타)
// -------------------------------------------------------------
// 부지가 아니라서 캠퍼스 목록·합계·순위·3D 에는 없음. 캠퍼스 카드보다 작은 점선 표 "? 앨버타"로만 보임
//   (작게 만든 까닭: 북미 첫 화면에서 옆의 '캐나다 2개 캠퍼스' 묶음 카드와 겹치지 않게)
// 누르면 정황 목록(날짜 · 한 줄 · 출처)이 열림 — 맨 위에 "회사 발표 없음" 안내
//   표가 화면 위쪽에 있으면 목록을 아래로 엶 (위로 열면 상단 막대에 가려짐)
// 타임라인 날짜까지 공개된 정황만 보임 (prospects.js 의 prospectsAt)
// =============================================================
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Marker } from 'maplibre-gl'
import { X, ArrowUpRight } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.js'
import { mapLongitude } from './mapData.js'
import { prospectsAt } from './prospects.js'
import './prospects.css'

const POP_ROOM = 380   // 표 위에 이만큼(px) 자리가 없으면 목록을 아래로 엶

export default function ProspectMarkers({ map, prospects, lang }) {
  const month = useAppStore((s) => s.month)
  return prospectsAt(prospects, month).map((p) => <ProspectMarker key={p.id} map={map} prospect={p} lang={lang} />)
}

function ProspectMarker({ map, prospect: p, lang }) {
  const ko = lang === 'ko'
  const [element] = useState(() => { const el = document.createElement('div'); el.className = 'prospect-map-marker'; return el })
  const [open, setOpen] = useState(false)
  const [below, setBelow] = useState(false)   // 목록을 표 아래로 열지

  // 지도 마커 하나 (아래 끝 점이 그 자리에 닿게, 경도는 캠퍼스 카드와 같은 펼침)
  useEffect(() => {
    const marker = new Marker({ element, anchor: 'bottom' }).setLngLat([mapLongitude(p.coord.lng), p.coord.lat]).addTo(map)
    return () => marker.remove()
  }, [map, element, p.coord.lng, p.coord.lat])

  // 목록이 열려 있으면: 다른 마커보다 위로, 바깥을 누르거나 Esc 를 누르면 닫음
  useEffect(() => {
    element.classList.toggle('is-open', open)
    if (!open) return undefined
    const close = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !element.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [open, element])

  const toggle = (e) => {
    e.stopPropagation()   // 클릭이 지도까지 퍼지면 지도가 선택을 풀거나 움직임
    setBelow(element.getBoundingClientRect().top < POP_ROOM)
    setOpen((v) => !v)
  }
  const name = ko ? p.name_ko : p.name
  const sub = ko ? `회사 발표 없음 · 정황 ${p.signals.length}건` : `Not announced · ${p.signals.length} signals`
  return createPortal(<>
    {open && (
      <div className={`prospect-pop${below ? ' is-below' : ''}`} role="dialog" aria-label={name} onClick={(e) => e.stopPropagation()}>
        <header>
          <b><span className="prospect-q" aria-hidden="true">?</span>{name} · {ko ? '미확인 정황' : 'unconfirmed signals'}</b>
          <button type="button" className="prospect-close" onClick={() => setOpen(false)} aria-label={ko ? '닫기' : 'Close'}><X size={13} aria-hidden="true" /></button>
        </header>
        <p className="prospect-note">{ko ? p.summary_ko : p.summary_en}</p>
        <ol className="prospect-signals">
          {p.signals.map((s) => (
            <li key={`${s.date}-${s.source}`}>
              <time dateTime={s.date}>{s.date.replaceAll('-', '.')}</time>
              <span>{ko ? s.ko : s.en}</span>
              <a href={s.source} target="_blank" rel="noreferrer">{ko ? '출처' : 'Source'}<ArrowUpRight size={11} aria-hidden="true" /></a>
            </li>
          ))}
        </ol>
      </div>
    )}
    <button type="button" className="prospect-pin" aria-expanded={open} aria-label={`${name} · ${sub}`} title={`${name} · ${sub}`} onClick={toggle}>
      <span className="prospect-q" aria-hidden="true">?</span>
      <b>{name}</b>
      <span className="prospect-stem" aria-hidden="true" />
    </button>
  </>, element)
}
