// =============================================================
// events.js — 데이터에서 "사건 목록"을 뽑는 순수 함수
// -------------------------------------------------------------
// 한 목록을 세 곳이 함께 씁니다: 타임라인 눈금, "다가오는 일정" 패널, 계약 표시
//   news     : 사이트 타임라인의 뉴스 (이미 일어난 일)
//   phase    : 앞으로의 건물 단계 (목표·추정) — 예) Horizon 2 가동 2026-Q4
//   power    : 변전소 통전·계통 확보 (목표·추정 포함)
//   delivery : GPU 납품 예정
//   contract : 고객 계약 서명
//   earnings·financing·other : 회사 단위 일정
// 이미 지난 "발표된(reported)" 건물 단계는 뉴스와 겹치므로 넣지 않습니다.
// =============================================================
import { toMonth, phaseMonth } from './timeline.js'

const VERB = {
  ko: { operating: '가동', commissioning: '시운전', under_construction: '착공', decommissioning: '폐쇄 시작', retired: '전환·폐쇄 완료', planned: '계획 발표' },
  en: { operating: 'goes live', commissioning: 'commissioning', under_construction: 'construction starts', decommissioning: 'wind-down starts', retired: 'converted / retired', planned: 'announced' },
}

// '2026-H2 ~ 2027-Q1' 같은 범위 표기는 앞쪽 시점을 씀
const firstWhen = (s) => String(s).split(/\s*~\s*/)[0].trim()

// 날짜 표기 → 화면용 ('2026-Q4' → '2026년 4분기' / 'Q4 2026')
export function fmtWhen(when, lang = 'ko') {
  const m = String(when).match(/^(\d{4})(?:-(Q[1-4]|H[12]|\d{2})(?:-(\d{2}))?)?$/)
  if (!m) return String(when)
  const [, y, part, day] = m
  if (!part) return y
  if (part.startsWith('Q')) return lang === 'ko' ? `${y}년 ${part[1]}분기` : `${part} ${y}`
  if (part.startsWith('H')) return lang === 'ko' ? `${y}년 ${part === 'H1' ? '상반기' : '하반기'}` : `${part} ${y}`
  return day ? `${y}.${part}.${day}` : `${y}.${part}`
}

const mwLabel = (mw) => (mw >= 1000 ? `${(mw / 1000).toFixed(1).replace(/\.0$/, '')}GW` : `${mw}MW`)

export function buildEvents(raw) {
  const out = []
  const add = (e) => out.push({ ...e, id: `${e.kind}:${e.siteId ?? '-'}:${e.when}:${out.length}` })
  const nameOf = (o, lang) => (lang === 'ko' && o.name_ko ? o.name_ko : o.name)

  for (const site of raw.sites) {
    // 1) 뉴스
    for (const n of site.timeline ?? []) {
      add({ kind: 'news', when: n.date, month: toMonth(n.date), siteId: site.id, title_ko: n.event, title_en: n.event_en ?? n.event, basis: 'reported', source: n.source })
    }
    // 2) 앞으로의 건물 단계
    for (const b of site.buildings) {
      for (const p of b.phases) {
        if (p.basis === 'reported' || p.status === 'planned') continue // 지난 공식 단계·계획 발표는 제외
        add({
          kind: 'phase', when: p.from, month: phaseMonth(p), siteId: site.id, buildingId: b.id, status: p.status,
          title_ko: `${nameOf(b, 'ko')} ${VERB.ko[p.status]}`, title_en: `${b.name} ${VERB.en[p.status]}`,
          basis: p.basis, source: p.source,
        })
      }
    }
    // 3) 전력: 통전이 늘어나거나 확보 전력이 늘어난 시점 (첫 항목은 사이트 발표라 제외)
    site.power.forEach((p, i) => {
      if (i === 0) return
      const prev = site.power[i - 1]
      const m = toMonth(p.from, p.basis === 'target' ? 'end' : 'start')
      if (p.energized_mw > prev.energized_mw) {
        add({ kind: 'power', when: p.from, month: m, siteId: site.id, title_ko: `변전소 통전 ${mwLabel(p.energized_mw)}`, title_en: `Substation energized ${mwLabel(p.energized_mw)}`, basis: p.basis, source: p.source })
      } else if (p.secured_mw > prev.secured_mw) {
        add({ kind: 'power', when: p.from, month: m, siteId: site.id, title_ko: `계통 확보 ${mwLabel(p.secured_mw)}`, title_en: `Grid secured ${mwLabel(p.secured_mw)}`, basis: p.basis, source: p.source })
      }
    })
    // 4) 납품 예정
    for (const d of site.deliveries ?? []) {
      if (d.status === 'done') continue
      const w = firstWhen(d.eta)
      add({ kind: 'delivery', when: w, month: toMonth(w), siteId: site.id, title_ko: `${d.what} 납품`, title_en: `${d.what} delivery`, basis: 'target', source: d.source })
    }
  }

  // 5) 회사 단위: 일정·계약
  for (const c of raw.companies) {
    for (const e of c.events ?? []) {
      add({ kind: e.kind, when: e.date, month: toMonth(e.date), siteId: null, title_ko: e.title_ko, title_en: e.title_en, basis: e.basis, source: e.source })
    }
    for (const k of c.contracts ?? []) {
      const val = k.value_usd_bn != null ? ` $${k.value_usd_bn}bn` : ''
      add({
        kind: 'contract', when: k.signed, month: toMonth(k.signed), siteId: k.sites[0] ?? null, contractId: k.id,
        title_ko: `${k.customer_ko ?? k.customer} 계약${val}${k.term_years ? ` (${k.term_years}년)` : ''}`,
        title_en: `${k.customer} contract${val}${k.term_years ? ` (${k.term_years} yrs)` : ''}`,
        basis: 'reported', source: k.source,
      })
    }
  }
  return out.sort((a, b) => a.month - b.month || a.kind.localeCompare(b.kind))
}

// 기준일 이후의 일정 (기준일 달이라도 목표·추정이면 포함)
export function upcomingEvents(events, asOfM) {
  return events.filter((e) => e.month > asOfM || (e.month === asOfM && e.basis !== 'reported'))
}

// 타임라인 눈금: 같은 달의 사건을 하나로 묶음 { month, events, future }
export function eventTicks(events, asOfM) {
  const by = new Map()
  for (const e of events) {
    if (!by.has(e.month)) by.set(e.month, [])
    by.get(e.month).push(e)
  }
  return [...by.entries()].map(([month, evs]) => ({ month, events: evs, future: month > asOfM }))
}
