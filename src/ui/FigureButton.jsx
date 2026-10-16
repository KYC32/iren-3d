// =============================================================
// FigureButton — 그림 단추 + 공용 그림 대화상자 (누르면 그림 페이지를 iframe 으로, 열 때만 불러옴)
//   캠퍼스 패널의 "현장 진척" 칸과 고른 건물 카드가 함께 씀. 이 파일은 따로 불러오는 묶음이라 첫 화면 번들에 안 들어감
// =============================================================
import { useState } from 'react'
import FigureDialog from './FigureDialog.jsx'
import { figureIcon } from './figureIcons.js'

export default function FigureButton({ name, lang, label }) {
  const [open, setOpen] = useState(false)
  const Icon = figureIcon(name)   // 그림 종류에 맞는 아이콘
  return <>
    <button className="facts-figure-btn" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">
      <Icon size={14} aria-hidden="true" />{label}
    </button>
    <FigureDialog name={open ? name : null} lang={lang} onClose={() => setOpen(false)} />
  </>
}
