// =============================================================
// DataCenterLayer — 실제 지도의 '주변 데이터센터' 층 (켜고 끄는 단추 + 회색 점)
// -------------------------------------------------------------
// 미국의 기존 데이터센터 약 1,470곳 (IM3 Open Source Data Center Atlas, ODbL · © OpenStreetMap contributors)
//   IREN 캠퍼스 주변에 누가 이미 지었는지 보는 참고 층 — IREN 자료가 아님, 기본은 꺼짐(지도를 깔끔하게)
// 단추를 처음 켤 때만 자료(public/data/im3-datacenters.json, 압축 약 25KB)를 받음
// 이 파일은 GeoMap 이 지도를 다 띄운 뒤 따로 불러옴(React.lazy) → 지도 묶음 크기 한도에 들지 않음
// 점을 누르면 그 자리에 이름·운영사 카드. 출처는 지도 오른쪽 아래 출처 표기에 자동으로 붙음(소스 attribution)
//   카드는 지도 마커(Marker)에 얹음 — maplibre 말풍선(Popup)을 쓰면 그 코드가 지도 묶음에 새로 들어가 약 1.7 KiB 커짐
// =============================================================
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Marker } from 'maplibre-gl'
import { Server, X } from 'lucide-react'
import './dataCenterLayer.css'

const KIND = { campus: ['캠퍼스', 'campus'], building: ['건물', 'building'], point: ['위치', 'site'] }

export default function DataCenterLayer({ map, lang }) {
  const ko = lang === 'ko'
  const [on, setOn] = useState(false)
  const [state, setState] = useState('idle')   // idle | loading | ready | error
  const [picked, setPicked] = useState(null)   // 누른 점 { lngLat, name, operator, type }
  // 카드를 얹을 마커 자리 (카드를 눌러도 지도가 클릭으로 받지 않게 여기서 막음)
  const [anchor] = useState(() => {
    const el = document.createElement('div')
    el.className = 'im3-card-anchor'
    el.addEventListener('click', (e) => e.stopPropagation())
    return el
  })

  // 단추 자리: 지도 오른쪽 아래 조종 칸(확대·축소 단추 위) — 화면 크기가 바뀌어도 출처 표기와 겹치지 않음
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
    fetch('/data/im3-datacenters.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((f) => {
      if (!map.getStyle()) return
      map.addSource('im3', {
        type: 'geojson', attribution: f.source.attribution,
        data: {
          type: 'FeatureCollection',
          // 경도는 그대로 씀: 미국 본토(−123° ~ −66°)는 캠퍼스 카드의 경도 펼침(mapLongitude, −340° ~ 20°) 안이라 값이 같음
          //   (mapData.js 를 여기서 불러오면 첫 화면 묶음이 쪼개져 0.5 KiB 커짐)
          features: f.points.map(([lng, lat, name, operator, type]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { name, operator, type } })),
        },
      })
      map.addLayer({
        id: 'im3-dots', type: 'circle', source: 'im3',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2, 6, 3.2, 10, 5],
          'circle-color': '#6b7a8c', 'circle-opacity': 0.75, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 0.3, 8, 1],
        },
      })
      setState('ready')
    }).catch(() => setState('error'))
  }, [on, state, map])

  // 층이 생긴 뒤: 점을 누르면 카드를 열고, 빈 곳을 누르면 닫음 · 점 위에서는 손가락 모양 커서
  useEffect(() => {
    if (state !== 'ready') return undefined
    const onClick = (e) => {
      const f = map.getLayer('im3-dots') && map.queryRenderedFeatures(e.point, { layers: ['im3-dots'] })[0]
      setPicked(f ? { lngLat: f.geometry.coordinates, ...f.properties } : null)
    }
    const enter = () => { map.getCanvas().style.cursor = 'pointer' }
    const leave = () => { map.getCanvas().style.cursor = '' }
    map.on('click', onClick)
    map.on('mouseenter', 'im3-dots', enter)
    map.on('mouseleave', 'im3-dots', leave)
    return () => { map.off('click', onClick); map.off('mouseenter', 'im3-dots', enter); map.off('mouseleave', 'im3-dots', leave) }
  }, [state, map])

  // 켜고 끄기: 층이 있으면 보이기만 바꿈 (끄면 카드도 닫음)
  useEffect(() => {
    if (state !== 'ready' || !map.getLayer('im3-dots')) return
    map.setLayoutProperty('im3-dots', 'visibility', on ? 'visible' : 'none')
    if (!on) setPicked(null)
  }, [on, state, map])

  // 고른 점 자리에 카드 마커를 붙임 (아래 끝이 점 바로 위에 오게)
  useEffect(() => {
    if (!picked) return undefined
    const marker = new Marker({ element: anchor, anchor: 'bottom', offset: [0, -6] }).setLngLat(picked.lngLat).addTo(map)
    return () => marker.remove()
  }, [picked, map, anchor])

  return <>
    {createPortal(
      <button type="button" className={`im3-toggle${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => setOn((v) => !v)}
        title={ko ? '미국의 기존 데이터센터 위치 (IM3 Atlas · © OpenStreetMap contributors · ODbL) — IREN 자료 아님' : 'Existing US data centers (IM3 Atlas · © OpenStreetMap contributors · ODbL) — not IREN data'}>
        <Server size={13} aria-hidden="true" />{ko ? '주변 데이터센터' : 'Nearby data centers'}
        {state === 'loading' && <small>…</small>}{state === 'error' && <small>{ko ? '불러오기 실패' : 'failed'}</small>}
      </button>, slot)}
    {picked && createPortal(
      <div className="im3-card" role="dialog" aria-label={picked.name || (ko ? '데이터센터' : 'Data center')}>
        <button type="button" className="im3-card-close" onClick={() => setPicked(null)} aria-label={ko ? '닫기' : 'Close'}><X size={12} aria-hidden="true" /></button>
        <b>{picked.name || (ko ? '이름 없는 데이터센터' : 'Unnamed data center')}</b>
        {picked.operator && <span>{picked.operator}</span>}
        {/* 전체 출처(© OpenStreetMap contributors)는 지도 아래 출처 표기에 있음 → 카드에는 짧게 */}
        <small>{KIND[picked.type]?.[ko ? 0 : 1] ?? picked.type} · IM3 Atlas · ODbL</small>
      </div>, anchor)}
  </>
}
