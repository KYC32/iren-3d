// 자동 투어 단계 적용(applyStep) — 모바일에서 캠퍼스 패널을 언제 펼치고 접는지 확인
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'

const raw = buildInfra()
let store, applyStep
beforeEach(async () => {
  vi.resetModules()
  // 폭 390px 휴대폰 화면처럼 꾸밈 (스토어는 이 폭을 보고 패널을 접은 채 시작함)
  vi.stubGlobal('window', { innerWidth: 390, location: { hash: '', pathname: '/', search: '' }, history: { replaceState: vi.fn() } })
  vi.stubGlobal('navigator', { language: 'ko' })
  store = (await import('../store/useAppStore.js')).useAppStore
  applyStep = (await import('./TourPlayer.jsx')).applyStep
  store.getState().setRaw(raw)
})
afterEach(() => vi.unstubAllGlobals())

it('모바일 투어의 건물 속 단계는 패널 카드를 보이도록 패널을 펼친다 (새로 진입)', () => {
  applyStep({ surface: '3d', site: 'childress', building: 'horizon-1' })
  expect(store.getState().selectedBuildingId).toBe('horizon-1')
  expect(store.getState().campusPanelCollapsed).toBe(false)
})

it('같은 캠퍼스에 머문 채 건물 속 단계로 넘어가도 패널을 펼친다', () => {
  applyStep({ surface: '3d', site: 'childress' })
  expect(store.getState().campusPanelCollapsed).toBe(true) // 일반 3D 단계는 접힘
  applyStep({ surface: '3d', site: 'childress', building: 'horizon-1' })
  expect(store.getState().campusPanelCollapsed).toBe(false)
})
