// 3D 캠퍼스 건물 라벨의 용량 한 줄
// 화면용 건물 값(view.js)에서 MW 가 0 이면 "모름·없음" → 보여 주지 않아야 함
//   (버그였던 것: NVIDIA 건물 라벨이 "~60 MW*0 MW gross" 로 붙어 나옴)
import { it, expect } from 'vitest'
import { buildingMwText } from './buildingLabel.js'

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
