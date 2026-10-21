// =============================================================
// horizonHall.js — Horizon 홀 3D 모형(GLB)을 읽고 놓는 데 쓰는 순수 함수 (three.js 없이 테스트)
// -------------------------------------------------------------
// 모형 설계도: scripts/blender/horizon-hall.py → public/models/horizon-hall.glb.gz
//   · 파일은 gzip 으로 한 번 더 줄여 둠 (Vercel 은 .glb 를 압축해서 보내 주지 않아서) → 받은 뒤 브라우저가 풂
//   · 랙 348대는 "자리 목록"(slots), 전기·냉각수 길은 "꺾인 선 목록"(flows) 으로 모형 안에 들어 있음
// 그리는 쪽은 buildings/HorizonHall.jsx
// =============================================================

// 받은 바이트가 gzip 인지 (첫 두 바이트 1f 8b) — 서버가 미리 풀어서 줬다면 바로 GLB 가 옴
export const isGzip = (b) => b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b
// GLB 파일인지 (첫 네 바이트가 글자 'glTF')
export const isGlb = (b) => b.length >= 4 && b[0] === 0x67 && b[1] === 0x6c && b[2] === 0x54 && b[3] === 0x46

// 부지(미터, [가로, 세로])를 캠퍼스 블록(w × d)에 맞추는 배율 — 두 방향 중 작은 쪽 (블록 밖으로 안 나가게)
//   Horizon 부지 60 × 90 m → 블록 4 × 6 이면 1/15
export const fitScale = (lotM, w, d) => Math.min(w / lotM[0], d / lotM[1])

// 꺾인 선의 누적 길이: [0, 첫 구간, 첫+둘째 구간, …] (마지막 값 = 전체 길이)
export function cumulative(points) {
  const cum = [0]
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]]
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]))
  }
  return cum
}

// 꺾인 선의 처음에서 dist 만큼 간 점 → out 에 [x, y, z] 를 써서 돌려줌
//   dist 가 전체 길이를 넘거나 음수면 한 바퀴 돌아 처음부터 다시 (흐르는 점이 끝에서 처음으로 돌아가게)
export function pointAlong(points, cum, dist, out = [0, 0, 0]) {
  const total = cum[cum.length - 1]
  if (!(total > 0)) {
    out[0] = points[0][0]; out[1] = points[0][1]; out[2] = points[0][2]
    return out
  }
  const d = ((dist % total) + total) % total
  let i = 1
  while (i < cum.length - 1 && cum[i] < d) i++   // d 가 들어 있는 구간 [i-1, i]
  const seg = cum[i] - cum[i - 1]
  const t = seg > 0 ? (d - cum[i - 1]) / seg : 0
  const [a, b] = [points[i - 1], points[i]]
  out[0] = a[0] + (b[0] - a[0]) * t
  out[1] = a[1] + (b[1] - a[1]) * t
  out[2] = a[2] + (b[2] - a[2]) * t
  return out
}

// 흐르는 점 배치: 선마다 spacing(m) 간격으로 점을 놓되 최소 1개 — [{ line, offset }]
//   offset 은 그 점이 선의 처음에서 얼마나 떨어져 출발하는지 (점들이 같은 간격으로 줄지어 흐름)
export function flowDots(lines, spacing) {
  const dots = []
  lines.forEach((pts, line) => {
    const total = cumulative(pts).at(-1)
    const n = Math.max(1, Math.round(total / spacing))
    for (let k = 0; k < n; k++) dots.push({ line, offset: (total * k) / n })
  })
  return dots
}

// 모형 안의 JSON 글(extras)을 안전하게 읽기 — 없거나 깨졌으면 기본값
export function readJson(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback
  } catch {
    return fallback
  }
}
