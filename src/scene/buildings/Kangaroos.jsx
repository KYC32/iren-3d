import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CircleGeometry, ConeGeometry, SphereGeometry, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { kangarooPose } from '../kangarooMotion.js'

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query?.matches ?? false)
    query?.addEventListener('change', update)
    return () => query?.removeEventListener('change', update)
  }, [])
  return reduced
}

function Kangaroo({ index, side, relief, assets, reducedMotion }) {
  const root = useRef(), body = useRef(), tail = useRef(), legs = useRef([]), shadow = useRef()
  const { sphere, cone, fur, cream, dark, ear } = assets
  const rest = kangarooPose(0, index, side, relief, true)
  useFrame(({ clock }) => {
    if (!root.current) return
    const pose = kangarooPose(clock.elapsedTime, index, side, relief, reducedMotion)
    root.current.position.set(pose.x, pose.y, pose.z)
    root.current.rotation.y = pose.heading
    body.current.rotation.x = -.08 + pose.hop * .14
    tail.current.rotation.x = -pose.hop * .16
    for (const leg of legs.current) if (leg) leg.rotation.x = -pose.hop * .65
    shadow.current.position.set(pose.x, pose.ground + .012, pose.z)
    const spread = (1 - pose.hop * .25) * pose.scale
    shadow.current.scale.set(spread * .75, spread * .58, 1)
  })
  const part = (position, scale, material = fur, rotation) => <mesh geometry={sphere} material={material} position={position} scale={scale} rotation={rotation} castShadow/>
  return <group name={`kangaroo-${index}`}>
    <mesh ref={shadow} geometry={assets.shadowGeometry} material={assets.shadowMaterial} rotation={[-Math.PI / 2,0,0]} position={[rest.x,rest.ground+.012,rest.z]}/>
    <group ref={root} position={[rest.x,rest.y,rest.z]} rotation={[0,rest.heading,0]} scale={rest.scale}>
      <group ref={body} position={[0,.82,0]}>
        {part([0,.56,0],[.42,.72,.38],fur,[.2,0,0])}
        {part([0,.54,.29],[.27,.48,.14],cream,[.2,0,0])}
        {part([0,1.03,.22],[.22,.39,.22],fur,[.45,0,0])}
        {part([0,1.37,.43],[.25,.28,.34])}
        {part([0,1.29,.69],[.19,.15,.29])}
        {part([0,1.32,.95],[.13,.09,.07],dark)}
        {[-1,1].map(s=><group key={s}>
          {/* Long ears, a forward muzzle and a heavy tail preserve the silhouette at map scale. */}
          {part([s*.16,1.78,.36],[.1,.4,.085],fur,[.12,0,-s*.2])}
          {part([s*.16,1.8,.415],[.054,.27,.025],ear,[.12,0,-s*.2])}
          {part([s*.218,1.43,.6],[.035,.044,.041],dark)}
          {part([s*.32,.72,.29],[.105,.29,.1],fur,[-.55,0,s*.2])}
          {part([s*.31,.48,.43],[.085,.12,.14])}
        </group>)}
      </group>
      <group ref={tail} position={[0,.82,0]}>
        <mesh geometry={cone} material={fur} position={[0,-.33,-1.12]} scale={[.28,2,.28]} rotation={[-1.9,0,0]} castShadow/>
      </group>
      {[-1,1].map((s,i)=><group key={s} ref={el=>{legs.current[i]=el}} position={[s*.32,.82,-.07]}>
        {part([0,-.08,0],[.26,.42,.3],fur,[-.2,0,0])}
        {part([0,-.49,-.07],[.12,.3,.12],fur,[-.45,0,0])}
        {part([0,-.72,.19],[.135,.11,.44])}
      </group>)}
    </group>
  </group>
}

export default function Kangaroos({ side, relief }) {
  const reducedMotion = useReducedMotion()
  // Three animals share geometry and materials; no downloaded models or textures.
  const assets = useMemo(() => ({ sphere: new SphereGeometry(1,10,7), cone: new ConeGeometry(1,1,8),
    shadowGeometry: new CircleGeometry(1,20), shadowMaterial: new MeshBasicMaterial({color:'#645440',transparent:true,opacity:.12,depthWrite:false}),
    fur: new MeshStandardMaterial({color:'#b98a61',roughness:1}), cream: new MeshStandardMaterial({color:'#e0c7a3',roughness:1}),
    dark: new MeshStandardMaterial({color:'#403a33',roughness:1}), ear: new MeshStandardMaterial({color:'#c8957d',roughness:1}) }), [])
  useEffect(() => () => Object.values(assets).forEach(asset => asset.dispose()), [assets])
  return <group name="bundey-kangaroos" dispose={null}>{[0,1,2].map(index=><Kangaroo key={index} index={index} side={side} relief={relief} assets={assets} reducedMotion={reducedMotion}/>)}</group>
}
