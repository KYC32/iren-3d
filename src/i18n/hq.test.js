// 본사·경영진 발언 문구 사전(hq.js) — 한국어·영어 키가 똑같아야 함 (한쪽만 있으면 화면에 빈칸)
import { it, expect } from 'vitest'
import { hqText } from './hq.js'

// 객체의 모든 키 경로 ('status.kept', 'detail.late' …) 를 정렬해 돌려줌
const paths = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? paths(v, `${pre}${k}.`) : [`${pre}${k}`])).sort()

it('ko·en 키가 같음', () => expect(paths(hqText.en)).toEqual(paths(hqText.ko)))
it('칸 아래 안내 문구는 설계 그대로', () => {
  expect(hqText.ko.disclaimer).toBe("요약은 이 사이트가 원문을 보고 정리한 것 · '지켜짐'은 회사 보도자료·SEC 공시로 확인됐을 때만 · 비공식 · 투자 조언 아님")
})
it('판정 이름은 설계 그대로', () => {
  expect(hqText.ko.status).toEqual({ kept: '지켜짐', 'late-kept': '늦게 지켜짐', late: '늦어짐', withdrawn: '철회', pending: '기한 전' })
})
