// =============================================================
// MergedParts — 조각 목록(partOf 로 만든 것)을 합쳐서 그리는 React 부품
// -------------------------------------------------------------
// 같이 움직이는 조각들을 이 부품 하나로 감싸면, 겉모습이 같은 조각끼리 메시 하나로 합쳐 그림 (mergeStatic.js)
//   예) 소 머리: 조각 12개 → 메시 1개. 머리가 숙여질 때는 감싼 group 하나만 돌리면 됨
// parts 는 부르는 쪽에서 useMemo 로 만들어 넘김 (바뀔 때만 다시 합침)
// 개발 서버에서 ?nomerge 이면 합치지 않고 조각마다 메시 하나씩 그림 (전후 비교용)
// =============================================================
import { useEffect, useMemo } from 'react'
import { Quaternion, Vector3 } from 'three'
import { mergeParts, MERGE_ON } from './mergeStatic.js'

export default function MergedParts({ parts }) {
  const meshes = useMemo(() => {
    if (MERGE_ON) return mergeParts(parts)
    // 비교용: 조각마다 원래 자리(위치·회전·배율)로 하나씩
    return parts.map((p) => {
      const position = new Vector3(), quaternion = new Quaternion(), scale = new Vector3()
      p.matrix.decompose(position, quaternion, scale)
      return { ...p, position, quaternion, scale, borrowed: true }
    })
  }, [parts])
  // 화면에서 사라지거나 다시 합칠 때: 여기서 새로 만든 모양·재질만 GPU 메모리에서 정리 (원래 재질·모양은 주인이 정리)
  useEffect(() => () => meshes.forEach((m) => {
    if (m.borrowed) return
    m.geometry.dispose()
    if (m.ownMaterial) m.material.dispose()
  }), [meshes])
  return meshes.map((m, i) => (
    // dispose={null}: 정리는 위 useEffect 가 맡음 (원래 재질을 R3F 가 멋대로 버리지 않게)
    // 합친 메시는 꼭짓점이 이미 제자리에 구워져 있어 위치·회전·배율을 주지 않음 (비교용 낱개만 줌)
    <mesh key={i} geometry={m.geometry} material={m.material} castShadow={m.castShadow} receiveShadow={m.receiveShadow}
      {...(m.borrowed ? { position: m.position, quaternion: m.quaternion, scale: m.scale } : {})} dispose={null} />
  ))
}
