// 건물·관찰 데이터가 가리키는 "안 자세히 보기" 그림이 실제로 있는지 검사
// — figure 값만 넣고 그림 페이지(public/figures/<이름>.<ko|en>.html)를 만들지 않으면 대화상자가 빈 화면이 됨
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { buildInfra } from '../../scripts/build-data.mjs'

const infra = buildInfra()
// 모든 건물 (사이트 → 건물)
const buildings = infra.sites.flatMap((s) => (s.buildings ?? []).map((b) => ({ site: s.id, ...b })))
const pageOf = (name, lang) => new URL(`../../public/figures/${name}.${lang}.html`, import.meta.url)

describe('building figures', () => {
  it('every figure a building opens has both Korean and English pages', () => {
    const names = [...new Set(buildings.map((b) => b.figure).filter(Boolean))]
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) for (const lang of ['ko', 'en']) expect(existsSync(pageOf(name, lang)), `${name}.${lang}.html`).toBe(true)
  })
  it('Horizon 1–4 (GB300 liquid-cooled halls for Microsoft) open the Horizon hall figure', () => {
    const horizons = buildings.filter((b) => /^horizon-[1-4]$/.test(b.id))
    expect(horizons).toHaveLength(4)
    for (const b of horizons) expect(b.figure, b.id).toBe('horizon-hall')
  })
})
