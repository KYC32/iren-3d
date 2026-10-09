// =============================================================
// rackLayout.js — 데이터홀 블록 안에 GPU 랙 n 개를 줄지어 세우는 배치 (순수 함수 → rackLayout.test.js)
// -------------------------------------------------------------
// 실제 데이터홀처럼 랙이 줄(row)을 이루고, 두 줄씩 등을 맞대어 "짝"을 이룹니다.
//   등끼리 맞댄 좁은 통로 = 뜨거운 공기가 빠지는 통로(hot aisle)
//   짝과 짝 사이 넓은 통로 = 차가운 공기가 들어오는 통로(cold aisle) → 랙 앞면(LED)이 이쪽을 봄
// 블록 크기에 n 개가 다 들어가도록 랙 크기 s 를 이분 탐색으로 가장 크게 고릅니다.
// 좌표: 블록 중심이 (0,0), x = 블록 가로, z = 블록 세로. 랙 하나 = 깊이(x) 2s × 폭(z) s
// =============================================================
const HOT = 0.5   // 뜨거운 통로 폭 (s 배수)
const COLD = 1.1  // 차가운 통로 폭 (s 배수)
const PITCH = 1.08 // 같은 줄 안 랙 간격 (폭 s 의 1.08배 → 사이에 얇은 틈)

// 랙 크기 s 일 때 몇 줄 × 몇 칸이 들어가나
function fit(s, W, D) {
  const cols = Math.floor((D + (PITCH - 1) * s) / (PITCH * s))
  const pair = 4 * s + HOT * s + COLD * s           // 짝 하나(2줄) + 통로들이 차지하는 폭
  let rows = 2 * Math.floor((W + COLD * s) / pair)  // 마지막 짝 뒤 차가운 통로는 벽이라 생략
  const used = (rows / 2) * pair - COLD * s
  if (W - used - COLD * s >= 2 * s) rows += 1       // 남는 폭에 한 줄(짝 없이) 더
  return { cols, rows, cap: Math.max(0, cols) * Math.max(0, rows) }
}

// w·d: 블록 가로·세로, n: 랙 수, wall: 벽 두께 + 안쪽 여백
// → { size: s, rows, cols, racks: [{ x, z, face, row }] }  face: 랙 앞면 방향 (+1 = +x 쪽, −1 = −x 쪽)
export function rackGrid(w, d, n, wall = 0.3) {
  const W = w - 2 * wall, D = d - 2 * wall
  if (n <= 0 || W <= 0 || D <= 0) return { size: 0, rows: 0, cols: 0, racks: [] }
  let lo = 0, hi = Math.min(W / 2, D)
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (fit(mid, W, D).cap >= n) lo = mid
    else hi = mid
  }
  const s = lo
  const { cols, rows } = fit(s, W, D)
  const pair = (4 + HOT + COLD) * s
  // 줄마다 x: 짝 안 첫 줄은 앞면이 −x(왼쪽 차가운 통로), 둘째 줄은 +x
  const rowX = Array.from({ length: rows }, (_, r) => Math.floor(r / 2) * pair + (r % 2) * (2 * s + HOT * s) + s)
  const usedW = rowX[rows - 1] + s
  const usedD = cols * PITCH * s - (PITCH - 1) * s
  const need = Math.ceil(n / cols) // 실제로 채우는 줄 수 (마지막 줄은 일부만)
  // 채운 줄들만 가운데 정렬 (빈 줄이 한쪽에 몰려 보이지 않게)
  const shiftX = -((rowX[need - 1] + s) / 2)
  const racks = []
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols
    racks.push({ x: rowX[r] + shiftX, z: -usedD / 2 + c * PITCH * s + s / 2, face: r % 2 ? 1 : -1, row: r })
  }
  return { size: s, rows: need, cols, racks, usedW }
}
