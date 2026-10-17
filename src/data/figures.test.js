// 건물·관찰 데이터가 가리키는 "안 자세히 보기" 그림이 실제로 있는지 검사
// — figure 값만 넣고 그림 페이지(public/figures/<이름>.<ko|en>.html)를 만들지 않으면 대화상자가 빈 화면이 됨
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
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
  it('Sweetwater 1 phase 1 (liquid-cooled, Vera Rubin-ready) opens the substation-to-hall figure', () => {
    const phase1 = buildings.find((b) => b.id === 'sw1-phase1')
    expect(phase1?.site).toBe('sweetwater-1')
    expect(phase1.figure).toBe('sweetwater-1')
  })
})

// 스위트워터 그림의 '회사 확인' 보기: 회사가 밝힌 변전소는 색 그대로, 밝히지 않은 홀 안·냉각 설비·다음 단계 자리는 하얗게
//   (하얗게 칠할 부품은 빌드가 <g data-drawn> 으로 감쌈 — 구역 단위라 변전소 부품은 하나도 감싸지 않아야 함)
describe('Sweetwater company-confirmed view', () => {
  const html = (lang) => readFileSync(pageOf('sweetwater-1', lang), 'utf8')
  it('has the view toggle in both languages', () => {
    for (const lang of ['ko', 'en']) expect(html(lang), lang).toContain('data-view-btn="confirmed"')
  })
  it('whitens the undisclosed hall interior and cooling plant but never the substation', () => {
    const page = html('ko')
    for (const key of ['rack', 'cdu', 'drycooler', 'pumps', 'future']) expect(page, key).toContain(`<g data-drawn><g data-info="${key}">`)
    for (const key of ['xfmr', 'breaker', 'bus345', 'primary', 'line']) expect(page, key).not.toContain(`<g data-drawn><g data-info="${key}">`)
  })
})
