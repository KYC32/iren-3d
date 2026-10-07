// 보드판(국가 카드) 설정 검사 — 사이트 데이터가 바뀌어도 지도에서 사라지는 사이트가 없게
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { BOARDS, boardPos, insideBoard, projectToBoard } from './boards.js'

const iren = JSON.parse(readFileSync(new URL('../../data/companies/iren.json', import.meta.url), 'utf8'))
const hex = JSON.parse(readFileSync(new URL('../../public/data/board-hex.json', import.meta.url), 'utf8'))

describe('국가 카드', () => {
  it('모든 사이트가 자기 나라 카드 안에 (가장자리 여백 1단위 이상) 들어간다', () => {
    for (const s of iren.sites) {
      const p = projectToBoard(s.coord.lat, s.coord.lng, s.country)
      // 실패하면: 새 나라의 사이트 → boards.js 의 BOARDS 에 카드를 추가하고 npm run geo
      expect(p, `${s.id}(${s.country}) 를 놓을 카드가 없음`).not.toBeNull()
      expect(p.board.country).toBe(s.country)
      expect(insideBoard(p.board, s.coord.lat, s.coord.lng, 1), `${s.id} 가 카드 가장자리에 너무 붙음`).toBe(true)
    }
  })

  it('카드끼리 서로 겹치지 않는다', () => {
    const rects = BOARDS.map((b) => {
      const [x, z] = boardPos(b.id)
      return { id: b.id, x0: x - b.w / 2, x1: x + b.w / 2, z0: z - b.d / 2, z1: z + b.d / 2 }
    })
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j]
        const overlap = a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0
        expect(overlap, `${a.id} 와 ${b.id} 가 겹침`).toBe(false)
      }
    }
  })

  it('사전계산 타일(board-hex.json)이 지금 설정과 맞고, 카드마다 강조 타일이 있다', () => {
    for (const b of BOARDS) {
      const flat = hex.boards[b.id]
      // 실패하면: boards.js 를 바꾼 뒤 npm run geo 를 다시 돌리지 않은 것
      expect(flat?.length, `${b.id} 타일 없음 — npm run geo`).toBeGreaterThan(0)
      expect(hex.res[b.id]).toBe(b.res)
      const focus = flat.filter((v, i) => i % hex.stride === 2 && v === 1).length
      expect(focus, `${b.id} 강조 타일 없음`).toBeGreaterThan(0)
    }
  })
})
