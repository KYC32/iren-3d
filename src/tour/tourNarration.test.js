// 자동 투어 음성 대본 시험 — 숫자 없음 · 이름은 한글 · 모든 단계 id 가 실제 대본에 있음 · 소리 파일이 지금 문장으로 만든 것
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { TOUR_NARRATION_KO } from './tourNarration.js'
import { buildTourSteps } from './tourSteps.js'
import { buildInfra } from '../../scripts/build-data.mjs'
import { viewInfra, asOfMonth } from '../data/view.js'

const raw = buildInfra()
const loadInfra = () => viewInfra(raw, asOfMonth(raw.as_of))   // 실제 데이터로 만든 화면 자료 (tourSteps.test.js 와 같은 방법)

describe('TOUR_NARRATION_KO', () => {
  it('숫자를 읽지 않음 (자막 숫자는 데이터와 함께 바뀌지만 소리는 미리 만든 것이라)', () => {
    for (const [id, say] of Object.entries(TOUR_NARRATION_KO)) expect(say, id).not.toMatch(/\d/)
  })
  it('영어는 AI 만 (이름은 한글로 써야 자연스럽게 읽음)', () => {
    for (const [id, say] of Object.entries(TOUR_NARRATION_KO)) {
      const latin = (say.match(/[A-Za-z]+/g) ?? []).filter((w) => w !== 'AI')
      expect(latin, id).toEqual([])
    }
  })
  it('대본의 모든 단계에 문장이 있고, 없는 단계 id 는 없음', () => {
    const steps = buildTourSteps(loadInfra(), 'ko')
    const ids = new Set(steps.map((s) => s.id))
    for (const id of ids) expect(TOUR_NARRATION_KO[id], id).toBeTruthy()
    for (const id of Object.keys(TOUR_NARRATION_KO)) expect(ids.has(id), id).toBe(true)
  })
})

// 소리 파일 목록: 문장 지문이 지금 문장과 같고, 소리가 단계 길이 안에 끝남
describe('public/audio/tour/manifest.json', () => {
  const p = new URL('../../public/audio/tour/manifest.json', import.meta.url)
  it('있으면: 문장마다 소리 파일이 있고 지금 문장으로 만든 것 · 단계 시간 안에 끝남', () => {
    if (!existsSync(p)) return
    const man = JSON.parse(readFileSync(p, 'utf8'))
    const dur = Object.fromEntries(buildTourSteps(loadInfra(), 'ko').map((s) => [s.id, s.dur / 1000]))
    for (const [id, say] of Object.entries(TOUR_NARRATION_KO)) {
      const clip = man.clips[id]
      expect(clip, `${id}: 소리 없음 — node scripts/narrate/tour.mjs`).toBeTruthy()
      expect(clip.hash, `${id}: 문장이 바뀜 — node scripts/narrate/tour.mjs 로 다시 만들 것`).toBe(createHash('sha1').update(say).digest('hex').slice(0, 12))
      expect(existsSync(new URL(`../../public${clip.src}`, import.meta.url)), id).toBe(true)
      expect(clip.sec, `${id}: ${clip.sec}초 > 단계 ${dur[id]}초`).toBeLessThanOrEqual(dur[id] - 0.5)
    }
  })
})
