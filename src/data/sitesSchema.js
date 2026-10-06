// sites.json 의 모양(스키마)을 zod 로 정의합니다.
// - 브라우저(loadSites.js)와 검증 스크립트(scripts/validate-sites.mjs)가 같은 스키마를 공유합니다.
// - 데이터를 손으로 고치다가 오타가 나면 빌드 전에 바로 잡아 줍니다.
import { z } from 'zod'

// 사이트/건물 상태 — 화면의 색과 애니메이션을 결정하는 핵심 enum
export const STATUS = ['operating', 'commissioning', 'under_construction', 'planned', 'decommissioning']
export const StatusEnum = z.enum(STATUS)

// 건물 종류 — 캠퍼스 뷰에서 외형이 달라집니다
export const BuildingKind = z.enum(['datahall_liquid', 'datahall_air', 'miner_hall'])

const Dates = z.object({
  energized: z.string().optional(), // 통전/가동 시작
  delivered: z.string().optional(), // 고객 인도 완료
  target: z.string().optional(),    // 목표 시점 (예정)
  end: z.string().optional(),       // 폐쇄 시점
}).strict()

const Building = z.object({
  id: z.string(),
  name: z.string(),
  name_ko: z.string().optional(),
  kind: BuildingKind,
  it_mw: z.number().nonnegative(),      // IT 부하 (GPU 가 쓰는 전력)
  gross_mw: z.number().nonnegative(),   // 냉각 포함 총 전력
  status: StatusEnum,
  progress: z.number().min(0).max(1).optional(), // 건설 진행률 0~1 (건설중일 때만)
  // 전환(conversion) 관계: 이 건물이 기존 건물(id)의 전력을 재사용해 들어서는 경우.
  // 예) Horizon 5·6 은 채굴동(miners) 전력을 넘겨받음 → 새 전력으로 이중 계산하지 않음
  replaces: z.string().optional(),
  customer: z.string().optional(),
  gpu: z.object({ model: z.string(), count: z.number().nullable() }).optional(),
  dates: Dates.default({}),
  sources: z.array(z.string().url()).min(1),
}).strict()

const Substation = z.object({
  mw: z.number().positive(),
  voltage: z.string().optional(),
  status: z.enum(['energized', 'planned']),
  dates: Dates.default({}),
}).strict()

const Delivery = z.object({
  what: z.string(),
  from: z.string(),
  eta: z.string(),
  status: z.enum(['in_progress', 'ordered', 'done']),
  source: z.string().url(),
}).strict()

const TimelineItem = z.object({
  date: z.string(),
  event: z.string(),
  event_en: z.string().optional(),
  source: z.string().url(),
}).strict()

const Estimate = z.object({
  note: z.string(),
  note_en: z.string().optional(),
  source: z.string().url(),
}).strict()

export const Site = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id 는 소문자-숫자-하이픈만'),
  name: z.string(),
  name_ko: z.string().optional(),
  country: z.enum(['US', 'CA', 'AU', 'ES']),
  region: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  coord_confidence: z.enum(['high', 'medium', 'low']),
  acres: z.number().positive().nullable(),
  grid_operator: z.string(),
  grid_mw: z.number().positive(),       // 계통 연결(확보) 전력
  status: StatusEnum,
  cooling: z.string(),
  summary_ko: z.string(),
  summary_en: z.string(),
  substation: Substation,
  buildings: z.array(Building),
  deliveries: z.array(Delivery),
  timeline: z.array(TimelineItem),
  estimates: z.array(Estimate),
  sources: z.array(z.string().url()).min(1),
  confidence: z.enum(['high', 'medium', 'low']),
}).strict()

export const SitesFile = z.object({
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  _readme: z.string().optional(),
  company: z.object({
    secured_power_mw: z.number(),
    operational_power_mw: z.number(),
    contracted_arr_usd_bn: z.number(),
    operating_arr_usd_bn: z.number(),
    backlog_usd_bn: z.number(),
    gpus_total: z.number(),
    fy26_revenue_usd_m: z.number(),
    mining_eh_s: z.number(),
    mining_shutdown_by: z.string(),
    next_earnings_est: z.string(),
    sources: z.array(z.string().url()).min(1),
  }).strict(),
  sites: z.array(Site).min(1),
}).strict()
