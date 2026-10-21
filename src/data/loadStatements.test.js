// 경영진 발언 자료(public/data/statements.json) 받기 — 한 번만 받고, 못 받으면 null (화면은 오류 문구로)
import { beforeEach, afterEach, it, expect, vi } from 'vitest'

beforeEach(() => vi.resetModules()) // 모듈 안 캐시를 매번 새로 (테스트끼리 섞이지 않게)
afterEach(() => vi.unstubAllGlobals())

it('loadStatements 는 실패하면 null (오프라인·404)', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  expect(await (await import('./loadStatements.js')).loadStatements()).toBeNull()
})
it('loadStatements 는 404 같은 실패 응답도 null', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
  expect(await (await import('./loadStatements.js')).loadStatements()).toBeNull()
})
it('loadStatements 는 한 번만 받음', async () => {
  const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ checkedAt: '2026-10-21' }) }); vi.stubGlobal('fetch', f)
  const m = await import('./loadStatements.js'); await m.loadStatements(); await m.loadStatements()
  expect(f).toHaveBeenCalledTimes(1); expect(m.peekStatements()).toEqual({ checkedAt: '2026-10-21' })
})
it('실패한 뒤 다시 부르면 다시 받음 (칸을 닫았다 열면 재시도)', async () => {
  const f = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ok: true, json: async () => ({ checkedAt: '2026-10-21' }) }); vi.stubGlobal('fetch', f)
  const m = await import('./loadStatements.js')
  expect(await m.loadStatements()).toBeNull()
  expect(await m.loadStatements()).toEqual({ checkedAt: '2026-10-21' }); expect(f).toHaveBeenCalledTimes(2)
})
