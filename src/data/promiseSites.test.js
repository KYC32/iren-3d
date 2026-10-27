// 경영진 약속 ↔ 캠퍼스 연결 (data/statements.json 의 site · building) 과 진행 숫자 — 실제 자료 검사
import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { StatementsFile } from './statementsSchema.js'

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const statements = read('../../data/statements.json')
const { sites } = read('../../data/companies/iren.json')

it('site 는 캠퍼스 목록에 있고, building 은 그 캠퍼스의 건물', () => {
  for (const p of statements.promises.filter((x) => x.site)) {
    const site = sites.find((s) => s.id === p.site)
    expect(site, p.id).toBeTruthy()
    if (p.building) expect(site.buildings.map((b) => b.id), p.id).toContain(p.building)
  }
})
it('캠퍼스 이름(또는 차일드레스의 Horizon 홀)이 든 약속은 모두 그 캠퍼스로 이어짐', () => {
  const names = { childress: /차일드레스|Horizon/, 'sweetwater-1': /스위트워터 1/, 'sweetwater-2': /스위트워터 2/, mackenzie: /매켄지/, 'canal-flats': /커낼플랫츠/ }
  let linked = 0
  for (const p of statements.promises) for (const [site, re] of Object.entries(names)) if (re.test(p.title_ko)) { expect(p.site, p.id).toBe(site); linked++ }
  expect(linked).toBeGreaterThanOrEqual(12)
})
it('스키마: building 만 있고 site 가 없으면 거부', () => {
  const p = statements.promises[0]
  const bad = { ...statements, promises: [{ ...p, site: undefined, building: 'horizon-1' }] }
  expect(StatementsFile.safeParse(bad).success).toBe(false)
})
it('2026년 AI 클라우드 480MW 약속의 진행 = FY26 10-K 의 운영 용량 약 40MW (2026-06-30 기준, 8/27 공시)', () => {
  const p = statements.promises.find((x) => x.id === 'p-ai-cloud-480mw-2026')
  expect(p.progress).toMatchObject({ published: '2026-08-27', amount: { value: 40, unit: 'MW', qualifier: 'about' } })
  expect(p.progress.url).toMatch(/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/1878848\//)
})
