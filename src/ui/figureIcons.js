// =============================================================
// figureIcons.js — 그림마다 단추 아이콘 (전력 경로 = 플러그, 액체냉각 홀 = 물방울)
//   캠퍼스 패널 단추(FigureButton)와 3D 건물 라벨 단추(SiteView)가 같이 씀. 둘 다 따로 불러오는 묶음이라 첫 화면 번들에 안 들어감
// =============================================================
import { PlugZap, Droplets } from 'lucide-react'

const FIGURE_ICON = { 'power-block': PlugZap, 'horizon-hall': Droplets }
export const figureIcon = (name) => FIGURE_ICON[name] ?? PlugZap   // 모르는 그림이면 플러그
