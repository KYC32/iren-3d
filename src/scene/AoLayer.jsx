// =============================================================
// AoLayer — 틈새 그늘(AO, N8AO). 건물·장비가 바닥에 닿는 곳을 어둡게 해 입체감을 줍니다.
// 켜는 조건은 aoPolicy.js 에 있습니다.
// 후처리 묶음(EffectComposer)을 쓰면 배경까지 톤 매핑돼 색이 바뀌므로, 장면은 평소대로 화면에 그리고 그늘만 얹습니다.
//   1) 평소 화면 → 2) 깊이만 한 번 더 그림 → 3) N8AO 가 그늘 값 계산 → 4) 화면에 곱하기
// useFrame 우선순위를 1로 주면 R3F 기본 렌더가 멈추고 여기서 직접 화면을 그립니다. 이 층이 사라지면 기본 렌더로 돌아갑니다.
// =============================================================
import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Matrix4, MeshBasicMaterial, MultiplyBlending, ShaderMaterial, Vector2, WebGLRenderTarget } from 'three'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { N8AOPass } from 'n8ao'
import { aoSkipsDepth } from './aoPolicy.js'

const vertexShader = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }'
const quadMaterial = (fragmentShader, uniforms, extra = {}) =>
  new ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra })

// AO 곱하기: 깊이로 땅 위치를 되짚어 부지에서 멀어질수록 AO 를 없앰 (땅이 사라지는 구간과 맞춤)
const MULTIPLY = `
  uniform sampler2D tAo; uniform sampler2D tDepth; uniform mat4 clipToWorld; uniform vec2 fade; varying vec2 vUv;
  void main(){
    float depth = texture2D(tDepth, vUv).x;
    vec4 world = clipToWorld * vec4(vUv * 2. - 1., depth * 2. - 1., 1.);
    float keep = smoothstep(fade.y, fade.x, length(world.xz / world.w));
    float ao = texture2D(tAo, vUv).r;
    keep *= smoothstep(.008, .03, 1. - ao); // 아주 약한 값은 평평한 바닥의 잡음이므로 버림
    gl_FragColor = vec4(vec3(mix(1., ao, keep)), 1.);
  }`

export default function AoLayer({ side }) {
  const { gl, scene, camera, size } = useThree()
  const dpr = useThree((s) => s.viewport.dpr) // 성능 감시가 해상도 배율을 바꾸면 버퍼 크기도 다시 맞춤
  const fx = useMemo(() => {
    const aoPass = new N8AOPass(scene, camera, 1, 1)
    Object.assign(aoPass.configuration, { aoRadius: 1.6, distanceFalloff: 1, intensity: 2, gammaCorrection: false, halfRes: true, depthAwareUpsampling: true, transparencyAware: false, autoRenderBeauty: false })
    aoPass.setQualityMode('Medium')
    aoPass.setDisplayMode('AO') // 합성하지 않고 AO 값만 받음
    const aoTarget = new WebGLRenderTarget(1, 1)
    const multiply = new FullScreenQuad(quadMaterial(MULTIPLY, {
      tAo: { value: aoTarget.texture }, tDepth: { value: aoPass.beautyRenderTarget.depthTexture },
      clipToWorld: { value: new Matrix4() }, fade: { value: new Vector2(side * .85, side * 1.1) },
    }, { blending: MultiplyBlending, premultipliedAlpha: true, transparent: true }))
    const depthOnly = new MeshBasicMaterial({ colorWrite: false })
    return { aoPass, aoTarget, multiply, depthOnly }
  }, [scene, camera, side])

  useEffect(() => {
    const { width: w, height: h } = gl.getDrawingBufferSize(new Vector2())
    fx.aoPass.setSize(w, h)
    fx.aoTarget.setSize(w, h)
  }, [fx, gl, size, dpr])
  useEffect(() => () => { fx.aoPass.dispose?.(); fx.aoTarget.dispose(); fx.multiply.dispose(); fx.depthOnly.dispose() }, [fx])

  useFrame(() => {
    gl.setRenderTarget(null)
    gl.render(scene, camera) // 1) 평소 화면 (색·안티앨리어싱 그대로)
    // 2) 깊이만: 그림자 지도는 방금 그렸으니 다시 안 그림
    const hidden = []
    scene.traverseVisible((o) => { if (aoSkipsDepth(o)) hidden.push(o) })
    hidden.forEach((o) => { o.visible = false })
    gl.shadowMap.autoUpdate = false
    scene.overrideMaterial = fx.depthOnly
    gl.setRenderTarget(fx.aoPass.beautyRenderTarget)
    gl.render(scene, camera)
    scene.overrideMaterial = null
    gl.shadowMap.autoUpdate = true
    hidden.forEach((o) => { o.visible = true })
    fx.aoPass.render(gl, fx.aoTarget, null, 0, false) // 3)
    gl.setRenderTarget(null)
    gl.autoClear = false
    const m = fx.multiply.material.uniforms
    m.tDepth.value = fx.aoPass.beautyRenderTarget.depthTexture // 크기가 바뀌면 깊이 텍스처도 새로 만들어짐
    m.clipToWorld.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse)
    fx.multiply.render(gl) // 4)
    gl.autoClear = true
  }, 1)
  return null
}
