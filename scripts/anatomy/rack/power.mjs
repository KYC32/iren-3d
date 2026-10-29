// =============================================================
// power.mjs — 첫 화면 그림 아래 수치 줄 (지금 모습 + 전력)
// -------------------------------------------------------------
// 실제 랙처럼 셉니다: 꽂힌 트레이·냉각판이 덮인 GPU 만 전기를 씁니다.
//   트레이를 빼려면 먼저 전원을 끄고 버스바·냉각수 퀵 커넥터에서 떼어야 하고,
//   냉각판을 든 GPU 는 몇 초 만에 타 버리므로 켜 둘 수 없습니다 → 그때는 0 kW.
//   (그림의 주황 열 색은 "가동할 때 열이 나는 곳"을 꺼낸 모습 위에 보여 주는 설명용)
// 이 파일 글을 build.mjs 가 그림 페이지에 그대로 끼워 넣습니다 (export 만 지움). 시험은 power.test.mjs.
// =============================================================

// 트레이가 행정의 5% 미만으로 나와 있으면 꽂힌 것으로 봄 (그림의 다른 문구와 같은 기준)
const SEATED = 0.05;
// 이보다 더 나오면 "다 꺼냄"
const OUT = 0.98;
// 숫자와 단위 사이는 줄바꿈 안 되는 공백(\u00a0): 좁은 칸에서 "0" 과 "kW" 가 두 줄로 갈라지지 않게

// 랙 트레이 줄. out = 나온 정도 0..1, tray = 트레이 번호, gpus·cpus = 트레이 속 개수, kw = 트레이 1개 몫 전력
export function trayReadout({ out, ko, tray, gpus, cpus, kw }) {
  const p = Math.round(out * 100);
  if (out < SEATED) return ko ? `트레이 ${tray} · 장착됨 · 가동 중 약 ${kw.toFixed(1)}\u00a0kW` : `tray ${tray} seated · running ≈${kw.toFixed(1)}\u00a0kW`;
  if (out < OUT) return ko ? `트레이 ${tray} · 전원·냉각수 분리 · ${p}% 빠짐 · 0\u00a0kW` : `tray ${tray} · power and coolant off · ${p}% out · 0\u00a0kW`;
  return ko ? `트레이 ${tray} · 꺼냄 · GPU ${gpus} · CPU ${cpus} · 전원 분리 · 0\u00a0kW` : `tray ${tray} out · ${gpus} GPU · ${cpus} CPU · unplugged · 0\u00a0kW`;
}

// GPU 줄. lift = 냉각판·뚜껑이 들린 정도 0..1, plate = 냉각판이 들린 % , lid = 뚜껑이 들린 정도 0..1, kw = GPU 1개 최대 전력
export function gpuReadout({ lift, plate, lid, ko, dies, hbm, hbmGb, kw }) {
  if (lift < 0.02) return ko ? `냉각판 덮임 · 가동 중 최대 ${kw.toFixed(1)}\u00a0kW` : `cold plate on · running up to ${kw.toFixed(1)}\u00a0kW`;
  if (lid < 0.03) return ko ? `전원 끔 · 냉각판 ${plate}% 들림 · 0\u00a0kW` : `power off · lifting plate ${plate}% · 0\u00a0kW`;
  if (lift < OUT) return ko ? "전원 끔 · 뚜껑 들리는 중 · 0\u00a0kW" : "power off · lifting lid · 0\u00a0kW";
  return ko ? `냉각판·뚜껑 들림 · 다이 ${dies} · HBM3e ${hbm} (${hbmGb}\u00a0GB) · 전원 끔 · 0\u00a0kW` : `plate and lid off · ${dies} dies · ${hbm} HBM3e ${hbmGb}\u00a0GB · power off · 0\u00a0kW`;
}
