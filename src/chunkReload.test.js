// 배포 직후 옛 페이지가 지워진 조각(청크)을 부르다 실패할 때 한 번만 새로고침하는지 확인
import { describe, it, expect } from 'vitest'
import { reloadOnce } from './chunkReload.js'

// sessionStorage 를 흉내 낸 작은 저장소
const memory = () => {
  const m = new Map()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }
}

describe('reloadOnce', () => {
  it('처음 실패하면 새로고침한다', () => {
    let reloads = 0
    expect(reloadOnce(memory(), 'index-A.js', () => reloads++)).toBe(true)
    expect(reloads).toBe(1)
  })

  it('새로고침한 뒤 같은 빌드에서 또 실패하면 다시 새로고침하지 않는다 (무한 새로고침 방지)', () => {
    const s = memory()
    let reloads = 0
    reloadOnce(s, 'index-A.js', () => reloads++)
    expect(reloadOnce(s, 'index-A.js', () => reloads++)).toBe(false)
    expect(reloads).toBe(1)
  })

  it('그 뒤 새 배포(다른 빌드)에서 실패하면 다시 한 번 새로고침한다', () => {
    const s = memory()
    let reloads = 0
    reloadOnce(s, 'index-A.js', () => reloads++)
    expect(reloadOnce(s, 'index-B.js', () => reloads++)).toBe(true)
    expect(reloads).toBe(2)
  })

  it('저장소를 못 쓰면(사생활 보호 모드 등) 새로고침하지 않는다', () => {
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    let reloads = 0
    expect(reloadOnce(broken, 'index-A.js', () => reloads++)).toBe(false)
    expect(reloads).toBe(0)
  })
})
