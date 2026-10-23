// 3D 캠퍼스 건물 라벨의 용량 한 줄
// 화면용 건물 값(view.js)에서 MW 가 0 이면 "모름·없음" → 보여 주지 않아야 함
//   (버그였던 것: NVIDIA 건물 라벨이 "~60 MW*0 MW gross" 로 붙어 나옴)
import { it, expect } from 'vitest'
import { buildingMwText, areaKeyOf, gpuTag, gpuLine } from './buildingLabel.js'

it.each([
  // [설명, 화면용 건물 값, 기대 문구]
  ['IT·전체 전력이 모두 공개된 건물', { it_mw: 50, gross_mw: 65 }, '50 MW IT / 65 MW gross'],
  ['전체 전력만 공개된 건물', { it_mw: 0, gross_mw: 80 }, '80 MW gross'],
  // NVIDIA 건물: 계약에 용량 약 60MW 만 밝힘(IT 기준인지 미공개) → 화면용 it_mw·gross_mw 가 0
  ['IT 기준 미공개 — 공개된 용량만', { it_mw: 0, disclosedMw: 60, gross_mw: 0 }, '~60 MW*'],
  ['공개된 용량과 전체 전력이 함께 있으면 / 로 구분', { it_mw: 0, disclosedMw: 60, gross_mw: 78 }, '~60 MW* / 78 MW gross'],
  ['용량을 하나도 모르면 빈 문자열', { it_mw: 0, gross_mw: 0 }, ''],
])('%s', (_, building, want) => {
  expect(buildingMwText(building)).toBe(want)
})

// 3D 전체 보기의 구역 라벨 종류 (계약 없는 건물 무리를 묶는 이름)
//   계획 건물이 채굴동 전력을 넘겨받으면 "AI 전환 예정"(convert), 아니면 "확장 예정 부지"(planned)
//   (버그였던 것: 커낼플랫츠 계획을 회사 발표대로 '액체냉각 전환'으로 고치자 라벨이 "확장 예정 부지"로 바뀜
//    — 예전 규칙은 공랭 건물만 전환으로 봤음)
const byId = {
  miners: { id: 'miners', kind: 'miner_hall' },                                   // 채굴동
  air: { id: 'air', kind: 'datahall_air' },                                       // 이미 있는 공랭 AI 홀
  cfLiquid: { id: 'cfLiquid', kind: 'datahall_liquid', replaces: 'miners' },      // 채굴동 → 액체냉각 (커낼플랫츠)
  airRetrofit: { id: 'airRetrofit', kind: 'datahall_air', replaces: 'miners' },   // 채굴동 → 공랭
  pgLiquid: { id: 'pgLiquid', kind: 'datahall_liquid', replaces: 'air' },         // AI 홀의 남는 전력을 쓰는 새 홀 (프린스조지 2027)
  newHall: { id: 'newHall', kind: 'datahall_liquid' },                            // 아무것도 넘겨받지 않는 새 건물
}
it.each([
  // [설명, 3D 블록(상태·종류·건물 id), 기대 라벨 종류]
  ['채굴동을 액체냉각으로 바꾸는 계획 → AI 전환 예정', { status: 'planned', kind: 'datahall_liquid', buildingId: 'cfLiquid' }, 'convert'],
  ['채굴동을 공랭으로 바꾸는 계획 → AI 전환 예정', { status: 'planned', kind: 'datahall_air', buildingId: 'airRetrofit' }, 'convert'],
  ['AI 홀 전력을 넘겨받는 새 홀 계획 → 확장 예정 부지', { status: 'planned', kind: 'datahall_liquid', buildingId: 'pgLiquid' }, 'planned'],
  ['넘겨받는 것 없는 새 건물 계획 → 확장 예정 부지', { status: 'planned', kind: 'datahall_liquid', buildingId: 'newHall' }, 'planned'],
  ['가동 중 채굴동 → 채굴 구역', { status: 'operating', kind: 'miner_hall', buildingId: 'miners' }, 'mining'],
  ['건설 중 액체냉각 → 액체냉각 구역', { status: 'under_construction', kind: 'datahall_liquid', buildingId: 'cfLiquid' }, 'liquid'],
  ['건설 중 공랭 → 공랭 구역', { status: 'under_construction', kind: 'datahall_air', buildingId: 'airRetrofit' }, 'air'],
])('구역 라벨: %s', (_, block, want) => {
  expect(areaKeyOf(block, byId)).toBe(want)
})

// 넘겨받는 채굴동이 이미 퇴역해 그 날짜의 건물 목록에 없어도 "AI 전환 예정"
//   (실제로 걸린 경우: 커낼플랫츠 채굴동은 2026-10 퇴역 → 3D 화면용 건물 목록에서 빠짐 → 라벨이 "확장 예정 부지"로 남았음)
//   그래서 세 번째 인자로 모든 건물(퇴역 포함, site._raw.buildings)을 받아 넘겨받는 건물의 종류를 찾음
it('구역 라벨: 넘겨받는 채굴동이 퇴역해 화면 목록에 없어도 → AI 전환 예정', () => {
  const visible = { cfLiquid: byId.cfLiquid }   // 그 날짜에 보이는 건물 (채굴동 없음)
  const all = { ...byId }                       // 퇴역한 건물까지 모두
  expect(areaKeyOf({ status: 'planned', kind: 'datahall_liquid', buildingId: 'cfLiquid' }, visible, all)).toBe('convert')
})

// 이름표·개요 칩의 GPU 표: 랙 단위 액체냉각 GPU(GB300 · Vera Rubin)가 알려진 건물에 붙임
//   (스위트워터 1단계 = Vera Rubin 설계 기준, Horizon 1~4 = GB300). 공랭 B300·Hopper·혼합 홀은 골랐을 때 GPU 줄로만
it.each([
  ['설계 기준 GPU (스위트워터)', { gpu: { model: 'Vera Rubin', count: null, basis: 'designed_for' } }, 'Vera Rubin'],
  ['Horizon 의 GB300 NVL72 → 짧게 GB300', { gpu: { model: 'GB300 NVL72', count: null } }, 'GB300'],
  ['모델명이 GB300 뿐이어도 GB300', { gpu: { model: 'GB300', count: null } }, 'GB300'],
  // 프린스조지 "GB300 액체냉각 홀"·캐널플래츠 "GB300 액체냉각 전환": 이름에 이미 GB300 → 표를 붙이면 "GB300 … GB300" 으로 두 번 나옴
  ['건물 이름에 이미 GB300 이 있으면 표 없음', { name: 'GB300 liquid-cooled hall', name_ko: 'GB300 액체냉각 홀', gpu: { model: 'GB300 NVL72', count: null } }, null],
  ['공랭 B300 은 표 없음', { gpu: { model: 'B300 (air-cooled)', count: null } }, null],
  ['여러 세대 혼합은 표 없음', { gpu: { model: 'H200 / B200 / B300 / MI350X (mixed)', count: 23000, basis: 'installed_or_ordered' } }, null],
  ['Hopper 는 표 없음', { gpu: { model: 'H100 / H200', count: 816 } }, null],
  ['GPU 정보가 없으면 없음', {}, null],
])('이름표 GPU 표: %s', (_, building, want) => {
  expect(gpuTag(building)).toBe(want)
})

// 건물을 골랐을 때의 GPU 한 줄: 모델 · 개수 · 근거 종류
it.each([
  ['설계 기준', { gpu: { model: 'Vera Rubin', count: null, basis: 'designed_for' } }, 'ko', 'GPU · Vera Rubin (설계 기준)'],
  ['설계 기준 (영어)', { gpu: { model: 'Vera Rubin', count: null, basis: 'designed_for' } }, 'en', 'GPU · Vera Rubin (designed for)'],
  ['설치·주문 포함 + 개수', { gpu: { model: 'B300', count: 23000, basis: 'installed_or_ordered' } }, 'ko', 'GPU · B300 × 23,000 (설치·주문 포함)'],
  ['모델만', { gpu: { model: 'GB300 NVL72', count: null } }, 'ko', 'GPU · GB300 NVL72'],
  ['GPU 정보 없음', {}, 'ko', ''],
])('GPU 줄: %s', (_, building, lang, want) => {
  expect(gpuLine(building, lang)).toBe(want)
})
