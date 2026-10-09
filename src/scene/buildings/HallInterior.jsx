// =============================================================
// HallInterior — 선택한 데이터홀의 "속": 지붕을 걷어 낸 단면 + 줄지어 선 GPU 랙
// -------------------------------------------------------------
// 랙 수는 hallEstimate.js 의 추정치(블록마다 나눈 값)를 그대로 그립니다 → 모형 1개 = 실제 랙 1개(추정)
// 랙 수백 개를 InstancedMesh 하나로 그려 그리기 호출은 몸체 1번 + 앞면 LED 1번뿐입니다.
// 처음 열릴 때 랙이 줄 순서대로 바닥에서 솟아오르고(약 0.8초), 모션 감소 설정이면 바로 다 보입니다.
// 앞면 LED 는 조명 계산 없이 밝은 색이라 밤 모드에서 저절로 빛나 보입니다.
// =============================================================
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, MeshBasicMaterial, MeshStandardMaterial, Object3D } from 'three'
import { rackGrid } from '../rackLayout.js'
import { useReducedMotion } from '../useReducedMotion.js'

const FLOOR_Y = 0.15     // 바닥판 윗면 높이 (기단 위)
const RISE_SEC = 0.35    // 랙 하나가 솟는 시간
const STAGGER_SEC = 0.45 // 첫 줄과 마지막 줄의 시작 시간 차
const noHit = () => null // 마우스 판정 제외 (클릭은 건물 블록 그룹이 받음)
const dummy = new Object3D()

// 냉각 방식별 색: 액체냉각(NVL72) 랙은 짙은 남색 + 청록 LED, 공랭(HGX) 랙은 회청색 + 하늘색 LED
const LOOK = {
  liquid: { body: '#232b3d', led: '#55f0cc' },
  air: { body: '#3b4559', led: '#7cc0ff' },
}

export default function HallInterior({ w, d, h, racks, liquid }) {
  const grid = useMemo(() => rackGrid(w, d, racks), [w, d, racks])
  const s = grid.size
  const rackH = Math.min(h * 0.42, s * 3.7) // 실제 랙 비율(높이 ≈ 폭의 3.7배), 건물 높이의 42% 이하
  const look = liquid ? LOOK.liquid : LOOK.air
  // 높이 1짜리 상자를 바닥 기준으로 옮겨 둠 → scale.y 만 키우면 바닥에서 위로 자람
  const geo = useMemo(() => ({
    body: new BoxGeometry(2 * s, 1, s * 0.94).translate(0, 0.5, 0),
    led: new BoxGeometry(0.012, 1, s * 0.62).translate(0, 0.5, 0),
  }), [s])
  const mat = useMemo(() => ({
    body: new MeshStandardMaterial({ color: look.body, roughness: 0.55, metalness: 0.35 }),
    led: new MeshBasicMaterial({ color: look.led, toneMapped: false }),
  }), [look])
  useEffect(() => () => { geo.body.dispose(); geo.led.dispose() }, [geo])
  useEffect(() => () => { mat.body.dispose(); mat.led.dispose() }, [mat])

  const body = useRef(), led = useRef()
  const anim = useRef({ start: null, done: false })
  const reduced = useReducedMotion()

  // 랙마다 높이 비율 p(0~1) 로 행렬을 채움
  const place = (p) => {
    const rows = Math.max(1, grid.rows - 1)
    grid.racks.forEach((r, i) => {
      const k = typeof p === 'number' ? p : p(r.row / rows)
      const y = Math.max(0.001, k)
      dummy.position.set(r.x, FLOOR_Y, r.z)
      dummy.scale.set(1, rackH * y, 1)
      dummy.updateMatrix()
      body.current.setMatrixAt(i, dummy.matrix)
      dummy.position.set(r.x + r.face * (s + 0.007), FLOOR_Y + rackH * 0.12 * y, r.z)
      dummy.scale.set(1, rackH * 0.7 * y, 1)
      dummy.updateMatrix()
      led.current.setMatrixAt(i, dummy.matrix)
    })
    body.current.instanceMatrix.needsUpdate = true
    led.current.instanceMatrix.needsUpdate = true
  }
  // 배치가 바뀌면(다른 건물·다른 랙 수) 처음부터 다시 솟아오름
  useLayoutEffect(() => {
    if (!body.current || !led.current) return
    anim.current = { start: null, done: reduced }
    place(reduced ? 1 : 0)
    body.current.computeBoundingSphere()
    led.current.computeBoundingSphere()
  }, [grid, rackH, reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock }) => {
    const a = anim.current
    if (a.done || !body.current) return
    if (a.start == null) a.start = clock.elapsedTime
    const t = clock.elapsedTime - a.start
    // 줄 순서(0~1)만큼 늦게 시작해 RISE_SEC 동안 자람 (끝에서 살짝 감속)
    place((f) => { const k = Math.min(1, Math.max(0, (t - f * STAGGER_SEC) / RISE_SEC)); return 1 - (1 - k) ** 3 })
    if (t > STAGGER_SEC + RISE_SEC) a.done = true
  })

  if (!grid.racks.length) return null
  return (
    <group>
      {/* 바닥판: 밝은 회색 (랙이 잘 보이게) */}
      <mesh position={[0, FLOOR_Y - 0.01, 0]} receiveShadow raycast={noHit}>
        <boxGeometry args={[w - 0.2, 0.02, d - 0.2]} />
        <meshStandardMaterial color="#d6dbe4" roughness={0.9} />
      </mesh>
      <instancedMesh ref={body} args={[geo.body, mat.body, grid.racks.length]} castShadow receiveShadow raycast={noHit} />
      <instancedMesh ref={led} args={[geo.led, mat.led, grid.racks.length]} raycast={noHit} />
    </group>
  )
}
