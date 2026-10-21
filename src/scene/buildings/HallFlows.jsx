// =============================================================
// HallFlows — 전기·찬물·데워진 물이 도는 길을 따라 흐르는 점 (Horizon 모형 안 HZ_flows 의 꺾인 선)
// -------------------------------------------------------------
// 종류마다 InstancedMesh 하나 → 점 수백 개를 그리기 호출 3번으로. 모션 감소 설정이면 점이 제자리 (길만 보여 줌)
// 캠퍼스(HorizonHall)는 멀리서 보이게 굵은 점, 확대 창(HorizonViewer)은 가까이서 작은 점
// =============================================================
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { InstancedMesh, MeshBasicMaterial, Object3D, SphereGeometry } from 'three'
import { POWER_FLOW_COLOR } from '../powerFlow.js'
import { cumulative, pointAlong, flowDots } from '../horizonHall.js'

export const FLOW_COLORS = { power: POWER_FLOW_COLOR, supply: '#3d8bff', return: '#ff5a4a' }
const dummy = new Object3D()
const P = [0, 0, 0]

// radius = 점 반지름(m) · spacing = 점 간격(m) · speed = 흐르는 빠르기(m/초, 실제 유속이 아니라 보기 좋은 빠르기)
export default function HallFlows({ flows, reduced, radius = 0.6, spacing = 7, speed = 6 }) {
  const sets = useMemo(() => {
    const geo = new SphereGeometry(radius, 8, 6)
    return Object.entries(FLOW_COLORS).map(([kind, color]) => {
      const lines = flows[kind] ?? []
      const dots = flowDots(lines, spacing)
      const mesh = new InstancedMesh(geo, new MeshBasicMaterial({ color, toneMapped: false }), Math.max(1, dots.length))
      mesh.count = dots.length
      mesh.raycast = () => null
      mesh.frustumCulled = false   // 점이 매 프레임 움직여 경계 구가 맞지 않으므로 늘 그림
      return { lines, cums: lines.map(cumulative), dots, mesh, geo }
    })
  }, [flows, radius, spacing])
  useEffect(() => () => sets.forEach((x, i) => {
    x.mesh.material.dispose()
    x.mesh.dispose()
    if (i === 0) x.geo.dispose()   // 세 종류가 같은 공 모양을 같이 씀
  }), [sets])
  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.elapsedTime * speed
    for (const x of sets) {
      x.dots.forEach((dot, i) => {
        pointAlong(x.lines[dot.line], x.cums[dot.line], dot.offset + t, P)
        dummy.position.set(P[0], P[1], P[2])
        dummy.updateMatrix()
        x.mesh.setMatrixAt(i, dummy.matrix)
      })
      x.mesh.instanceMatrix.needsUpdate = true
    }
  })
  return sets.map((x, i) => <primitive key={i} object={x.mesh} />)
}
