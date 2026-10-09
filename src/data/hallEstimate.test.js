import { describe, it, expect } from 'vitest'
import { gpuProfile, estimateHall, contractRunRate, roundNice } from './hallEstimate.js'
import { buildInfra } from '../../scripts/build-data.mjs'

const raw = buildInfra()
const childress = raw.sites.find((s) => s.id === 'childress')
const pg = raw.sites.find((s) => s.id === 'prince-george')
const contracts = raw.companies.flatMap((c) => c.contracts ?? [])
const bld = (site, id) => site.buildings.find((b) => b.id === id)

describe('GPU 가정 고르기', () => {
  it('모델 이름으로 세대를 맞추고, 혼합 모델은 최신 세대 우선', () => {
    expect(gpuProfile({ gpu: { model: 'GB300 NVL72' } }).id).toBe('nvl72')
    expect(gpuProfile({ gpu: { model: 'B300 (air-cooled)' } }).id).toBe('hgx-blackwell')
    expect(gpuProfile({ gpu: { model: 'H200 / B200 / B300 / MI350X (mixed)' } }).id).toBe('hgx-blackwell')
    expect(gpuProfile({ gpu: { model: 'H100 / H200' } }).id).toBe('hgx-hopper')
  })
  it('모델 미발표는 냉각 방식으로 가정, 채굴 홀은 대상 아님', () => {
    expect(gpuProfile({ kind: 'datahall_liquid' })).toMatchObject({ id: 'nvl72', modelKnown: false })
    expect(gpuProfile({ kind: 'datahall_air' })).toMatchObject({ id: 'hgx-blackwell', modelKnown: false })
    expect(gpuProfile({ kind: 'miner_hall' })).toBeNull()
  })
})

describe('건물 속 추정 (estimateHall)', () => {
  it('Horizon 1: IT 50MW ÷ 2.0kW = GPU 25,000개 · NVL72 랙 348개', () => {
    const e = estimateHall(bld(childress, 'horizon-1'))
    expect(e).toMatchObject({ itMw: 50, itBasis: 'it', gpus: 25000, gpusReported: false, racks: 348 })
  })
  it('회사가 GPU 수를 발표한 건물은 그 값을 그대로 (프린스조지 23,000개)', () => {
    const e = estimateHall(bld(pg, 'pg-air'))
    expect(e.gpusReported).toBe(true)
    expect(e.gpus).toBe(23000)
    expect(e.racks).toBe(Math.ceil(23000 / 32))
  })
  it('가정 검산: 프린스조지 발표치(50MW·23,000개)의 GPU당 전력이 가정과 ±15% 안', () => {
    const kw = (50 * 1000) / 23000
    expect(Math.abs(kw - gpuProfile(bld(pg, 'pg-air')).kwPerGpu) / kw).toBeLessThan(0.15)
  })
  it('화면용 건물(IT 0 으로 채워진 값)도 같은 결과 — 0 은 "없음"으로 봄', async () => {
    const { viewInfra } = await import('./view.js')
    const { toMonth } = await import('./timeline.js')
    const v = viewInfra(raw, toMonth('2026-10'))
    const site = v.sites.find((s) => s.id === 'childress')
    expect(estimateHall(site.buildings.find((b) => b.id === 'horizon-1')).gpus).toBe(25000)
    const air = estimateHall({ kind: 'datahall_air', it_mw: 0, gross_mw: 130 }) // IT 미공개 → gross ÷ 1.3
    expect(air).toMatchObject({ itMw: 100, itBasis: 'gross', gpus: 50000 })
  })
  it('채굴 홀은 추정하지 않음', () => {
    expect(estimateHall(bld(childress, 'miners'))).toBeNull()
  })
})

describe('계약 기준 연 매출 (contractRunRate)', () => {
  it('Microsoft $9.7bn ÷ 5년 ÷ 200MW × 50MW ≈ 연 $485M', () => {
    const r = contractRunRate(bld(childress, 'horizon-1'), contracts)
    expect(r.usdM).toBeCloseTo(485, 5)
    expect(r.contract.id).toBe('microsoft-2025')
  })
  it('건물 하나뿐인 계약은 계약 전체가 그 건물 몫 (NVIDIA $3.4bn ÷ 5년 = 연 $680M)', () => {
    const r = contractRunRate(bld(childress, 'air-cooled-nvidia'), contracts)
    expect(r).toMatchObject({ whole: true, share: 1 })
    expect(r.usdM).toBeCloseTo(680, 5)
  })
  it('계약 금액·기간·용량 중 하나라도 없으면 계산하지 않음', () => {
    expect(contractRunRate(bld(childress, 'horizon-5'), contracts)).toBeNull()
    expect(contractRunRate({ id: 'x', it_mw: 10 }, [{ buildings: ['x'], value_usd_bn: 2.8, term_years: null, it_mw: null }])).toBeNull()
    expect(contractRunRate({ id: 'x', it_mw: 0 }, [{ buildings: ['x', 'y'], value_usd_bn: 2, term_years: 4, it_mw: 100 }])).toBeNull()
  })
})

it('화면용 반올림', () => {
  expect(roundNice(25347)).toBe(25000)
  expect(roundNice(348)).toBe(350)
  expect(roundNice(26)).toBe(26)
})

it('검산 기준 건물: GPU 수와 IT 전력을 함께 발표한 프린스조지 공랭 홀', async () => {
  const { referenceHall, fmtUsdM } = await import('./hallEstimate.js')
  const ref = referenceHall(raw.sites)
  expect(ref.site.id).toBe('prince-george')
  expect(ref.kwPerGpu).toBeCloseTo(2.17, 2)
  expect(fmtUsdM(485)).toBe('$485M')
  expect(fmtUsdM(1940)).toBe('$1.94bn')
})
