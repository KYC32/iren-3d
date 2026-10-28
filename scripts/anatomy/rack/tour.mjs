// =============================================================
// tour.mjs — 첫 화면 그림의 28초 둘러보기 일정 (랙 → GPU 차례로, 확대까지 저절로)
// -------------------------------------------------------------
// 둘러보기 t 초의 모습을 시간만으로 정하는 순수 함수입니다. 같은 일정을 세 곳이 씁니다:
//   · 그림 (build.mjs 의 LIVE — 이 파일 글을 그대로 끼워 넣음, export 만 지움)
//   · Blender 사진 렌더 (scripts/blender/boot-photos.py — boot-layout.json 으로 PLAN·STOPS 를 받아 같은 식으로 계산)
//   · 시험 (tour.test.mjs)
// 예전엔 목표값이 계단처럼 바뀌고 부품이 지수 함수로 따라갔음 → 움직임이 처음부터 최고 속도로 튀어 나갔다가 길게 끌리며 멈췄고,
//   한 바퀴 끝에서도 다 멈추지 않아 첫 바퀴(그림)와 두 번째 바퀴(영상)의 상태가 달랐음.
// 지금은 움직임마다 시작·끝 시각을 정하고 그 사이를 ease 로 잇습니다 → 천천히 출발해 천천히 멈추고, 끝 시각에 정확히 멈춤.
// =============================================================

// 한 바퀴 (초) — 영상 길이와 같음
export const TOUR = 28;

// 움직임 일정: 값마다 [시작 초, 끝 초, 방향] 목록. 방향 1 = 그 구간 동안 0 → 1, -1 = 1 → 0
//   pull  = 랙 트레이가 나온 정도 (1 = 끝까지, 그림이 행정 거리를 곱함)
//   rheat = 랙 트레이 칩의 열 (부하)        rzoom = 트레이 확대 정도
//   lift  = GPU 냉각판·뚜껑이 들린 정도     gheat = GPU 다이의 열        gzoom = 기판 확대 정도
//   랙  0~2.4초 트레이 꺼냄 → 2.7~3.9초 확대 → 부품 4곳 → 11.6~12.7초 확대 풂 → 12.8~14.5초 트레이 넣음
//   GPU 14.5~16.9초 냉각판·뚜껑 들림 → 17.2~18.4초 확대 → 부품 4곳 → 25.3~26.4초 확대 풂 → 26.2~27.8초 내려앉음
//   27.8초부터는 모두 제자리에서 쉼 → 한 바퀴가 다시 시작돼도 튀지 않음
export const PLAN = {
  pull: [[0, 2.4, 1], [12.8, 14.5, -1]],
  rheat: [[1.6, 3.4, 1], [12.4, 13.8, -1]],
  rzoom: [[2.7, 3.9, 1], [11.6, 12.7, -1]],
  lift: [[14.5, 16.9, 1], [26.2, 27.8, -1]],
  gheat: [[15.6, 17.2, 1], [25.3, 26.9, -1]],
  gzoom: [[17.2, 18.4, 1], [25.3, 26.4, -1]],
};
// 확대는 시간에 정비례로 올림: 그림의 보이는 범위 계산(zoomer 의 rect)이 이미 smoothstep 으로 감싸서 부드러움 (두 번 감싸면 가운데가 너무 빨라짐)
const LINEAR = ["rzoom", "gzoom"];

// 확대 중 짚는 부품 4곳의 차례: from 부터 첫 부품, moves[j] 시각에 다음 부품으로 glide[j] 초 동안 옮겨 감, to 에 말풍선을 거둠
//   옮겨 가는 시간은 거리에 맞춤: 가장 빠른 순간이 초당 화면 폭 0.8 을 넘지 않게 (tour.test.mjs 가 실제 정류장으로 검사)
//   GPU 마지막 이동(초크 → NVLink)은 화면 폭의 약 0.55 를 가서 1.4초
export const STOPS = {
  rack: { from: 2.7, to: 11.6, moves: [5.15, 7.3, 9.45], glide: [0.8, 0.8, 0.8] },
  gpu: { from: 17.2, to: 25.3, moves: [19.4, 21.2, 23.0], glide: [0.8, 0.9, 1.4] },
};

// 0 → 1 을 천천히 출발해 천천히 멈추게 잇는 곡선 (smootherstep: 양 끝에서 속도·가속도가 0)
export function ease(q) {
  const x = Math.min(1, Math.max(0, q));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

// 한 값의 일정 목록을 u 초에서 계산 (구간마다 0→1 또는 1→0 을 더함)
function trackAt(list, u, linear) {
  let v = 0;
  for (const [a, b, dir] of list) {
    const q = Math.min(1, Math.max(0, (u - a) / (b - a)));
    v += dir * (linear ? q : ease(q));
  }
  return Math.min(1, Math.max(0, v));
}

// 돋보기 중심 (전체 그림 기준 비율 fx, fy), 지금 짚는 부품 번호 (확대 구간 밖이면 -1), 그 부품으로 옮겨 가는 시간 glide (초)
//   첫 부품에서 확대를 시작하고, moves 시각마다 다음 부품으로 ease 로 옮겨 감
//   확대가 풀린 동안(보이는 범위 = 전체)에는 중심이 어디든 화면이 같으므로 다음 바퀴 첫 부품으로 바로 돌아와도 보이지 않음
function focusAt(u, S, stops) {
  let i = 0;
  for (const m of S.moves) if (u >= m) i++;
  i = Math.min(i, stops.length - 1);
  let fx = stops[i].fx, fy = stops[i].fy;
  const glide = S.glide[Math.max(0, i - 1)];
  if (i > 0) {
    const a = stops[i - 1], q = ease((u - S.moves[i - 1]) / glide);
    fx = a.fx + (fx - a.fx) * q;
    fy = a.fy + (fy - a.fy) * q;
  }
  return { fx, fy, glide, stop: u >= S.from && u < S.to ? i : -1 };
}

// 둘러보기 t 초의 모습 (t 는 몇 바퀴째든 됨). rackStops·gpuStops = 각 그림의 짚는 부품 [{fx, fy}, …]
export function tourAt(t, rackStops, gpuStops) {
  let u = t % TOUR;
  if (u < 0) u += TOUR;   // 음수 시각도 같은 바퀴 안으로 (28 을 더했다 빼는 식은 2.7 이 2.6999… 가 되는 반올림 오차가 생김)
  const v = {};
  for (const key in PLAN) v[key] = trackAt(PLAN[key], u, LINEAR.includes(key));
  const r = focusAt(u, STOPS.rack, rackStops), g = focusAt(u, STOPS.gpu, gpuStops);
  return {
    pull: v.pull, lift: v.lift, rheat: v.rheat, gheat: v.gheat,
    rk: v.rzoom, rfx: r.fx, rfy: r.fy, rs: r.stop, rg: r.glide,
    gk: v.gzoom, gfx: g.fx, gfy: g.fy, gs: g.stop, gg: g.glide,
  };
}
