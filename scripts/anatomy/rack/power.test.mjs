// power.mjs (첫 화면 그림 아래 수치 줄) 시험
//   실제 랙처럼: 꽂힌 트레이·냉각판이 덮인 GPU 만 전기를 씀.
//   트레이를 빼거나 냉각판을 들려면 먼저 전원·냉각수를 끊어야 하므로 그때는 0 kW.
import { describe, expect, it } from "vitest";
import { trayReadout, gpuReadout } from "./power.mjs";

// 랙 그림의 값 (build.mjs 와 같은 숫자: 랙 130 kW ÷ 컴퓨트 트레이 18개)
const tray = { tray: 7, gpus: 4, cpus: 2, kw: 130 / 18 };
// GPU 그림의 값 (gpu.mjs 의 GPU)
const gpu = { dies: 2, hbm: 8, hbmGb: 288, kw: 1.4 };

describe("trayReadout (랙 트레이 수치 줄)", () => {
  it("꽂혀 있으면 가동 중 · 트레이 1개 몫 약 7.2 kW", () => {
    expect(trayReadout({ ...tray, out: 0, ko: true })).toBe("트레이 7 · 장착됨 · 가동 중 약 7.2\u00a0kW");
    expect(trayReadout({ ...tray, out: 0, ko: false })).toBe("tray 7 seated · running ≈7.2\u00a0kW");
  });
  it("빼는 중이면 전원·냉각수가 끊겨 0 kW", () => {
    expect(trayReadout({ ...tray, out: 0.4, ko: true })).toBe("트레이 7 · 전원·냉각수 분리 · 40% 빠짐 · 0\u00a0kW");
    expect(trayReadout({ ...tray, out: 0.4, ko: false })).toBe("tray 7 · power and coolant off · 40% out · 0\u00a0kW");
  });
  it("다 꺼내면 부품 수 + 0 kW", () => {
    expect(trayReadout({ ...tray, out: 1, ko: true })).toBe("트레이 7 · 꺼냄 · GPU 4 · CPU 2 · 전원 분리 · 0\u00a0kW");
    expect(trayReadout({ ...tray, out: 1, ko: false })).toBe("tray 7 out · 4 GPU · 2 CPU · unplugged · 0\u00a0kW");
  });
  it("조금이라도 빠지면 바로 0 kW (전기는 빼기 전에 끊음, 중간 값 없음)", () => {
    for (const out of [0.05, 0.1, 0.5, 0.97, 1]) expect(trayReadout({ ...tray, out, ko: true })).toMatch(/ 0\u00a0kW$/);
    for (const out of [0, 0.01, 0.049]) expect(trayReadout({ ...tray, out, ko: true })).toMatch(/7\.2\u00a0kW$/);
  });
});

describe("줄바꿈", () => {
  it("숫자와 kW·GB 는 줄이 바뀌어도 갈라지지 않음 (좁은 휴대폰에서 '0' 과 'kW' 가 두 줄로 나뉘던 문제)", () => {
    const all = [0, 0.4, 1].flatMap((out) => [true, false].map((ko) => trayReadout({ ...tray, out, ko })))
      .concat([[0, 0, 0], [0.3, 40, 0], [1, 100, 1]].flatMap(([lift, plate, lid]) => [true, false].map((ko) => gpuReadout({ ...gpu, lift, plate, lid, ko }))));
    for (const line of all) expect(line).not.toMatch(/\d (kW|GB)/);
  });
});

describe("gpuReadout (GPU 수치 줄)", () => {
  it("냉각판이 덮여 있으면 가동 중 · 최대 1.4 kW", () => {
    expect(gpuReadout({ ...gpu, lift: 0, plate: 0, lid: 0, ko: true })).toBe("냉각판 덮임 · 가동 중 최대 1.4\u00a0kW");
    expect(gpuReadout({ ...gpu, lift: 0, plate: 0, lid: 0, ko: false })).toBe("cold plate on · running up to 1.4\u00a0kW");
  });
  it("냉각판을 드는 중이면 전원을 끈 상태 · 0 kW", () => {
    expect(gpuReadout({ ...gpu, lift: 0.3, plate: 40, lid: 0, ko: true })).toBe("전원 끔 · 냉각판 40% 들림 · 0\u00a0kW");
    expect(gpuReadout({ ...gpu, lift: 0.6, plate: 100, lid: 0.5, ko: true })).toBe("전원 끔 · 뚜껑 들리는 중 · 0\u00a0kW");
    expect(gpuReadout({ ...gpu, lift: 0.3, plate: 40, lid: 0, ko: false })).toBe("power off · lifting plate 40% · 0\u00a0kW");
  });
  it("다 들면 다이·HBM + 0 kW", () => {
    expect(gpuReadout({ ...gpu, lift: 1, plate: 100, lid: 1, ko: true })).toBe("냉각판·뚜껑 들림 · 다이 2 · HBM3e 8 (288\u00a0GB) · 전원 끔 · 0\u00a0kW");
    expect(gpuReadout({ ...gpu, lift: 1, plate: 100, lid: 1, ko: false })).toBe("plate and lid off · 2 dies · 8 HBM3e 288\u00a0GB · power off · 0\u00a0kW");
  });
});
