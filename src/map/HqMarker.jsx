// =============================================================
// HqMarker — 실제 지도 위 시드니 본사 카드 (A안: 캠퍼스 카드와 같은 양각 모양 + CEO 사진 + 새 발언 수)
// -------------------------------------------------------------
// 누르면 본사 3D 화면으로 (useAppStore.enterHq3D → 본사 건물 + 오른쪽 칸에 CEO·경영진 발언)
// 사진·새 발언 수는 public/data/statements.json 에서 — 카드가 화면에 들어올 때만 받음
//   (지도 첫 화면은 북미라 시드니가 안 보임 → 첫 화면에서 괜히 받지 않게)
// 사진을 못 받으면(404·차단) 이름 머리글자 동그라미로, 자료를 못 받으면 배지 없이 카드만
// 자리: 캠퍼스 마커와 같은 경도 펼침(hqLngLat) → 시드니가 번디와 같은 쪽(북미 왼쪽)에 놓임
// =============================================================
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Marker } from 'maplibre-gl'
import { Building2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.js'
import { hqText } from '../i18n/hq.js' // 본사·경영진 발언 문구 (첫 화면 사전과 따로)
import { hqLngLat, onScreenAnyCopy } from './mapData.js'
import { loadStatements, peekStatements } from '../data/loadStatements.js'
import { recentCount } from '../data/promises.js'
import { speakers } from '../data/statementRows.js' // 발언이 있는 사람만 (발언이 없는 공동 CEO 는 뺌)
import { initialsOf } from '../data/format.js'

// 오늘 날짜 'YYYY-MM-DD' — "최근 30일 발언 수" 배지에 씀
const today = () => new Date().toISOString().slice(0, 10)

export default function HqMarker({ map, hq, lang }) {
  const ko = lang === 'ko', h = hqText[ko ? 'ko' : 'en']
  const [element] = useState(() => { const el = document.createElement('div'); el.className = 'campus-map-marker'; return el })
  const [file, setFile] = useState(peekStatements) // 이미 받은 자료가 있으면 바로 씀

  // 지도 마커 하나 (캠퍼스 카드처럼 아래 끝이 본사 자리에 닿게)
  useEffect(() => {
    const marker = new Marker({ element, anchor: 'bottom' }).setLngLat(hqLngLat(hq)).addTo(map)
    return () => marker.remove()
  }, [map, hq, element])

  // 자료 받기: 카드가 화면 안에 들어왔을 때 (지도를 움직일 때마다 확인, 받으면 그만)
  useEffect(() => {
    if (file) return undefined
    let alive = true
    // 화면 안인가: 경도 ±360° 사본까지 봄 (지도가 비행 뒤 중심 경도를 접으므로 — mapData.onScreenAnyCopy)
    const visible = () => { const c = map.getCanvas(); return onScreenAnyCopy((ll) => map.project(ll), hqLngLat(hq), c.clientWidth, c.clientHeight) }
    const fetchNow = () => loadStatements().then((f) => { if (alive && f) setFile(f) })
    const check = () => { if (visible()) { map.off('moveend', check); fetchNow() } }
    map.on('moveend', check)
    check()
    return () => { alive = false; map.off('moveend', check) }
  }, [map, hq, file])

  const people = file ? speakers(file) : [null] // 발언이 있는 사람만 · 자료 전에는 빈 동그라미 하나
  const count = file ? recentCount(file.statements, today()) : 0
  const city = ko ? hq.city_ko : hq.city_en
  return createPortal(
    <button className="map-campus-card is-hq" style={{ '--marker-color': '#0b344f' }}
      aria-label={h.open} title={h.open}
      onClick={(e) => { e.stopPropagation(); useAppStore.getState().enterHq3D() }}>
      <span className="map-marker-icon"><Building2 size={16} aria-hidden="true" /></span>
      <span className="map-marker-copy"><b>{h.title}</b><span>{file ? h.sub.replace('{city}', city).replace('{n}', file.statements.length) : city}</span></span>
      <span className="hq-faces" aria-hidden="true">{people.map((p, i) => <Face key={p?.id ?? i} person={p} />)}</span>
      {count > 0 && <span className="hq-new">{h.newCount.replace('{n}', count)}</span>}
      <span className="map-marker-stem" />
    </button>, element)
}

// 사진 동그라미 하나: 사진을 못 받으면 머리글자, 자료 전(person 없음)이면 빈 동그라미
function Face({ person }) {
  const [broken, setBroken] = useState(false)
  if (!person) return <i className="hq-face" />
  if (broken) return <i className="hq-face is-initials">{initialsOf(person.name)}</i>
  return <img className="hq-face" src={person.photo} alt="" loading="lazy" onError={() => setBroken(true)} />
}
