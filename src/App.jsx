// 1단계(Hello 3D) 확인용 임시 App. 이후 단계에서 실제 화면으로 교체됩니다.
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'

function SpinningBox() {
  const ref = useRef()
  // useFrame: 매 프레임마다 호출됩니다. 여기서는 박스를 천천히 돌립니다.
  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.8
    ref.current.rotation.x += delta * 0.3
  })
  return (
    <mesh ref={ref}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color="#2EA88A" />
    </mesh>
  )
}

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100dvh', background: '#eceffa' }}>
      <Canvas camera={{ position: [3, 3, 3], fov: 40 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 8, 4]} intensity={1.5} />
        <SpinningBox />
      </Canvas>
    </div>
  )
}
