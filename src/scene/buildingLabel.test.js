// 3D 캠퍼스 건물 라벨의 용량 한 줄
// 화면용 건물 값(view.js)에서 MW 가 0 이면 "모름·없음" → 보여 주지 않아야 함
//   (버그였던 것: NVIDIA 건물 라벨이 "~60 MW*0 MW gross" 로 붙어 나옴)
import { it, expect } from 'vitest'
import { buildingMwText, areaKeyOf, gpuTag, gpuLabel, gpuLine } from './buildingLabel.js'

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

// 이름표·개요 칩의 GPU 표 글자: GPU 모델을 아는 건물이면 액체냉각·공랭 상관없이 모두
//   모델의 짧은 이름 — 괄호 설명과 'NVL72' 같은 꼬리는 빼고, 모델이 여럿이면 '·' 로 이음
it.each([
  ['설계 기준 GPU (스위트워터)', { gpu: { model: 'Vera Rubin', count: null, basis: 'designed_for' } }, 'Vera Rubin'],
  ['Horizon 의 GB300 NVL72 → 짧게 GB300', { gpu: { model: 'GB300 NVL72', count: null } }, 'GB300'],
  ['모델명이 GB300 뿐이어도 GB300', { gpu: { model: 'GB300', count: null } }, 'GB300'],
  ['공랭 B300: 괄호 설명은 뺌 (차일드레스)', { gpu: { model: 'B300 (air-cooled)', count: null } }, 'B300'],
  ['공랭 B300: 괄호 설명은 뺌 (매켄지)', { gpu: { model: 'B300 (Blackwell Ultra)', count: null } }, 'B300'],
  ['Hopper 파일럿: 두 모델을 · 로', { gpu: { model: 'H100 / H200', count: 816 } }, 'H100·H200'],
  ['여러 세대 혼합: 모델을 모두 · 로 (프린스조지 공랭)', { gpu: { model: 'H200 / B200 / B300 / MI350X (mixed)', count: 23000, basis: 'installed_or_ordered' } }, 'H200·B200·B300·MI350X'],
  ['GPU 정보가 없으면 없음', {}, null],
])('GPU 표 글자: %s', (_, building, want) => {
  expect(gpuTag(building)).toBe(want)
})

// 이름표·개요 칩에 쓰는 이름과 표: 이름에 표와 같은 모델 글자가 있으면 이름에서 빼서 "GB300 … GB300" 처럼 두 번 나오지 않게
//   (예전엔 반대로 표를 뺐음 → 이름에 모델이 든 프린스조지 'GB300 액체냉각 홀'·매켄지 '공랭 B300 홀'만 표가 없었음)
it.each([
  ['이름에 모델이 없으면 이름 그대로', { name: 'Horizon 1', gpu: { model: 'GB300 NVL72' } }, 'ko', { name: 'Horizon 1', tag: 'GB300' }],
  ['이름 앞의 GB300 을 뺌 (프린스조지)', { name: 'GB300 liquid-cooled hall', name_ko: 'GB300 액체냉각 홀', gpu: { model: 'GB300 NVL72' } }, 'ko', { name: '액체냉각 홀', tag: 'GB300' }],
  ['영어 이름은 뺀 뒤 첫 글자를 대문자로', { name: 'GB300 liquid-cooled hall', name_ko: 'GB300 액체냉각 홀', gpu: { model: 'GB300 NVL72' } }, 'en', { name: 'Liquid-cooled hall', tag: 'GB300' }],
  ['이름 가운데의 B300 을 뺌 (매켄지)', { name: 'Air-cooled B300 halls', name_ko: '공랭 B300 홀', gpu: { model: 'B300 (Blackwell Ultra)' } }, 'ko', { name: '공랭 홀', tag: 'B300' }],
  ['이름 가운데의 B300 을 뺌 (매켄지, 영어)', { name: 'Air-cooled B300 halls', name_ko: '공랭 B300 홀', gpu: { model: 'B300 (Blackwell Ultra)' } }, 'en', { name: 'Air-cooled halls', tag: 'B300' }],
  ['괄호 속 모델은 괄호째 뺌 (Hopper 파일럿)', { name: 'Hopper GPU pilot (H100/H200)', name_ko: '초기 GPU 파일럿 (H100/H200)', gpu: { model: 'H100 / H200' } }, 'ko', { name: '초기 GPU 파일럿', tag: 'H100·H200' }],
  ['괄호 속 모델은 괄호째 뺌 (Hopper 파일럿, 영어)', { name: 'Hopper GPU pilot (H100/H200)', name_ko: '초기 GPU 파일럿 (H100/H200)', gpu: { model: 'H100 / H200' } }, 'en', { name: 'Hopper GPU pilot', tag: 'H100·H200' }],
  ['모델이 아닌 괄호는 그대로 (차일드레스 공랭)', { name: 'Air-cooled Blackwell (NVIDIA)', name_ko: '공랭 Blackwell (NVIDIA)', gpu: { model: 'B300 (air-cooled)' } }, 'ko', { name: '공랭 Blackwell (NVIDIA)', tag: 'B300' }],
  ['혼합 홀: 이름에 모델이 없으면 그대로', { name: 'Air-cooled GPU halls', name_ko: '공랭 GPU 홀', gpu: { model: 'H200 / B200 / B300 / MI350X (mixed)' } }, 'ko', { name: '공랭 GPU 홀', tag: 'H200·B200·B300·MI350X' }],
  ['GB300 속의 B300 은 다른 모델이라 빼지 않음', { name_ko: 'GB300 홀', gpu: { model: 'B300' } }, 'ko', { name: 'GB300 홀', tag: 'B300' }],
  ['이름이 모델뿐이면 이름을 두고 표는 뺌', { name: 'GB300', gpu: { model: 'GB300' } }, 'ko', { name: 'GB300', tag: null }],
  ['GPU 정보가 없으면 이름만', { name: 'Mining hall', name_ko: '채굴동' }, 'ko', { name: '채굴동', tag: null }],
])('이름표 이름·GPU 표: %s', (_, building, lang, want) => {
  expect(gpuLabel(building, lang)).toEqual(want)
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
