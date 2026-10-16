// =============================================================
// devMilestones.js — 부지 개발 이정표: 부지·전력 확보 → 통전 → 착공 → 가동
// -------------------------------------------------------------
// 건물이 아직 없는 개발 부지(카이오와·번디·바다호스·스위트워터 2)는 3D 에 빈 땅만 보여서
// "언제 돈이 되나"를 읽을 수 없었음 → 단계마다 지금 어디까지 왔는지를 보여 줌
//
// 단계마다 { key, state, when }
//   done    : 그 날짜까지 발표·확인된 사실 (확인 기록 화면의 전력 이력·건물 단계)
//   target  : 회사 목표 — 원본 이력에서 찾되, 지나간 달을 볼 때는 그 뒤에 알려진 목표가
//             미리 보이지 않게 기준일 이후 화면에서만 (firstEnergizedOf 와 같은 규칙)
//   unknown : 아직 발표되지 않음
// site: 3D 화면이 쓰는 사이트(확인 기록 화면이면 site._raw — 원본은 site._layoutSource), m: 보고 있는 달
// =============================================================
import { firstEnergizedOf, phaseMonth, toMonth } from '../data/timeline.js'

const BUILT = { construction: ['under_construction'], operating: ['operating', 'delivered'] }

export function devMilestones(site, m) {
  const asOf = toMonth(String(site.as_of).slice(0, 7))
  const source = site._layoutSource ?? site
  // 건물 단계 중 그 상태가 처음 나온 기록 (done = 지금 화면의 기록, target = 원본의 회사 목표)
  const firstPhase = (buildings, statuses, ok) => buildings.flatMap((b) => b.phases)
    .filter((p) => statuses.includes(p.status) && ok(p))
    .sort((a, b) => phaseMonth(a) - phaseMonth(b))[0]
  const built = (key) => {
    const done = firstPhase(site.buildings, BUILT[key], (p) => p.basis === 'reported' && phaseMonth(p) <= m)
    if (done) return { key, state: 'done', when: done.from }
    const target = m >= asOf ? firstPhase(source.buildings, BUILT[key], (p) => p.basis === 'target') : null
    return target ? { key, state: 'target', when: target.from } : { key, state: 'unknown' }
  }
  const secured = site.power.find((p) => p.secured_mw > 0)
  const energized = firstEnergizedOf(site, m)
  return [
    secured ? { key: 'secured', state: 'done', when: secured.from } : { key: 'secured', state: 'unknown' },
    energized ? { key: 'energized', state: energized.basis === 'reported' ? 'done' : 'target', when: energized.from } : { key: 'energized', state: 'unknown' },
    built('construction'),
    built('operating'),
  ]
}
