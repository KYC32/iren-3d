// =============================================================
// RulesLayer — 실제 지도의 '지역 규제' 층 (켜고 끄는 단추 + 미국의 데이터센터 유예·제한 조치 점)
// -------------------------------------------------------------
// 자료: Miklian(2026) "US data center moratoria and local opposition" (CC BY 4.0) — 2017-01 ~ 2026-08 조치 531건
//   public/data/restrictions-map.json (scripts/fetch-restrictions.mjs 가 판 고정 자료에서 만듦)
//   점 색 = 지금 상태: 주황 = 유효 · 회색 = 철회·만료 · 남색 = 영구 규정으로 대체 · 연회색 = 상태 미확인
//   캠퍼스 패널 '지역 규제' 칸의 숫자(카운티·주 건수)가 어디서 나왔는지 지도로 보여 줌 — 제3자 연구 자료, 회사 발표 아님
// 점을 누르면 관할·종류·날짜·상태 카드. 기본은 꺼짐. MapLayers.jsx 가 지도를 띄운 뒤 따로 불러옴 (2026-10-28)
// =============================================================
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Marker } from 'maplibre-gl'
import { Scale, X } from 'lucide-react'
import { RULE_STATUS } from '../data/rulesText.js'
import './dataCenterLayer.css'   // 단추·카드 모양은 '주변 데이터센터'와 같게

const COLOR = { active: '#d9822b', rescinded: '#98a3b0', expired: '#98a3b0', replaced: '#3d5a80', unknown: '#c3cad3' }
const TYPE = { County: ['카운티', 'county'], City: ['시', 'city'], Town: ['타운', 'town'], Township: ['타운십', 'township'], Village: ['마을', 'village'], Tribal: ['부족 정부', 'tribal nation'], Parish: ['패리시(카운티)', 'parish'], 'Utility-authority': ['공공 전력 기관', 'utility authority'], Other: ['기타', 'other'] }

export default function RulesLayer({ map, lang }) {
  const ko = lang === 'ko'
  const [on, setOn] = useState(false)
  const [state, setState] = useState('idle')   // idle | loading | ready | error
  const [picked, setPicked] = useState(null)   // 누른 점 { lngLat, jurisdiction, type, state, date, status }
  const [anchor] = useState(() => {
    const el = document.createElement('div')
    el.className = 'im3-card-anchor'
    el.addEventListener('click', (e) => e.stopPropagation())   // 카드를 눌러도 지도가 클릭으로 받지 않게
    return el
  })
  const [slot] = useState(() => {
    const el = document.createElement('div')
    el.className = 'maplibregl-ctrl im3-ctrl'
    return el
  })
  useEffect(() => {
    const ctrl = { onAdd: () => slot, onRemove: () => slot.remove() }
    map.addControl(ctrl, 'bottom-right')
    return () => map.removeControl(ctrl)
  }, [map, slot])

  // 처음 켤 때 자료를 받아 소스·층을 만듦 (다시 켜면 보이기만 바꿈)
  useEffect(() => {
    if (!on || state !== 'idle') return
    setState('loading')
    fetch('/data/restrictions-map.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((f) => {
      if (!map.getStyle()) return
      map.addSource('rules', {
        type: 'geojson', attribution: 'Miklian 2026 · US data center moratoria · CC BY 4.0',
        data: {
          type: 'FeatureCollection',
          features: f.points.map(([lng, lat, jurisdiction, type, st, date, status]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { jurisdiction, type, state: st, date, status } })),
        },
      })
      map.addLayer({
        id: 'rules-dots', type: 'circle', source: 'rules',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 6, 4.5, 10, 6.5],
          'circle-color': ['match', ['get', 'status'], 'active', COLOR.active, 'replaced', COLOR.replaced, 'unknown', COLOR.unknown, COLOR.rescinded],
          'circle-opacity': 0.85, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1,
        },
      })
      setState('ready')
    }).catch(() => setState('error'))
  }, [on, state, map])

  // 점을 누르면 카드, 빈 곳을 누르면 닫음 · 점 위에서는 손가락 커서
  useEffect(() => {
    if (state !== 'ready') return undefined
    const onClick = (e) => {
      const f = map.getLayer('rules-dots') && map.queryRenderedFeatures(e.point, { layers: ['rules-dots'] })[0]
      setPicked(f ? { lngLat: f.geometry.coordinates, ...f.properties } : null)
    }
    const enter = () => { map.getCanvas().style.cursor = 'pointer' }
    const leave = () => { map.getCanvas().style.cursor = '' }
    map.on('click', onClick)
    map.on('mouseenter', 'rules-dots', enter)
    map.on('mouseleave', 'rules-dots', leave)
    return () => { map.off('click', onClick); map.off('mouseenter', 'rules-dots', enter); map.off('mouseleave', 'rules-dots', leave) }
  }, [state, map])

  useEffect(() => {
    if (state !== 'ready' || !map.getLayer('rules-dots')) return
    map.setLayoutProperty('rules-dots', 'visibility', on ? 'visible' : 'none')
    if (!on) setPicked(null)
  }, [on, state, map])

  useEffect(() => {
    if (!picked) return undefined
    const marker = new Marker({ element: anchor, anchor: 'bottom', offset: [0, -7] }).setLngLat(picked.lngLat).addTo(map)
    return () => marker.remove()
  }, [picked, map, anchor])

  const st = picked && (RULE_STATUS[picked.status] ?? RULE_STATUS.unknown)
  return <>
    {createPortal(
      <button type="button" className={`im3-toggle${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => setOn((v) => !v)}
        title={ko ? '미국의 데이터센터 유예·제한 조치 (Miklian 2026 · CC BY 4.0, 2017-01 ~ 2026-08) — 주황 = 유효, 회색 = 철회·만료 · 회사 발표 아님' : 'US data center moratoria and restrictions (Miklian 2026 · CC BY 4.0, 2017-01 – 2026-08) — orange = in effect, grey = rescinded or expired · not company data'}>
        <Scale size={13} aria-hidden="true" />{ko ? '지역 규제' : 'Local rules'}
        {state === 'loading' && <small>…</small>}{state === 'error' && <small>{ko ? '불러오기 실패' : 'failed'}</small>}
      </button>, slot)}
    {picked && createPortal(
      <div className="im3-card" role="dialog" aria-label={picked.jurisdiction}>
        <button type="button" className="im3-card-close" onClick={() => setPicked(null)} aria-label={ko ? '닫기' : 'Close'}><X size={12} aria-hidden="true" /></button>
        <b>{picked.jurisdiction}</b>
        <span>{TYPE[picked.type]?.[ko ? 0 : 1] ?? picked.type} · {picked.state} · {picked.date}</span>
        <span style={{ color: COLOR[picked.status] === COLOR.unknown ? undefined : COLOR[picked.status] }}>{st[ko ? 0 : 1]}</span>
        <small>{ko ? '데이터센터 유예·제한 · Miklian 2026 · CC BY 4.0' : 'Data center moratorium · Miklian 2026 · CC BY 4.0'}</small>
      </div>, anchor)}
  </>
}
