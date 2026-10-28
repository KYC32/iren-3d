// tour.mjs (첫 화면 둘러보기 28초 일정) 시험
//   - 한 바퀴의 처음과 끝에서 모든 부품이 쉬고 있음 (영상 반복 이음매·첫 바퀴와 두 번째 바퀴가 같음)
//   - 움직임은 천천히 출발해 천천히 멈춤 (처음부터 최고 속도로 튀어 나가지 않음)
//   - 확대 중 짚는 부품 차례와, 부품 사이를 옮겨 가는 길
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOUR, PLAN, STOPS, ease, tourAt } from "./tour.mjs";

// 확대 정류장 4곳 (전체 그림 기준 화면 위치 비율) — 실제 값과 상관없이 길 계산만 봄
const stops = [{ fx: 0.2, fy: 0.3 }, { fx: 0.6, fy: 0.4 }, { fx: 0.5, fy: 0.7 }, { fx: 0.3, fy: 0.8 }];
const at = (u) => tourAt(u, stops, stops);
// 숫자로 바뀌는 값들 (말풍선 차례 rs·gs 는 따로 봄)
const KEYS = ["pull", "lift", "rheat", "gheat", "rk", "gk"];

describe("ease (천천히 출발 · 천천히 멈춤)", () => {
  it("0 → 0, 1 → 1, 가운데 0.5", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5, 10);
  });
  it("구간 밖은 0 또는 1 로 묶임", () => {
    expect(ease(-2)).toBe(0);
    expect(ease(3)).toBe(1);
  });
  it("양 끝에서 속도가 0 (출발·도착이 부드러움)", () => {
    const h = 1e-4;
    expect(ease(h) / h).toBeLessThan(1e-3);
    expect((1 - ease(1 - h)) / h).toBeLessThan(1e-3);
  });
});

describe("tourAt — 한 바퀴의 처음과 끝", () => {
  it("0초에는 모든 부품이 제자리 (트레이 들어감·냉각판 덮임·열 없음·확대 없음)", () => {
    const s = at(0);
    for (const k of KEYS) expect(s[k]).toBe(0);
    expect(s.rs).toBe(-1);
    expect(s.gs).toBe(-1);
  });
  it("끝나기 직전에도 이미 제자리 → 반복될 때 이어지는 곳에서 튀지 않음", () => {
    const s = at(TOUR - 1e-6);
    for (const k of KEYS) expect(s[k]).toBe(0);
  });
  it("바퀴 수와 상관없이 같은 순간이면 같은 상태 (영상 두 번째 바퀴 = 그림 첫 바퀴)", () => {
    // 28 을 더하면 소수점 끝자리 반올림이 달라지므로 아주 작은 차이는 같은 것으로 봄
    for (const u of [0.5, 3.3, 8.2, 16.1, 22.4, 27.0]) {
      const a = at(u + TOUR), b = at(u);
      for (const k in b) expect(a[k], `${u}s ${k}`).toBeCloseTo(b[k], 9);
    }
  });
  it("모든 일정이 한 바퀴 안에서 끝남", () => {
    for (const list of Object.values(PLAN)) for (const [a, b] of list) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(TOUR);
      expect(b).toBeGreaterThan(a);
    }
  });
});

describe("tourAt — 움직임이 부드러움", () => {
  // 1/240초 간격으로 훑어 이웃 값 차이(속도)를 봄
  const dt = 1 / 240;
  const samples = Array.from({ length: Math.round(TOUR / dt) + 1 }, (_, i) => at(i * dt));
  it("어디서도 한 번에 튀지 않음 (1/240초 사이 변화가 작음)", () => {
    for (const k of KEYS) {
      let worst = 0;
      for (let i = 1; i < samples.length; i++) worst = Math.max(worst, Math.abs(samples[i][k] - samples[i - 1][k]));
      // 가장 짧은 움직임(약 1.1초)도 최고 속도는 0→1 을 0.6초에 가는 정도 → 1/240초 사이 0.01 을 넘지 않음
      expect(worst, k).toBeLessThan(0.01);
    }
  });
  it("부품 이동(트레이·냉각판)은 출발하는 순간 속도가 0", () => {
    for (const k of ["pull", "lift"]) for (const [a] of PLAN[k]) {
      const v = Math.abs(at(a + 0.02)[k] - at(a)[k]) / 0.02;
      expect(v, `${k} ${a}s`).toBeLessThan(0.02);
    }
  });
  it("확대 위치(돋보기 중심)도 부품 사이를 부드럽게 옮겨 감", () => {
    for (const fig of ["rack", "gpu"]) {
      const S = STOPS[fig], fx = fig === "rack" ? "rfx" : "gfx";
      for (const [j, m] of S.moves.entries()) {
        const g = S.glide[j];
        // 출발 직후 속도 ≈ 0, 가운데쯤 가장 빠름, 도착 직전 속도 ≈ 0
        const v0 = Math.abs(at(m + 0.02)[fx] - at(m)[fx]) / 0.02;
        const vMid = Math.abs(at(m + g / 2 + 0.01)[fx] - at(m + g / 2 - 0.01)[fx]) / 0.02;
        const v1 = Math.abs(at(m + g)[fx] - at(m + g - 0.02)[fx]) / 0.02;
        if (vMid === 0) continue;   // 두 정류장의 fx 가 같으면 가로로는 안 움직임
        expect(v0 / vMid, `${fig} ${m}s 출발`).toBeLessThan(0.05);
        expect(v1 / vMid, `${fig} ${m}s 도착`).toBeLessThan(0.05);
      }
    }
  });
});

describe("tourAt — 확대 순서", () => {
  it("랙: 트레이를 다 꺼낸 뒤에 확대가 시작됨", () => {
    const zoomStart = PLAN.rzoom[0][0];
    expect(at(zoomStart).pull).toBe(1);
  });
  it("GPU: 냉각판·뚜껑이 다 들린 뒤에 확대가 시작됨", () => {
    const zoomStart = PLAN.gzoom[0][0];
    expect(at(zoomStart).lift).toBe(1);
  });
  it("확대를 다 푼 뒤에 트레이를 넣고 냉각판을 내림", () => {
    expect(at(PLAN.pull[1][0]).rk).toBeLessThan(0.05);
    expect(at(PLAN.lift[1][0]).gk).toBeLessThan(0.3);
  });
  it("확대가 시작되는 동안 돋보기 중심은 첫 부품에 고정 (다른 곳에서 날아오지 않음)", () => {
    const z = PLAN.rzoom[0];
    for (const u of [z[0], (z[0] + z[1]) / 2, z[1]]) {
      expect(at(u).rfx).toBe(stops[0].fx);
      expect(at(u).rfy).toBe(stops[0].fy);
    }
  });
  it("짚는 부품은 0 → 1 → 2 → 3 차례, 확대 구간 밖은 -1", () => {
    const S = STOPS.rack;
    expect(at(S.from - 0.01).rs).toBe(-1);
    expect(at(S.from).rs).toBe(0);
    expect(at(S.moves[0]).rs).toBe(1);
    expect(at(S.moves[1]).rs).toBe(2);
    expect(at(S.moves[2]).rs).toBe(3);
    expect(at(S.to).rs).toBe(-1);
    const G = STOPS.gpu;
    expect(at(G.from).gs).toBe(0);
    expect(at(G.moves[2] + 0.1).gs).toBe(3);
    expect(at(G.to).gs).toBe(-1);
  });
  it("옮겨 간 뒤에는 그 부품 자리에 정확히 멈춤", () => {
    const S = STOPS.rack;
    const s = at(S.moves[0] + S.glide[0] + 0.01);
    expect(s.rfx).toBeCloseTo(stops[1].fx, 10);
    expect(s.rfy).toBeCloseTo(stops[1].fy, 10);
  });
  it("옮겨 가는 시간을 tourAt 이 알려 줌 (짚는 원·말풍선이 같은 시간에 따라오게)", () => {
    const S = STOPS.gpu;
    expect(at(S.moves[2] + 0.1).gg).toBe(S.glide[2]);
    expect(at(STOPS.rack.moves[0] + 0.1).rg).toBe(STOPS.rack.glide[0]);
  });
});

describe("tourAt — 실제 그림의 확대 정류장으로", () => {
  // 그림 빌드가 쓰는 boot-layout.json 의 정류장·배율 (화면 폭 대비 이동 = 중심 비율 차이 × (배율 − 1))
  const lay = JSON.parse(readFileSync(new URL("../../blender/boot-layout.json", import.meta.url), "utf8"));
  it("부품 사이를 옮겨 갈 때 가장 빠른 속도가 초당 화면 폭 0.8 이하 (너무 빨리 휙 지나가지 않음)", () => {
    for (const fig of ["rack", "gpu"]) {
      const S = STOPS[fig], st = lay[fig].stops, z = lay[fig].zoom;
      for (const [j, g] of S.glide.entries()) {
        const d = Math.hypot(st[j + 1].fx - st[j].fx, st[j + 1].fy - st[j].fy) * (z - 1);
        const peak = (1.875 * d) / g;   // smootherstep 의 가장 빠른 순간 = 평균 속도의 1.875 배
        expect(peak, `${fig} ${j + 1}번째 이동`).toBeLessThanOrEqual(0.8);
      }
    }
  });
  it("각 부품을 읽을 시간이 충분함 (도착 뒤 다음 이동·확대 풂까지 0.8초 이상)", () => {
    for (const fig of ["rack", "gpu"]) {
      const S = STOPS[fig];
      S.moves.forEach((m, j) => {
        const next = j + 1 < S.moves.length ? S.moves[j + 1] : S.to;
        expect(next - (m + S.glide[j]), `${fig} ${j + 1}번째 부품`).toBeGreaterThanOrEqual(0.8);
      });
    }
  });
});
