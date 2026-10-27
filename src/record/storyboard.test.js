// 영상 자막 시험 — 자막 숫자가 지금 자료와 같은지 (예전엔 글로 박아 둬서 '9개 사이트'·'2026.10.06 기준'이 낡았음)
import { describe, it, expect } from 'vitest'
import { buildCards, ogCard, DURATION } from './storyboard.js'
import { buildInfra } from '../../scripts/build-data.mjs'
import { viewInfra, asOfMonth } from '../data/view.js'
import { totalsAt, powerAt, siteMetricsAt } from '../data/timeline.js'

const raw = buildInfra()
const m = asOfMonth(raw.as_of)
const data = viewInfra(raw, m)
const total = totalsAt(data.observedRaw ?? data.raw, m)
const site = (id) => raw.sites.find((s) => s.id === id)
const text = (c) => [c.title, c.sub, c.text, c.note, ...(c.stats ?? [])].filter(Boolean).join(' ')

describe('buildCards — 자료로 만든 자막', () => {
  const ko = buildCards(data, 'ko')
  const en = buildCards(data, 'en')
  it('첫 제목의 사이트 수·확보 전력이 지금 자료와 같음', () => {
    expect(ko[0].sub).toContain(`${total.sites}개 사이트`)
    expect(ko[0].sub).toContain(`${Math.round(total.secured / 100) / 10}GW`)
    expect(en[0].sub).toContain(`${total.sites} sites`)
  })
  it('마무리 카드: 확보 전력 · 회사 지표 · 정보 기준일', () => {
    const outro = ko.find((c) => c.kind === 'outro')
    expect(outro.title).toContain(`${Math.round(total.secured / 100) / 10}GW`)
    expect(outro.note).toContain(`${raw.as_of.replaceAll('-', '.')} 기준`)
    expect(outro.stats.join(' ')).toContain('계약 ARR $4bn')
    expect(outro.stats.join(' ')).toContain('계약 잔액 ~$16.6bn')
    expect(en.find((c) => c.kind === 'outro').note).toContain(`as of ${raw.as_of}`)
  })
  it('캠퍼스 숫자: 차일드레스 계통·변전소·채굴동, 스위트워터 1 계통·통전 달', () => {
    const all = ko.map(text).join(' | ')
    expect(all).toContain(`계통 ${powerAt(site('childress'), m).secured}MW · 자사 변전소 ${site('childress').substation.voltage}`)
    expect(all).toContain(`채굴동 ${siteMetricsAt(site('childress'), m).mining}MW`)
    expect(all).toContain('1.4GW 변전소 통전 완료 (2026.05)')
  })
  it('한국어 장면 제목은 공식 한국어 지명 (차일드레스 · 텍사스)', () => {
    expect(ko.filter((c) => c.kind === 'header').map((c) => c.title)).toEqual(['차일드레스 · 텍사스', '스위트워터 1 · 텍사스'])
    expect(en.filter((c) => c.kind === 'header').map((c) => c.title)).toEqual(['Childress, Texas', 'Sweetwater 1, Texas'])
  })
  it('시간표는 그대로 (카드 9장, 영상 안)', () => {
    expect(ko).toHaveLength(9)
    expect(ko.map((c) => c.kind)).toEqual(['title', 'header', 'caption', 'caption', 'caption', 'header', 'caption', 'caption', 'outro'])
    for (const c of [...ko, ...en]) expect(c.t0 < c.t1 && c.t1 <= DURATION).toBe(true)
  })
})

describe('ogCard — 링크 미리보기 문구', () => {
  it('사이트 수가 지금 자료와 같음', () => {
    expect(ogCard(data, 'ko').sub).toContain(`${total.sites}개 사이트`)
    expect(ogCard(data, 'en').sub).toContain(`${total.sites} sites`)
  })
})
