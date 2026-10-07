// =============================================================
// 데이터 모델 v2 스키마 (zod)
// -------------------------------------------------------------
// 원본(사람이 편집): data/companies.json, data/companies/<회사id>.json
// 빌드 결과(브라우저가 읽음): public/data/infra.json  ← scripts/build-data.mjs
// 검증: scripts/validate.mjs 가 이 스키마 + 추가 규칙(날짜 순서, 전력 합계 등)을 검사합니다.
// =============================================================
import { z } from 'zod'
import { STATUS } from './status.js'
import { isValidWhen } from './timeline.js'

export const Id = z.string().regex(/^[a-z0-9-]+$/, 'id 는 소문자-숫자-하이픈만')
export const Url = z.string().url()
const Hex = z.string().regex(/^#[0-9a-f]{6}$/i, '#rrggbb 형식')
const Iso2 = z.string().regex(/^[A-Z]{2}$/, 'ISO 국가 코드 2글자 (예: US, KR)')

// 날짜: '2026' | '2026-Q4' | '2026-H2' | '2026-08' | '2026-08-13'
export const When = z.string().refine(isValidWhen, '유효한 날짜: 2026 / 2026-Q4 / 2026-H2 / 2026-08 / 2026-08-13')

// reported = 실제 발표된 사실, target = 회사가 밝힌 목표, estimate = 우리가 추정
export const Basis = z.enum(['reported', 'target', 'estimate'])

// ---------- 회사 ----------
const ReportedMetric = z.object({
  key: z.string(),          // 예: contracted_arr_usd_bn
  value: z.number(),
  unit: z.string(),         // 예: USD bn, GPU, EH/s
  label_ko: z.string(),
  label_en: z.string(),
  as_of: When,
  source: Url,
}).strict()

// 코로케이션·임차 시설: 다른 회사가 짓고 소유한 데이터센터에 입주한 곳
// → 지도 핀·순위 합계에는 넣지 않고, 회사 정보에만 "병기" 합니다 (자체 캠퍼스와 이중 계산 방지)
const Colocation = z.object({
  name: z.string(),
  name_ko: z.string().optional(),
  country: Iso2,
  host: z.string(),                       // 시설 소유·운영사 (예: Equinix, Verne Global)
  mw: z.number().nonnegative().nullable(), // 발표된 규모 (미공개면 null)
  status: z.enum(STATUS),
  basis: Basis,
  note_ko: z.string().optional(),
  note_en: z.string().optional(),
  source: Url,
}).strict()

// 회사 단위 일정 (실적 발표 등) — "다가오는 일정" 패널·타임라인 눈금에 표시
const CompanyEvent = z.object({
  date: When,
  kind: z.enum(['earnings', 'contract', 'financing', 'other']),
  title_ko: z.string(),
  title_en: z.string(),
  basis: Basis,             // estimate = 회사 미확정(외부 추정)
  source: Url,
}).strict()

// 고객 계약 — 지도에서 고객 → 사이트 연결선으로 표시 (서명일 이후에만 보임)
const Contract = z.object({
  id: Id,
  customer: z.string(),                     // 고객 이름 (미공개 다수면 묶음 이름)
  customer_ko: z.string().optional(),
  value_usd_bn: z.number().positive().nullable(), // 총 계약 금액 (미공개면 null)
  term_years: z.number().positive().nullable(),
  signed: When,
  it_mw: z.number().positive().nullable(),  // 계약 IT 용량 (미공개면 null)
  sites: z.array(Id),                       // 연결할 사이트 (미공개면 빈 배열)
  buildings: z.array(Id).optional(),        // 연결할 건물 (있으면 패널에 표시)
  scope_ko: z.string().optional(),          // 지도 칩에 쓸 짧은 대상 이름 (예: 'Horizon 1–4')
  scope_en: z.string().optional(),
  color: Hex,                               // 연결선·배지 색 (가능하면 고객 회사 고유색)
  logo: z.enum(['microsoft', 'nvidia']).optional(), // 배지·핀에 붙일 고객 로고 (src/ui/logos)
  note_ko: z.string().optional(),
  note_en: z.string().optional(),
  source: Url,
}).strict()

export const Company = z.object({
  id: Id,
  name: z.string(),
  name_ko: z.string().optional(),
  // partner = 자기 사이트 없이 참여사로만 등장 (AI 랩·칩 회사·개발사·금융사) → 순위·그룹 칩에서 제외
  group: z.enum(['miner', 'neocloud', 'hyperscaler', 'korea', 'partner']),
  ticker: z.object({ symbol: z.string(), exchange: z.string() }).strict().optional(), // 비상장은 생략
  color: Hex,               // 회사색 모드의 핀 색 (파스텔, 상태색과 겹치지 않게)
  hq_country: Iso2,
  summary_ko: z.string(),
  summary_en: z.string(),
  metrics: z.array(ReportedMetric).default([]),
  colocations: z.array(Colocation).optional(), // 코로케이션 입주 시설 (지도·순위 미포함)
  events: z.array(CompanyEvent).optional(),    // 회사 단위 일정 (실적 발표 등)
  contracts: z.array(Contract).optional(),     // 고객 계약 (지도 연결선)
  sources: z.array(Url).min(1),
}).strict()

// 여러 회사가 함께하는 프로젝트 (예: Stargate = OpenAI·Oracle·SoftBank)
export const Program = z.object({
  id: Id,
  name: z.string(),
  name_ko: z.string().optional(),
  members: z.array(Id).min(1),
  sources: z.array(Url).min(1),
}).strict()

export const CompaniesFile = z.object({
  companies: z.array(Company).min(1),
  programs: z.array(Program).default([]),
}).strict()

// ---------- 건물 ----------
export const Phase = z.object({
  status: z.enum([...STATUS, 'retired']), // retired = 철거·전환 완료 → 화면에서 사라짐
  from: When,
  basis: Basis,
  source: Url,
}).strict()

export const Building = z.object({
  id: Id,
  name: z.string(),
  name_ko: z.string().optional(),
  kind: z.enum(['datahall_liquid', 'datahall_air', 'miner_hall']).optional(), // 없으면 회사 그룹 기본값
  it_mw: z.number().nonnegative().optional(),     // GPU 등 IT 장비 전력
  gross_mw: z.number().nonnegative().optional(),  // 냉각 포함 총 전력 (없으면 IT×PUE 추정)
  pue: z.number().min(1).max(2).optional(),       // IT→총 전력 환산 배수 (없으면 1.3). 지정하면 estimates[] 에 근거 필수
  mw_basis: z.enum(['it', 'gross', 'grid']),      // 회사가 어떤 기준으로 발표했는지
  phases: z.array(Phase).min(1),                  // ← 상태의 진실 (현재 상태는 계산)
  progress: z.number().min(0).max(1).optional(),  // 기준일(as_of) 시점 건설 진행률
  replaces: Id.optional(),                        // 기존 건물 전력을 넘겨받는 전환
  customer: z.string().optional(),
  gpu: z.object({ model: z.string(), count: z.number().nullable() }).strict().optional(),
  sources: z.array(Url).min(1),
}).strict()

// ---------- 사이트 ----------
const Party = z.object({
  company: Id,
  role: z.enum(['developer', 'owner', 'operator', 'tenant', 'end_user', 'financier']),
  share: z.number().min(0).max(1).optional(),
  source: Url,
}).strict()

const PowerStep = z.object({
  from: When,
  secured_mw: z.number().nonnegative(),   // 계통 연결 확보 전력
  energized_mw: z.number().nonnegative(), // 실제 통전된 전력
  basis: Basis,
  source: Url,
}).strict()

export const Site = z.object({
  id: Id,
  name: z.string(),
  name_ko: z.string().optional(),
  country: Iso2,
  admin1: z.string().regex(/^[A-Z]{2}-[A-Z0-9]{1,3}$/).optional(), // 예: US-TX, CA-BC, KR-31
  region: z.string(),
  coord: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    confidence: z.enum(['high', 'medium', 'low']),
    method: z.enum(['official_address', 'permit_parcel', 'utility_filing', 'city_centroid', 'county_centroid', 'region_centroid']),
    source: Url.optional(),
  }).strict(),
  primary: Id,                       // 핀 색·순위가 귀속되는 대표 회사
  parties: z.array(Party).min(1),    // 참여사 (개발·소유·운영·입주 등)
  program: Id.optional(),
  detail: z.enum(['full', 'lite']),  // full = 건물 단위 정밀, lite = MW·일정만
  announced: When,                   // 이 날짜 전에는 지도에 나타나지 않음
  acres: z.number().positive().nullable(),
  grid_operator: z.string(),
  cooling: z.string(),
  summary_ko: z.string(),
  summary_en: z.string(),
  power: z.array(PowerStep).min(1),
  substation: z.object({ voltage: z.string().optional() }).strict().default({}),
  buildings: z.array(Building),
  deliveries: z.array(z.object({
    what: z.string(), from: z.string(), eta: z.string(),
    status: z.enum(['in_progress', 'ordered', 'done']), source: Url,
  }).strict()),
  timeline: z.array(z.object({ date: z.string(), event: z.string(), event_en: z.string().optional(), source: Url }).strict()),
  estimates: z.array(z.object({ note: z.string(), note_en: z.string().optional(), source: Url }).strict()),
  sources: z.array(Url).min(1),
  confidence: z.enum(['high', 'medium', 'low']),
}).strict()

export const CompanySitesFile = z.object({
  company_id: Id,
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reviewed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sites: z.array(Site),
}).strict()

// 빌드 결과 (infra.json)
// 데이터 갱신 기록 — 언제 어떤 수치가 바뀌었는지 (신뢰 장치)
const ChangeItem = z.object({ ko: z.string(), en: z.string(), source: Url.optional() }).strict()
export const ChangelogFile = z.object({
  entries: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD'),
    items: z.array(ChangeItem).min(1),
  }).strict()).min(1),
}).strict()

export const InfraFile = z.object({
  schema_version: z.literal(2),
  as_of: z.string(),
  companies: z.array(Company),
  programs: z.array(Program),
  sites: z.array(Site.extend({ as_of: z.string() })),
  changelog: ChangelogFile.shape.entries.optional(),
}).strict()
