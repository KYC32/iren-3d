import { describe, it, expect } from 'vitest'
import { aoAllowed, aoSkipsDepth } from './aoPolicy.js'

const desktop = { width: 1440, coarse: false, campus: true, record: false, declined: false, forced: false }

describe('aoAllowed: 틈새 그늘을 켜는 조건', () => {
  it('데스크톱 캠퍼스 화면에서 켠다', () => {
    expect(aoAllowed(desktop)).toBe(true)
  })
  it('좁은 화면이나 터치 기기에서는 끈다', () => {
    expect(aoAllowed({ ...desktop, width: 767 })).toBe(false)
    expect(aoAllowed({ ...desktop, coarse: true })).toBe(false)
  })
  it('프레임이 떨어졌으면 끈다', () => {
    expect(aoAllowed({ ...desktop, declined: true })).toBe(false)
  })
  it('영상 녹화와 캠퍼스 밖 화면에서는 끈다', () => {
    expect(aoAllowed({ ...desktop, record: true })).toBe(false)
    expect(aoAllowed({ ...desktop, campus: false })).toBe(false)
  })
  it('확인용 주소는 기기 조건과 프레임 저하를 무시하지만 녹화에서는 켜지 않는다', () => {
    expect(aoAllowed({ ...desktop, width: 390, coarse: true, declined: true, forced: true })).toBe(true)
    expect(aoAllowed({ ...desktop, record: true, forced: true })).toBe(false)
  })
})

describe('aoSkipsDepth: 깊이 단계에서 빼는 물체', () => {
  it('불투명 메시는 남긴다', () => {
    expect(aoSkipsDepth({ isMesh: true, material: { transparent: false } })).toBe(false)
  })
  it('투명 메시는 뺀다', () => {
    expect(aoSkipsDepth({ isMesh: true, material: { transparent: true } })).toBe(true)
  })
  it('투명해도 그늘을 받는 땅은 남긴다', () => {
    expect(aoSkipsDepth({ isMesh: true, material: { transparent: true }, userData: { aoReceiver: true } })).toBe(false)
  })
  it('굵은 선은 불투명해도 뺀다 (재질을 덮어쓰면 큰 판으로 그려짐)', () => {
    expect(aoSkipsDepth({ isMesh: true, material: { isLineMaterial: true, transparent: false } })).toBe(true)
  })
  it('선·스프라이트·점은 뺀다', () => {
    for (const kind of ['isLine', 'isSprite', 'isPoints']) expect(aoSkipsDepth({ [kind]: true })).toBe(true)
  })
})
