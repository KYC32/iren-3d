// =============================================================
// packedGlb.js — gzip 으로 줄인 GLB 모형(.glb.gz)을 받아 three.js 장면으로 읽기 (Horizon 홀 · 캠퍼스 소품 공용)
// -------------------------------------------------------------
// Vercel 은 .glb 를 압축해 주지 않아 미리 gzip 해 둠 → 브라우저 기본 기능(DecompressionStream)으로 풂
//   vite 개발·미리보기 서버는 Content-Encoding 으로 이미 풀어서 주므로 GLB 면 그대로 씀
// 지연 로딩되는 화면에서만 import → GLTFLoader·meshopt 해제기가 첫 3D 지도 묶음에 들어가지 않음
// =============================================================
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { isGzip, isGlb } from '../horizonHall.js'

export async function loadPackedGlb(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`모형 파일 ${r.status}`)
  const buf = await unpack(await r.arrayBuffer())
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  return loader.parseAsync(buf, '')
}

// gzip 이면 풀고, 서버가 이미 풀어서 줬으면 그대로
async function unpack(buf) {
  const head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength))
  if (isGlb(head)) return buf
  if (!isGzip(head)) throw new Error('모형 파일 형식을 알 수 없음')
  if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 gzip 풀기를 지원하지 않음')
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}
