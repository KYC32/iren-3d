// =============================================================
// PortfolioObserve — 현황 페이지의 "위성으로 본 변화 · 지역 규제" 칸 (캠퍼스별 카드)
// -------------------------------------------------------------
// 캠퍼스 패널에만 있던 두 관찰 자료를 캠퍼스끼리 한눈에 비교하게 모음 (2026-10-28)
//   위성: 처음 사진 ↔ 보고 있는 달까지의 마지막 사진 (Sentinel-2, public/data/satellite.json)
//   지역 규제: 미국 부지만 — 카운티·주의 데이터센터 유예·제한 조치 수 (data/restrictions.json → infra.json)
// 둘 다 관찰·참고 자료라 공식 상태를 바꾸지 않음 — 칸 아래에 그렇게 적음
// 현황 페이지(따로 불러옴) 안에서만 쓰임 → 첫 화면 묶음에 안 들어감
// =============================================================
import { useEffect, useState } from 'react'
import { ArrowUpRight, Satellite, Scale } from 'lucide-react'
import { satelliteAt } from '../data/satellite.js'
import { loadSatellite } from '../data/loadSatellite.js'
import { rulesLine } from '../data/rulesText.js'
import { pickName } from '../i18n/useT.js'
import { monthLabel } from '../data/timeline.js'

// sites: 표와 같은 순서의 캠퍼스 목록 · month: 보고 있는 달 · restrictions: infra 의 지역 규제 요약 · onOpen: 캠퍼스를 지도에서 열기
export default function PortfolioObserve({ sites, month, restrictions, lang, onOpen }) {
  const ko = lang === 'ko'
  const [man, setMan] = useState(null)
  useEffect(() => { let alive = true; loadSatellite().then((m) => alive && setMan(m)); return () => { alive = false } }, [])
  const cards = sites.map((s) => {
    const sat = satelliteAt(man, s.id, month)
    const rules = restrictions?.sites.find((r) => r.site === s.id)
    return { s, sat, rules }
  }).filter((c) => c.sat.length > 0 || c.rules)
  if (cards.length === 0) return null
  const date = (img) => img.date.replaceAll('-', '.')
  return (
    <section className="pf-news pf-observe" aria-labelledby="pf-observe-title">
      <h3 id="pf-observe-title">{ko ? `위성으로 본 변화 · 지역 규제 · ${monthLabel(month, lang)}까지` : `Seen from space · local rules · through ${monthLabel(month, lang)}`}</h3>
      <div className="pf-news-grid">{cards.map(({ s, sat, rules }) => {
        const line = rules && rulesLine(rules, lang)
        const first = sat[0], last = sat.at(-1)
        return (
          <section key={s.id} className="pf-news-site" aria-label={pickName(s, lang)}>
            <h4><button type="button" className="pf-observe-open" onClick={() => onOpen(s.id)}>{pickName(s, lang)}<ArrowUpRight size={11} aria-hidden="true" /></button></h4>
            {sat.length > 0 && <div className="pf-sat">
              {(sat.length > 1 ? [first, last] : [last]).map((img, k) => <figure key={img.month}>
                <img src={img.src} alt={`${pickName(s, lang)} · ${img.date} Sentinel-2`} width="400" height="400" loading="lazy" decoding="async" />
                <figcaption>{k === 0 && sat.length > 1 ? (ko ? '처음 ' : 'First ') : ''}{date(img)}</figcaption>
              </figure>)}
            </div>}
            {sat.length === 0 && <p className="pf-observe-none"><Satellite size={11} aria-hidden="true" />{ko ? '구름 없는 위성 사진이 아직 없음' : 'No cloud-free image yet'}</p>}
            {line && <p className="pf-rules"><Scale size={11} aria-hidden="true" /><span>{line.main}{line.nearest && <small>{line.nearest}</small>}</span></p>}
          </section>
        )
      })}</div>
      <p className="page-note">{ko
        ? '위성: 부지 중심 4km · 10m 해상도 · 한 달에 구름·눈이 가장 적은 한 장 · Contains modified Copernicus Sentinel data (2025–2026). 지역 규제: 미국 부지만 · 제3자 연구 자료(Miklian 2026 · CC BY 4.0, 회사 발표 아님). 둘 다 관찰 자료라 공식 상태를 바꾸지 않습니다. 이름을 누르면 지도에서 그 캠퍼스가 열립니다.'
        : 'Imagery: 4 km around each site · 10 m resolution · clearest scene per month (least cloud and snow) · Contains modified Copernicus Sentinel data (2025–2026). Local rules: US sites only · third-party research data (Miklian 2026 · CC BY 4.0; not company-reported). Both are observations and never change official status. Click a name to open the campus on the map.'}</p>
    </section>
  )
}
