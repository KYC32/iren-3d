// =============================================================
// SatelliteLayer — 실제 지도의 '위성 사진' 층 (켜고 끄는 단추 + 캠퍼스 둘레 4km 사진을 지도에 겹침)
// -------------------------------------------------------------
// 캠퍼스 패널 '위성으로 본 변화'의 사진(Sentinel-2, public/data/satellite.json) 중 부지마다 가장 최근 한 장을
//   네 귀퉁이 경도·위도(corners)에 맞춰 지도에 깔아 줌 — 확대하면 시골 부지 둘레가 하얀 빈 지도 대신 실제 땅으로 보임
//   지도 글자(길 이름) 층 아래에 깔아 글자는 그대로 보임 · 기본은 꺼짐(지도를 깔끔하게)
// 위성 사진은 관찰 자료 — 공식 상태를 바꾸지 않음. 출처 'Contains modified Copernicus Sentinel data' 는 지도 아래 출처 표기에 붙음
// MapLayers.jsx 가 지도를 띄운 뒤 따로 불러옴 → 지도 묶음 크기 한도에 들지 않음 (2026-10-28)
// =============================================================
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Satellite } from 'lucide-react'
import { latestPerSite } from '../data/satellite.js'
import { loadSatellite } from '../data/loadSatellite.js'
import './dataCenterLayer.css'   // 단추 모양은 '주변 데이터센터'와 같게

export default function SatelliteLayer({ map, lang }) {
  const ko = lang === 'ko'
  const [on, setOn] = useState(false)
  const [state, setState] = useState('idle')   // idle | loading | ready | error
  const [ids, setIds] = useState([])           // 만든 층 id (켜고 끌 때 씀)
  // 단추 자리: 지도 오른쪽 아래 조종 칸 (데이터센터 단추와 같은 줄)
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

  // 처음 켤 때 목록을 받아 부지마다 이미지 소스·층을 만듦 (다시 켜면 보이기만 바꿈)
  useEffect(() => {
    if (!on || state !== 'idle') return
    setState('loading')
    loadSatellite().then((man) => {
      if (!man || !map.getStyle()) { setState('error'); return }
      // 지도 글자 층 바로 아래에 깔기 (글자가 사진에 덮이지 않게)
      const before = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
      const made = []
      for (const { site, img } of latestPerSite(man)) {
        const id = `sat-${site}`
        map.addSource(id, { type: 'image', url: new URL(img.src, window.location.href).href, coordinates: img.corners })
        map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': 0.95, 'raster-fade-duration': 0 } }, before)
        made.push(id)
      }
      // 출처 표기: 이미지 소스는 출처 글을 못 가져서, 빈 점 층 하나에 출처를 달아 지도 아래 출처 표기에 나오게 함
      //   (층이 보일 때만 출처가 나옴 → 위성 층을 끄면 출처도 같이 빠짐)
      map.addSource('sat-attrib', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: man.source.attribution })
      map.addLayer({ id: 'sat-attrib', type: 'circle', source: 'sat-attrib' })
      made.push('sat-attrib')
      setIds(made)
      setState('ready')
    }).catch(() => setState('error'))
  }, [on, state, map])

  // 켜고 끄기: 층이 있으면 보이기만 바꿈
  useEffect(() => {
    if (state !== 'ready') return
    for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }, [on, state, ids, map])

  return createPortal(
    <button type="button" className={`im3-toggle${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => setOn((v) => !v)}
      title={ko ? '캠퍼스 둘레 4km 위성 사진 (Sentinel-2 · 가장 최근 한 장 · 관찰 자료라 공식 상태와 무관)' : 'Satellite image of the 4 km around each campus (Sentinel-2 · latest scene · observation only)'}>
      <Satellite size={13} aria-hidden="true" />{ko ? '위성 사진' : 'Satellite'}
      {state === 'loading' && <small>…</small>}{state === 'error' && <small>{ko ? '불러오기 실패' : 'failed'}</small>}
    </button>, slot)
}
