// =============================================================
// ModelReference — 캠퍼스 패널 아래 '사진을 참고한 경관 · 출처' 칸 (3D 화면에서만)
// -------------------------------------------------------------
// 경관 자료(campusLandscape.js, 약 13KB)는 3D 장면도 쓰는 큰 표라, 패널(첫 화면 번들)에서 떼어
// 3D 화면에 들어갈 때 장면과 함께 받게 함 (CampusPanel.jsx 가 lazy 로 불러옴).
// 내용은 예전에 CampusPanel 안에 있던 JSX 그대로입니다.
// =============================================================
import { ArrowUpRight } from 'lucide-react'
import { campusAppearance } from '../scene/campusAppearance.js'
import { campusLandscape } from '../scene/campusLandscape.js'

export default function ModelReference({ siteId, ko }) {
  const appearance=campusAppearance(siteId)
  const landscape=campusLandscape(siteId)
  // 경관 자료가 있으면 접힌 출처 칸, 없으면 '구성도' 안내 한 줄
  return (appearance||landscape)?<details className="model-reference"><summary>{ko?'사진을 참고한 경관 · 출처':'Photo-informed setting · sources'}</summary>{appearance&&<p>{ko?appearance.notes_ko:appearance.notes_en}</p>}{landscape&&<p>{ko?landscape.notes_ko:landscape.notes_en} {ko?landscape.decoration_ko:landscape.decoration_en}</p>}{landscape?.terrain_ko&&<p>{ko?landscape.terrain_ko:landscape.terrain_en}</p>}<p>{ko?'건물·도로·경계의 위치와 규모는 용량을 설명하는 구성도입니다. 현장 실측·현재 공정률·계절을 재현하지 않습니다.':'Buildings, roads and boundaries illustrate capacity, not surveyed positions, current progress or seasons.'}</p><a href={landscape?.source??appearance.source} target="_blank" rel="noreferrer">{ko?'IREN 공식 자료':'IREN official reference'}<ArrowUpRight size={12} aria-hidden="true"/></a>{landscape?.regionalSource&&<a href={landscape.regionalSource} target="_blank" rel="noreferrer">{ko?'지역 경관 참고':'Regional landscape reference'}<ArrowUpRight size={12} aria-hidden="true"/></a>}{landscape?.terrain_ko&&<a href="https://mapterhorn.com/attribution" target="_blank" rel="noreferrer">{ko?'지형 자료 출처':'Terrain data attribution'}<ArrowUpRight size={12} aria-hidden="true"/></a>}</details>:<p className="research-note">{ko?'3D 사업 구성도 · 실제 건물 배치·공정률을 재현한 모형이 아닙니다.':'Business diagram · not a surveyed layout or measured construction model.'}</p>
}
