// =============================================================
// buildingLabel.js — 3D 캠퍼스 건물 라벨에 쓰는 글자 (순수 함수)
// -------------------------------------------------------------
// 화면용 건물 값(view.js)에서 MW 가 0 이면 "모름·없음" 입니다.
//   viewSite 가 모르는 IT 를 0 으로 채우고(it_mw ?? 0), 전체 전력도 근거가 없으면 0 이 되기 때문(grossOf).
// 그래서 0 은 글자로 보여 주지 않습니다 — 캠퍼스 패널 건물 목록과 같은 규칙.
// =============================================================

// 용량 한 줄: "50 MW IT / 65 MW gross" · "~60 MW*"(IT 기준 미공개, 공개된 용량만) · "80 MW gross"
export function buildingMwText(b) {
  // 앞부분: IT 전력, 없으면 공개된 용량 (~ = 약, * = IT 기준인지 밝히지 않음)
  const head = b.it_mw ? `${b.it_mw} MW IT` : b.disclosedMw ? `~${b.disclosedMw} MW*` : ''
  // 뒷부분: 전체 전력(gross) — 0(모름)이면 뺌
  const gross = b.gross_mw ? `${b.gross_mw} MW gross` : ''
  // 둘 다 있을 때만 " / " 로 이음 (하나뿐이면 그것만, 둘 다 없으면 빈 문자열)
  return [head, gross].filter(Boolean).join(' / ')
}
