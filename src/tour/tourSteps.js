// =============================================================
// tourSteps.js — 자동 투어의 "대본": 어디를 보여 주고 무엇을 말할지 (순수 함수 → tourSteps.test.js)
// -------------------------------------------------------------
// 처음 온 투자자가 90초 안에 "IREN 이 어디에 무엇을 갖고 있고, 돈은 어디서 나오며, 다음은 무엇인가"를
// 알도록 지도 → 주요 캠퍼스 3D → 계약·건물 → 전망 순서로 안내합니다.
// 자막 숫자는 화면 데이터에서 그때그때 계산하므로 데이터가 갱신되면 투어도 같이 바뀝니다.
// TourPlayer 가 한 단계씩 store 액션으로 옮기고(지도 이동·3D 진입·구역·건물 선택·날짜·하늘) 자막을 띄웁니다.
//
// 단계 모양: { id, surface:'map'|'3d', site?, region?, zone?, building?, sky?, month?, dur(ms), title, text }
// =============================================================
import { totalsAt, siteMetricsAt } from '../data/timeline.js'
import { contractProgress } from '../data/contracts.js'
import { growthPath } from '../data/outlook.js'
import { milestonesAt } from '../data/research.js'
import { fmtMw } from '../data/format.js'

const SEC = 1000

// 회사 ARR 지표가 있으면 꺼냄 (companies.json 의 metrics[])
const metric = (company, key) => company?.metrics?.find((m) => m.key === key)?.value ?? null

export function buildTourSteps(data, lang = 'ko') {
  const ko = lang === 'ko'
  const month = data.month
  const site = (id) => data.sites.find((s) => s.id === id)
  const name = (s) => (s ? (ko && s.name_ko ? s.name_ko : s.name) : '')
  const siteMetrics = (s) => siteMetricsAt(s._raw, month) // 그 날짜의 사이트 합계 (확인 기록 기준)
  const contracts = data.companies.flatMap((c) => c.contracts ?? [])
  const progress = contractProgress(data.sites, contracts)
  const total = totalsAt(data.observedRaw ?? data.raw, month)
  const path = growthPath(data.raw)
  const company = data.companies[0]
  const steps = []

  // 1) 전체 그림
  steps.push({
    id: 'intro', surface: 'map', region: 'NA', dur: 7 * SEC,
    title: ko ? 'IREN 한눈에' : 'IREN at a glance',
    text: ko
      ? `사이트 ${total.sites}곳 · 확보 전력 ${fmtMw(total.secured)} · AI 가동 ${fmtMw(total.ai)} · 채굴 ${fmtMw(total.mining)}. 비트코인 채굴 회사에서 AI 데이터센터 회사로 바뀌는 중입니다.`
      : `${total.sites} sites · ${fmtMw(total.secured)} secured · ${fmtMw(total.ai)} AI live · ${fmtMw(total.mining)} mining. A bitcoin miner turning into an AI data center company.`,
  })

  // 2) 칠드레스: 지도 → 3D → Microsoft 구역 → Horizon 1 속 → NVIDIA 구역 → 밤
  const ch = site('childress')
  if (ch) {
    const m = siteMetrics(ch)
    steps.push({
      id: 'childress-map', surface: 'map', site: 'childress', dur: 6 * SEC,
      title: `${name(ch)} · ${ch.region}`,
      text: ko
        ? `가장 큰 가동 캠퍼스. 계통 ${fmtMw(ch.grid_mw)} 확보, 자체 변전소. 채굴동을 AI 데이터홀로 바꾸고 있습니다.`
        : `The largest operating campus: ${fmtMw(ch.grid_mw)} grid power and its own substation. Mining halls are being converted into AI data halls.`,
    })
    steps.push({
      id: 'childress-3d', surface: '3d', site: 'childress', dur: 8 * SEC,
      title: ko ? '건물로 보는 현황' : 'Status by building',
      text: ko
        ? `지붕색이 상태입니다. 가동 ${fmtMw(m.operating)} · 건설·시운전 ${fmtMw(m.building)} · 계획 ${fmtMw(m.planned)}. 블록 1칸은 같은 전력(MW)을 뜻합니다.`
        : `Roof color = status. Live ${fmtMw(m.operating)} · building / commissioning ${fmtMw(m.building)} · planned ${fmtMw(m.planned)}. Each block is the same amount of power.`,
    })
    const ms = progress.find((k) => k.id === 'microsoft-2025')
    if (ms && ms.known) {
      const live = Math.round((ms.stages.live / (ms.total || 1)) * 100)
      steps.push({
        id: 'childress-microsoft', surface: '3d', site: 'childress', zone: 'microsoft', dur: 8 * SEC,
        title: ko ? 'Microsoft 계약 구역' : 'Microsoft contract zone',
        text: ko
          ? `$${ms.value_usd_bn}bn · ${ms.term_years}년 · ${ms.total}MW IT (Horizon 1~4). 지금 매출 단계(인수·가동)는 ${live}%, 나머지는 시운전·건설 중입니다.`
          : `$${ms.value_usd_bn}bn over ${ms.term_years} years for ${ms.total} MW IT (Horizon 1–4). ${live}% is at revenue stage; the rest is commissioning or under construction.`,
      })
    }
    const h1 = ch.buildings.find((b) => b.id === 'horizon-1')
    if (h1 && ['delivered', 'operating', 'commissioning'].includes(h1.status)) {
      steps.push({
        id: 'childress-horizon-1', surface: '3d', site: 'childress', building: 'horizon-1', dur: 8 * SEC,
        title: ko ? '건물 속 · MW 를 GPU 로' : 'Inside a hall · MW to GPUs',
        text: ko
          ? `${name(h1)} ${h1.it_mw} MW IT. 지붕을 열면 추정 GPU 랙이 보입니다 — 캠퍼스 패널의 카드에 GPU 수·랙 수·계약 기준 연 매출 환산(모두 추정)이 있습니다.`
          : `${name(h1)}, ${h1.it_mw} MW IT. With the roof off you see the estimated GPU racks — the campus panel card converts it to GPUs, racks and contract run-rate (all estimates).`,
      })
    }
    const nv = progress.find((k) => k.id === 'nvidia-2026')
    const nvTarget = milestonesAt(data.raw.research, 'childress', month, 'air-cooled-nvidia').find((x) => !x.completion)
    if (nv && nv.known) {
      steps.push({
        id: 'childress-nvidia', surface: '3d', site: 'childress', zone: 'nvidia', dur: 7 * SEC,
        title: ko ? 'NVIDIA 계약 구역' : 'NVIDIA contract zone',
        text: ko
          ? `$${nv.value_usd_bn}bn · ${nv.term_years}년 · 공랭 Blackwell ${nv.total ? `${nv.total}MW` : ''}.${nvTarget?.latest?.target ? ` 목표 ${nvTarget.latest.target}.` : ''} 기존 공랭 설비를 다시 쓰는 전환입니다.`
          : `$${nv.value_usd_bn}bn over ${nv.term_years} years, air-cooled Blackwell${nv.total ? ` ${nv.total} MW` : ''}.${nvTarget?.latest?.target ? ` Target ${nvTarget.latest.target}.` : ''} A retrofit of existing air-cooled halls.`,
      })
    }
    steps.push({
      id: 'childress-night', surface: '3d', site: 'childress', sky: 'night', dur: 7 * SEC,
      title: ko ? '밤에 보면' : 'At night',
      text: ko
        ? '불 켜진 건물만 이 날짜에 가동 중입니다 (하늘색 = AI, 주황 = 채굴, 희미한 불 = 시운전). 상단 하늘 버튼으로 언제든 바꿀 수 있습니다.'
        : 'Only buildings that are live on this date are lit (blue = AI, orange = mining, dim = commissioning). Use the sky buttons in the top bar any time.',
    })
  }

  // 3) 스위트워터 1: 다음 성장 엔진
  const sw = site('sweetwater-1')
  if (sw) {
    const next = milestonesAt(data.raw.research, 'sweetwater-1', month).find((x) => !x.completion)
    steps.push({
      id: 'sweetwater-map', surface: 'map', site: 'sweetwater-1', dur: 6 * SEC,
      title: `${name(sw)} · ${sw.region}`,
      text: ko
        ? `계통 ${fmtMw(sw.grid_mw)} — ${sw.substation.status === 'energized' ? '변전소 통전 완료' : '변전소 통전 예정'}. 칠드레스보다 큰 다음 성장 엔진입니다.${next?.latest?.target ? ` 다음 목표 ${next.latest.target}.` : ''}`
        : `${fmtMw(sw.grid_mw)} grid — ${sw.substation.status === 'energized' ? 'substation energized' : 'substation pending'}. The next growth engine, larger than Childress.${next?.latest?.target ? ` Next target ${next.latest.target}.` : ''}`,
    })
    const swm = siteMetrics(sw)
    steps.push({
      id: 'sweetwater-3d', surface: '3d', site: 'sweetwater-1', dur: 7 * SEC,
      title: ko ? '건설 현장' : 'Under construction',
      text: ko
        ? `건설·시운전 ${fmtMw(swm.building)} · 계획 ${fmtMw(swm.planned)}. 점선 칸은 용도가 아직 발표되지 않은 전력입니다.`
        : `Building / commissioning ${fmtMw(swm.building)} · planned ${fmtMw(swm.planned)}. Dashed blocks are power without an announced use yet.`,
    })
  }

  // 4) 캐나다: 작은 사이트들을 AI 로 전환
  const bc = ['prince-george', 'mackenzie', 'canal-flats'].map(site).filter(Boolean)
  if (bc.length) {
    const pg = site('prince-george')
    steps.push({
      id: 'bc-map', surface: 'map', region: 'CA', dur: 7 * SEC,
      title: ko ? '브리티시컬럼비아 3곳' : 'British Columbia, 3 sites',
      text: ko
        ? `${bc.map((s) => `${name(s)} ${fmtMw(s.grid_mw)}`).join(' · ')}. 수력 전력의 기존 채굴 사이트를 GPU 클라우드로 바꾸는 중${pg ? ` — ${name(pg)}는 GPU 납품 완료, ${pg.status === 'commissioning' ? '시운전' : '가동'} 단계` : ''}.`
        : `${bc.map((s) => `${name(s)} ${fmtMw(s.grid_mw)}`).join(' · ')}. Hydro-powered mining sites being converted to GPU cloud${pg ? ` — ${name(pg)} has its GPUs delivered and is ${pg.status === 'commissioning' ? 'commissioning' : 'live'}` : ''}.`,
    })
  }

  // 5) 확장 부지: 카이오와 · 스페인 · 호주
  const expansions = ['kiowa', 'badajoz', 'bundey'].map(site).filter(Boolean)
  if (expansions.length) {
    steps.push({
      id: 'expansion-map', surface: 'map', region: 'ALL', dur: 7 * SEC,
      title: ko ? '확장 부지' : 'Expansion sites',
      text: ko
        ? `${expansions.map((s) => `${name(s)} ${fmtMw(s.grid_mw)}`).join(' · ')}. 아직 전력 확보·계획 단계 — 실제 건설 여부를 채용 공고와 회사 발표로 추적합니다.`
        : `${expansions.map((s) => `${name(s)} ${fmtMw(s.grid_mw)}`).join(' · ')}. Still at the power-secured / planning stage — construction is tracked through job postings and company updates.`,
    })
  }

  // 6) 전망: 회사 목표대로 진행했을 때 연말 AI 가동
  const last = path.at(-1)
  if (last) {
    const arr = metric(company, 'contracted_arr_usd_bn')
    steps.push({
      id: 'outlook', surface: 'map', region: 'NA', month: last.month, dur: 8 * SEC,
      title: ko ? '회사 목표 기준 전망' : 'Outlook on company targets',
      text: ko
        ? `타임라인을 ${last.year}년 말로 옮기면 목표대로 진행했을 때의 모습입니다: AI 가동 ${path.map((p) => `${p.year} ${fmtMw(p.ai)}`).join(' → ')}.${arr ? ` 계약 ARR 목표 $${arr}bn.` : ''} 실제 진행은 다를 수 있습니다.`
        : `With the timeline at end-${last.year}, this is the picture if targets are met: AI live ${path.map((p) => `${p.year} ${fmtMw(p.ai)}`).join(' → ')}.${arr ? ` ARR target $${arr}bn.` : ''} Actual progress may differ.`,
    })
  }

  // 7) 마무리
  steps.push({
    id: 'outro', surface: 'map', region: 'NA', dur: 7 * SEC,
    title: ko ? '직접 살펴보기' : 'Explore on your own',
    text: ko
      ? '왼쪽 목록에서 캠퍼스를 고르고, 마커를 눌러 3D 로 들어가세요. 타임라인은 과거엔 "그때 공개된 자료", 기준일 뒤엔 "회사 목표" 기준입니다. 비공식 자료 · 투자 조언 아님.'
      : 'Pick a campus from the list, click a marker to enter 3D. The timeline shows what was public at the time, and company targets after the as-of date. Unofficial · not investment advice.',
  })
  return steps
}

// 전체 길이 (초)
export const tourSeconds = (steps) => Math.round(steps.reduce((n, s) => n + s.dur, 0) / SEC)
