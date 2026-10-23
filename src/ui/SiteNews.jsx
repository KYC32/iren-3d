// =============================================================
// SiteNews — 캠퍼스 "최근 소식" 목록 (날짜 · 한 줄 · 출처 링크)
//   캠퍼스 패널 '현황' 탭(따로 불러옴)과 현황 페이지(#page=portfolio) 캠퍼스 표 아래에서 같이 씀
//   어떤 소식을 어떤 순서로 보일지는 부르는 쪽이 data/siteNews.js(siteNewsAt)로 골라 items 로 넘김
//   최신 3개를 먼저 보이고, 더 있으면 "이전 소식 n개 더 보기"로 펼침
// =============================================================
import { useState } from 'react'
import { ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'
import { fmtWhen } from '../data/events.js'
import { domainOf } from '../data/news.js'
import './siteNews.css'

const FIRST = 3 // 처음에 보일 소식 수

// title: 목록 위 제목(없어도 됨) · empty: 소식이 없을 때 띄울 문장(없으면 아무것도 그리지 않음)
export default function SiteNews({ items, lang, title = null, empty = null }) {
  const [all, setAll] = useState(false)
  const ko = lang === 'ko'
  if (!items.length && !empty) return null
  const shown = all ? items : items.slice(0, FIRST)
  const rest = items.length - FIRST
  return <>
    {title}
    {!items.length && <p className="research-empty">{empty}</p>}
    {items.length > 0 && <ol className="site-news">
      {shown.map((n, i) => (
        <li key={`${n.date}-${i}`}>
          <span className="site-news-date">{fmtWhen(n.date, lang)}</span>
          <div className="site-news-body">
            {/* 글을 누르면 출처 원문이 새 창으로 열림 · 아래 작은 글씨는 출처 사이트 */}
            <a href={n.source} target="_blank" rel="noreferrer">{ko ? n.event : n.event_en ?? n.event}<ArrowUpRight size={11} aria-hidden="true" /></a>
            <small>{domainOf(n.source)}</small>
          </div>
        </li>
      ))}
    </ol>}
    {rest > 0 && <button type="button" className="site-news-more" aria-expanded={all} onClick={() => setAll(!all)}>
      {all
        ? <><ChevronUp size={13} aria-hidden="true" />{ko ? '접기' : 'Show less'}</>
        : <><ChevronDown size={13} aria-hidden="true" />{ko ? `이전 소식 ${rest}개 더 보기` : `Show ${rest} earlier`}</>}
    </button>}
  </>
}
