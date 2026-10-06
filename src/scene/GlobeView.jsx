// =============================================================
// GlobeView — 파스텔 저폴리 지구본 + 사이트 핀
// - three-globe: 바다 구(sphere) + 육지를 육각형 타일로 (저폴리 보드게임 느낌)
// - 핀(GlobePin): R3F 로 직접 그려서 호버·클릭·필터 흐림을 자유롭게 제어
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { MeshLambertMaterial, Quaternion, Vector3, Color } from 'three'
import ThreeGlobe from 'three-globe'
import { feature } from 'topojson-client'
import { useAppStore, isStatusActive } from '../store/useAppStore.js'
import { styleOf } from '../data/statusStyle.js'
import { latLngToVec3, spreadPins, fmtMw } from './geo.js'
import { pickName } from '../i18n/useT.js'

// IREN 사이트가 있는 나라(ISO 숫자 코드) — 육지 색을 민트로 강조
const HOME_COUNTRIES = new Set(['840', '124', '036', '724']) // 미국, 캐나다, 호주, 스페인

export default function GlobeView({ visible }) {
  const sites = useAppStore((s) => s.data?.sites ?? [])
  const [countries, setCountries] = useState(null)

  // 1) 나라 경계 데이터(약 100KB)를 별도 청크로 비동기 로드
  useEffect(() => {
    import('world-atlas/countries-110m.json').then((mod) => {
      const topo = mod.default ?? mod
      setCountries(feature(topo, topo.objects.countries).features)
    })
  }, [])

  // 2) three-globe 객체는 한 번만 만듭니다 (useMemo)
  const globe = useMemo(() => {
    const g = new ThreeGlobe({ animateIn: false })
      .globeMaterial(new MeshLambertMaterial({ color: '#cdd8f3' })) // 파스텔 바다
      .showAtmosphere(true)
      .atmosphereColor('#b3c2ff')
      .atmosphereAltitude(0.14)
    return g
  }, [])

  // 3) 나라 데이터가 오면 육각형 육지 타일 생성
  useEffect(() => {
    if (!countries) return
    globe
      .hexPolygonsData(countries)
      .hexPolygonResolution(3)        // 숫자가 작을수록 육각형이 커지고 더 '저폴리'
      .hexPolygonMargin(0.22)         // 타일 사이 틈
      .hexPolygonAltitude(0.004)
      .hexPolygonColor((f) => (HOME_COUNTRIES.has(String(f.id)) ? '#b5e2cf' : '#f5f1e8'))
  }, [countries, globe])

  // 가까운 핀은 화면에서 살짝 벌려서 표시
  const display = useMemo(() => spreadPins(sites), [sites])

  return (
    <group visible={visible}>
      <primitive object={globe} />
      {visible && sites.map((s) => <GlobePin key={s.id} site={s} pos={display[s.id]} />)}
    </group>
  )
}

const UP = new Vector3(0, 1, 0)

function GlobePin({ site, pos }) {
  const lang = useAppStore((s) => s.lang)
  const hoverId = useAppStore((s) => s.hoverId)
  const setHover = useAppStore((s) => s.setHover)
  const requestSite = useAppStore((s) => s.requestSite)
  const activeStatuses = useAppStore((s) => s.activeStatuses)

  const style = styleOf(site.status)
  const active = isStatusActive(activeStatuses, site.status)
  const hovered = hoverId === site.id

  // 지표면 위 위치와 "위쪽" 방향(지구 중심 → 바깥)
  const { position, quaternion, normal } = useMemo(() => {
    const p = latLngToVec3(pos.lat, pos.lng, 0)
    const n = p.clone().normalize()
    return { position: p, normal: n, quaternion: new Quaternion().setFromUnitVectors(UP, n) }
  }, [pos.lat, pos.lng])

  // 막대 높이 ∝ √MW (면적 감각에 가깝게): 30MW ≈ 5, 1,600MW ≈ 21
  const h = 3 + Math.sqrt(site.grid_mw) * 0.45
  const ringRef = useRef()
  const labelRef = useRef()
  const tmp = useMemo(() => new Vector3(), [])

  useFrame(({ camera, clock }) => {
    // (a) 바닥 링 펄스: 상태별 속도로 커졌다가 사라짐
    if (ringRef.current) {
      const speed = style.ringSpeed
      const t = speed > 0 ? (clock.elapsedTime * speed * 0.6) % 1 : 0
      const s = 1 + t * 2.4
      ringRef.current.scale.set(s, s, s)
      ringRef.current.material.opacity = speed > 0 ? (1 - t) * (active ? 0.7 : 0.15) : 0
    }
    // (b) 지구 뒤편에 있는 핀의 라벨은 숨기기: 카메라 방향과 지표 법선의 내적으로 판단
    if (labelRef.current) {
      tmp.copy(camera.position).sub(position).normalize()
      const facing = tmp.dot(normal)
      const show = facing > 0.15
      labelRef.current.style.opacity = show ? (active ? 1 : 0.35) : 0
      labelRef.current.style.pointerEvents = show ? 'auto' : 'none'
    }
  })

  const color = active ? style.color : '#c3c9d8'
  const onOver = (e) => { e.stopPropagation(); setHover(site.id); document.body.style.cursor = 'pointer' }
  const onOut = () => { setHover(null); document.body.style.cursor = '' }
  const onClick = (e) => { e.stopPropagation(); requestSite(site.id) }

  return (
    <group position={position} quaternion={quaternion}>
      {/* 막대 (계통 전력 규모) */}
      <mesh position={[0, h / 2, 0]} scale={hovered ? 1.25 : 1} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} castShadow>
        <cylinderGeometry args={[0.9, 1.1, h, 12]} />
        <meshStandardMaterial color={color} roughness={0.55} transparent opacity={site.status === 'planned' ? 0.75 : 1} />
      </mesh>
      {/* 꼭대기 캡 */}
      <mesh position={[0, h + 0.5, 0]}>
        <sphereGeometry args={[1.05, 14, 10]} />
        <meshStandardMaterial color={new Color(color).offsetHSL(0, 0, 0.12)} roughness={0.4} />
      </mesh>
      {/* 바닥 펄스 링 */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25, 0]}>
        <ringGeometry args={[1.3, 1.8, 32]} />
        <meshBasicMaterial color={style.color} transparent depthWrite={false} />
      </mesh>
      {/* 이름·MW 라벨 (HTML) */}
      <Html position={[0, h + 2.4, 0]} center zIndexRange={[20, 0]}>
        <button
          ref={labelRef}
          className={`pin-label${hovered ? ' is-hover' : ''}`}
          onPointerEnter={() => setHover(site.id)}
          onPointerLeave={() => setHover(null)}
          onClick={() => requestSite(site.id)}
        >
          <span className="dot" style={{ background: style.color }} />
          <span className="name">{pickName(site, lang)}</span>
          <span className="mw">{fmtMw(site.grid_mw)}</span>
        </button>
      </Html>
    </group>
  )
}
