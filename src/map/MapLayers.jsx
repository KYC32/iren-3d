// =============================================================
// MapLayers — 실제 지도의 참고 층 모음 (모두 기본 꺼짐 · 오른쪽 아래 조종 칸의 단추로 켬)
// -------------------------------------------------------------
//   주변 데이터센터 (IM3 Atlas · ODbL)            — DataCenterLayer.jsx (2026-10-26)
//   위성 사진 (Copernicus Sentinel-2)             — SatelliteLayer.jsx (2026-10-28)
//   지역 규제 (Miklian 2026 · CC BY 4.0)          — RulesLayer.jsx (2026-10-28)
// GeoMap 이 지도를 다 띄운 뒤 이 파일 하나만 따로 불러옴(React.lazy) → 세 층 코드가 지도 묶음 크기 한도에 들지 않음
// 단추는 붙는 순서의 반대로 쌓임(maplibre 는 아래쪽 조종 칸에 새 단추를 위에 넣음): 위에서부터 지역 규제 · 위성 사진 · 주변 데이터센터
// =============================================================
import DataCenterLayer from './DataCenterLayer.jsx'
import SatelliteLayer from './SatelliteLayer.jsx'
import RulesLayer from './RulesLayer.jsx'

export default function MapLayers({ map, lang }) {
  return <>
    <DataCenterLayer map={map} lang={lang} />
    <SatelliteLayer map={map} lang={lang} />
    <RulesLayer map={map} lang={lang} />
  </>
}
