// =============================================================
// 영상 스토리보드 — 장면(shot)과 자막(card)을 시간표로 정의합니다.
// 숫자(초)만 고치면 영상 길이·순서·자막이 바뀝니다.
// 카메라는 각 장면의 진행률 p(0~1) 에 대한 함수라서 같은 시각엔 항상 같은 화면이 나옵니다.
// =============================================================

import { totalsAt, powerAt, siteMetricsAt, monthLabel, toMonth } from '../data/timeline.js'
import { asOfMonth } from '../data/view.js'
import { fmtMw, fmtMetric } from '../data/format.js'

export const DURATION = 34 // 전체 길이(초)

// type: 'globe' = 지구본, 'site' = 캠퍼스
// fadeIn/fadeOut: 장면 시작/끝에 배경색으로 페이드(초)
// date: { from: 'YYYY-MM', to: 'YYYY-MM' } 를 주면 그 장면 동안 타임라인 날짜가 흘러감 (없으면 기준일)
// ranking: true 면 오른쪽에 회사 확보 전력 순위 오버레이
export const SHOTS = [
  // 1) 지구본: 태평양 쪽에서 북미로 천천히 돌아옴
  { t0: 0, t1: 6.5, type: 'globe', cam: { from: { lat: 30, lng: -165, alt: 1 }, to: { lat: 38, lng: -102, alt: 1 } }, fadeIn: 0.4, date: { from: '2024-01', to: '2026-10' } },
  // 2) Childress 로 날아 들어감
  { t0: 6.5, t1: 9, type: 'globe', fly: 'childress', cam: { from: { lat: 38, lng: -102, alt: 1 } }, fadeOut: 0.45 },
  // 3) Childress 캠퍼스 한 바퀴
  { t0: 9, t1: 19.5, type: 'site', site: 'childress', orbit: { az0: 0.55, az1: 1.45, polar0: 0.98, polar1: 0.9, dist0: 1.08, dist1: 0.92 }, fadeIn: 0.45, fadeOut: 0.45 },
  // 4) Sweetwater 1 캠퍼스
  { t0: 19.5, t1: 28, type: 'site', site: 'sweetwater-1', orbit: { az0: 1.2, az1: 0.45, polar0: 0.92, polar1: 0.98, dist0: 0.82, dist1: 0.7 }, fadeIn: 0.45, fadeOut: 0.45 },
  // 5) 지구본으로 빠져나오며 전체 정리
  { t0: 28, t1: DURATION, type: 'globe', cam: { from: { lat: 34, lng: -101, alt: 0.25 }, to: { lat: 30, lng: -112, alt: 1 } }, fadeIn: 0.45 },
]

// 자막 카드. kind: 'title'(큰 제목) | 'header'(장면 제목) | 'caption'(아래 자막) | 'outro'
// tone: 상태색 점 (operating / commissioning / under_construction / planned / pending)
// 숫자(사이트 수·확보 전력·캠퍼스 계통·채굴동·회사 지표·기준일)는 자료에서 계산 (2026-10-28)
//   예전엔 글로 박아 둬서 '9개 사이트'(지금 10곳)·'2026.10.06 기준'이 낡았고, 마무리의 '수주잔고 $13bn+'는 근거가 없었음
//   캠퍼스 일정 문구(인도·납품 목표)는 회사 발표 문장이라 글로 둠 — 회사가 일정을 바꾸면 여기와 NARRATION 을 함께 고칠 것
// data: viewInfra 결과 (스토어의 data) · 결과는 녹화 화면(RecordDirector · overlay)과 내레이션 검사가 같이 씀
const gw = (mw) => fmtMw(mw).replace(' ', '')   // 영상 자막은 붙여 씀: 5.6GW · 750MW
const dotMonth = (ym) => String(ym).slice(0, 7).replace('-', '.')   // '2026-05-01' → '2026.05'

function cardFacts(data) {
  const raw = data.raw
  const m = asOfMonth(raw.as_of)
  const total = totalsAt(data.observedRaw ?? raw, m)
  const site = (id) => raw.sites.find((s) => s.id === id)
  const ch = site('childress'), sw = site('sweetwater-1')
  const metrics = data.companies[0]?.metrics ?? []
  const metric = (key) => metrics.find((x) => x.key === key)
  return {
    asOf: raw.as_of, sites: total.sites, secured: gw(total.secured),
    ch, chGrid: gw(powerAt(ch, m)?.secured ?? 0), chKv: ch.substation?.voltage, chMining: gw(siteMetricsAt(ch, m).mining),
    sw, swGrid: gw(powerAt(sw, m)?.secured ?? 0), swOn: sw.power.find((p) => p.energized_mw > 0)?.from ?? '',
    arr: metric('contracted_arr_usd_bn'), backlog: metric('contracted_backlog_usd_bn'), gpus: metric('gpus_total'),
  }
}

export function buildCards(data, lang = 'ko') {
  const f = cardFacts(data)
  const ko = lang === 'ko'
  // 장면 제목: 'Childress, Texas' — 한국어 영상도 지명·명칭은 원문 그대로 (2026-10-28 사용자 지시)
  //   'Texas (Fisher County)' 처럼 괄호로 붙은 카운티는 뺌 (제목은 짧게)
  const place = (s) => `${s.name}, ${String(s.region).replace(/\s*\(.*\)$/, '')}`
  // 회사 지표 한 줄 (한국어 '계약 ARR $4bn' · 영어 '$4bn contracted ARR') — 지표가 없으면 그 줄을 뺌
  const stat = (x, label) => x && (ko ? `${label} ${fmtMetric(x, 'ko')}` : `${fmtMetric(x, 'en')} ${label}`)
  const gpuText = f.gpus && (ko ? `총 GPU ~${Math.round(f.gpus.value / 1e4)}만` : `~${Math.round(f.gpus.value / 1000)}k GPUs`)
  return ko ? [
    { t0: 0.6, t1: 6.3, kind: 'title', title: 'IREN 데이터센터 현황', sub: `비트코인 채굴에서 AI 클라우드로 · ${f.sites}개 사이트 ${f.secured}` },
    { t0: 9.4, t1: 19.2, kind: 'header', title: place(f.ch), sub: `계통 ${f.chGrid} · 자사 변전소 ${f.chKv}` },
    { t0: 10.6, t1: 13.6, kind: 'caption', tone: 'operating', text: 'Horizon 1 가동 — Microsoft 인도 완료 (2026.08)' },
    { t0: 13.6, t1: 16.6, kind: 'caption', tone: 'commissioning', text: 'Horizon 2~4 — 2026년 4분기 납품 목표 (GB300)' },
    { t0: 16.6, t1: 19.3, kind: 'caption', tone: 'planned', text: `채굴동 ${f.chMining} — 2026년 말 폐쇄, AI로 전환` },
    { t0: 19.9, t1: 27.8, kind: 'header', title: place(f.sw), sub: `${f.swGrid} 변전소 통전 완료 (${dotMonth(f.swOn)})` },
    { t0: 21.0, t1: 24.4, kind: 'caption', tone: 'under_construction', text: '1단계 300MW 건설중 — 2027년 4분기 납품 목표' },
    { t0: 24.4, t1: 27.8, kind: 'caption', tone: 'pending', text: 'Sweetwater 2와 합쳐 2GW 허브 — ERCOT 편입' },
    { t0: 29.0, t1: DURATION, kind: 'outro', title: `확보 전력 ${f.secured}`, stats: [stat(f.arr, '계약 ARR'), stat(f.backlog, '계약 잔액'), gpuText].filter(Boolean), url: 'iren-3d.vercel.app', note: `비공식 · 공개자료 기반 · 투자 조언 아님 · ${f.asOf.replaceAll('-', '.')} 기준` },
  ] : [
    { t0: 0.6, t1: 6.3, kind: 'title', title: 'IREN Data Center Map', sub: `From bitcoin mining to AI cloud · ${f.sites} sites, ${f.secured}` },
    { t0: 9.4, t1: 19.2, kind: 'header', title: place(f.ch), sub: `${f.chGrid} grid · own ${f.chKv} substation` },
    { t0: 10.6, t1: 13.6, kind: 'caption', tone: 'operating', text: 'Horizon 1 live — delivered to Microsoft (Aug 2026)' },
    { t0: 13.6, t1: 16.6, kind: 'caption', tone: 'commissioning', text: 'Horizon 2–4 — Q4 2026 delivery target (GB300)' },
    { t0: 16.6, t1: 19.3, kind: 'caption', tone: 'planned', text: `Mining halls ${f.chMining} — wound down by end-2026` },
    { t0: 19.9, t1: 27.8, kind: 'header', title: place(f.sw), sub: `${f.swGrid} substation energized (${monthLabel(toMonth(f.swOn.slice(0, 7)), 'en')})` },
    { t0: 21.0, t1: 24.4, kind: 'caption', tone: 'under_construction', text: 'Phase 1, 300MW under construction — Q4 2027' },
    { t0: 24.4, t1: 27.8, kind: 'caption', tone: 'pending', text: '2GW hub with Sweetwater 2 — in ERCOT Batch Zero' },
    { t0: 29.0, t1: DURATION, kind: 'outro', title: `${f.secured} secured power`, stats: [stat(f.arr, 'contracted ARR'), stat(f.backlog, 'contracted backlog'), gpuText].filter(Boolean), url: 'iren-3d.vercel.app', note: `Unofficial · public sources · not investment advice · as of ${f.asOf}` },
  ]
}

// 링크 미리보기(public/og.jpg) 카드 문구 — 사이트 수도 자료에서 (예전엔 '9개 사이트' 고정)
export function ogCard(data, lang = 'ko') {
  const { sites } = cardFacts(data)
  return lang === 'ko'
    ? { title: 'IREN 데이터센터 3D 현황판', sub: `가동·건설·계획 ${sites}개 사이트 · 2024~2028 타임라인 · 고객 계약`, url: 'iren-3d.vercel.app' }
    : { title: 'IREN Data Center 3D Map', sub: `${sites} sites: operating, building, planned · 2024–2028 timeline · contracts`, url: 'iren-3d.vercel.app' }
}

// 내레이션(읽을 문장) — scripts/narrate/narrate.mjs 가 Qwen3-TTS 'Sohee' 목소리로 만들어 영상에 입힘
//   자막 조각을 그대로 읽으면 어색해서 말로 읽기 좋게 따로 씀. 사실은 그 시간대 자막과 같아야 함
//   규칙(narration.test.js 가 검사): 숫자는 그 시간 화면 자막에 있는 것만 · 회사·지명은 한글(IREN = 아이렌)
//   t0 = 가장 이른 시작, t1 = 늦어도 끝날 시각. 넘치면 최대 1.15배 빠르게, 그래도 넘치면 오류 → 문장을 줄임
//   영어 내레이션은 아직 없음 (en 이 없으면 영어 영상은 소리 없이 만듦)
export const NARRATION = {
  ko: [
    { t0: 0.7, t1: 6.4, say: '아이렌 데이터센터 현황입니다. 비트코인 채굴에서 AI 클라우드로 바뀌고 있습니다.' },
    { t0: 9.4, t1: 14.4, say: '차일드레스의 호라이즌 1은 마이크로소프트에 인도됐습니다.' },
    { t0: 14.4, t1: 19.5, say: '호라이즌 2에서 4는 4분기 납품이 목표이고, 채굴동은 연말에 닫습니다.' },
    { t0: 19.9, t1: 27.9, say: '스위트워터 1은 1.4기가와트 변전소가 통전됐고, 1단계 300메가와트를 짓고 있습니다.' },
    { t0: 28.4, t1: DURATION, say: '확보 전력은 5.6기가와트입니다. 비공식 자료이며, 투자 조언이 아닙니다.' },
  ],
}

// ---- 시간 보간 도우미 ----
export const clamp01 = (x) => Math.min(1, Math.max(0, x))
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
export const lerp = (a, b, k) => a + (b - a) * k

export function shotAt(t) {
  return SHOTS.find((s) => t >= s.t0 && t < s.t1) ?? SHOTS[SHOTS.length - 1]
}

// 장면 경계의 페이드 정도(0=선명, 1=배경색으로 가림)
export function fadeAt(t) {
  const s = shotAt(t)
  let f = 0
  if (s.fadeIn) f = Math.max(f, 1 - clamp01((t - s.t0) / s.fadeIn))
  if (s.fadeOut) f = Math.max(f, clamp01((t - (s.t1 - s.fadeOut)) / s.fadeOut))
  return f
}
