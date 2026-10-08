import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Marker } from 'maplibre-gl'
import { Building2, Layers3, ChevronRight, Box } from 'lucide-react'
import { styleOf } from '../data/statusStyle.js'
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { pickName } from '../i18n/useT.js'

const countryNames = { US: ['미국', 'United States'], CA: ['캐나다', 'Canada'], AU: ['호주', 'Australia'], ES: ['스페인', 'Spain'] }
const capacity = mw => mw >= 1000 ? `${Number((mw / 1000).toFixed(2))} GW` : `${mw.toLocaleString()} MW`

// HTML markers keep the map light while making each location keyboard-accessible.
// The source still handles geographic clustering; features are deduplicated across tiles.
export default function CampusMarkers({ map, data, lang, selectedId, onGroup }) {
  const [entries, setEntries] = useState([])
  const t = useT(), ko = lang === 'ko'
  useEffect(() => {
    let alive = true, signature = '', lastCheck = 0
    const cache = new Map(), sites = new Map(data.sites.map(s => [s.id, s]))
    const publish = () => { if (alive) setEntries([...cache.values()].filter(e => e.visible)) }
    const sync = (force = false) => {
      if (!alive || !map.getSource('campuses') || !map.isSourceLoaded('campuses')) return
      const now = performance.now()
      if (!force && now - lastCheck < 100) return
      lastCheck = now
      const visible = new Map(), centerLng = map.getCenter().lng
      const canvas = map.getCanvas(), width = canvas.clientWidth, height = canvas.clientHeight
      for (const f of map.querySourceFeatures('campuses')) {
        const p = f.properties, isCluster = Boolean(p.cluster)
        const key = isCluster ? `cluster-${p.cluster_id}` : `site-${p.id}`
        if (visible.has(key)) continue
        const [lng, lat] = f.geometry.coordinates
        const coord = [lng + 360 * Math.round((centerLng - lng) / 360), lat]
        const point = map.project(coord)
        if (point.x < -80 || point.x > width + 80 || point.y < 0 || point.y > height + 100) continue
        let entry = cache.get(key)
        if (!entry) {
          const element = document.createElement('div')
          element.className = 'campus-map-marker'
          const marker = new Marker({ element, anchor: 'bottom', offset: [0, 0] }).setLngLat(coord)
          entry = { key, marker, element, coord, isCluster, count: p.point_count, members: isCluster ? [] : [sites.get(p.id)].filter(Boolean), visible: false }
          cache.set(key, entry)
          if (isCluster) map.getSource('campuses').getClusterLeaves(p.cluster_id, data.sites.length, 0).then(leaves => {
            if (!alive) return
            entry.members = leaves.map(f => sites.get(f.properties.id)).filter(Boolean)
            publish()
          }).catch(() => { /* A tile refresh can replace the cluster while zooming. */ })
        }
        if (entry.coord[0] !== coord[0] || entry.coord[1] !== coord[1]) {
          entry.marker.setLngLat(coord)
          entry.coord = coord
        }
        if (!entry.visible) entry.marker.addTo(map)
        entry.visible = true
        visible.set(key, entry)
      }
      for (const [key, entry] of cache) if (!visible.has(key) && entry.visible) { entry.marker.remove(); entry.visible = false }
      const next = [...visible.keys()].sort().join('|')
      if (next !== signature) { signature = next; publish() }
    }
    const render = () => sync(), settled = () => sync(true)
    map.on('render', render)
    map.on('moveend', settled)
    map.on('sourcedata', settled)
    sync(true)
    return () => {
      alive = false
      map.off('render', render); map.off('moveend', settled); map.off('sourcedata', settled)
      for (const entry of cache.values()) entry.marker.remove()
    }
  }, [map, data])

  return entries.map(entry => {
    const site = entry.members[0], count = entry.count ?? 1
    const country = site && entry.members.every(s => s.country === site.country) ? countryNames[site.country]?.[ko ? 0 : 1] : null
    const name = entry.isCluster ? country ?? (ko ? '캠퍼스' : 'Campuses') : site ? pickName(site, lang) : ''
    const mw = entry.members.reduce((sum, s) => sum + (s.grid_mw ?? 0), 0)
    const color = entry.isCluster ? '#426b60' : styleOf(site?.status).color
    const selected = entry.members.some(s => s.id === selectedId)
    const label = entry.isCluster ? `${name} · ${count}${ko ? '개 캠퍼스 보기' : ' campuses'}` : `${name} · ${ko ? '3D 보기' : 'Explore in 3D'}`
    return createPortal(<button className={`map-campus-card${entry.isCluster ? ' is-cluster' : ''}${selected ? ' is-selected' : ''}`}
      style={{ '--marker-color': color }} aria-label={label} aria-pressed={selected} disabled={!site}
      title={entry.isCluster ? label : `${name} · ${t.status[site?.status] ?? ''} · ${ko ? '지역 위치' : 'Regional location'}`}
      onClick={e => { e.stopPropagation(); if (entry.isCluster) onGroup(entry.members); else useAppStore.getState().enterSite3D(site.id) }}>
      <span className="map-marker-icon">{entry.isCluster ? <Layers3 size={16}/> : <Building2 size={16}/>}</span>
      <span className="map-marker-copy"><b>{name}</b><span>{entry.isCluster ? `${count}${ko ? '개 캠퍼스' : ' campuses'}` : ko ? '지역 위치' : 'Regional'}<i/>{mw ? capacity(mw) : '—'}</span></span>
      <span className="map-marker-action">{entry.isCluster ? <ChevronRight size={13}/> : <><Box size={11}/><small>3D</small></>}</span>
      <span className="map-marker-stem"/>
    </button>, entry.element, entry.key)
  })
}
