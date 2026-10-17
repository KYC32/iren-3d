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

// 3D 전체 보기에서 계약 없는 건물 무리를 묶는 구역 라벨 종류 (글자는 i18n 의 campus[종류])
//   계획 중인 건물이 채굴동 전력을 넘겨받으면(replaces → 채굴동) "AI 전환 예정" = 채굴 → AI 전환 (커낼플랫츠 등)
//     공랭·액체냉각은 따지지 않음: 커낼플랫츠는 회사 발표대로 "부지 전체를 액체냉각으로 전환"
//     (예전엔 공랭만 전환으로 봐서, 액체냉각 전환으로 고치자 "확장 예정 부지"로 잘못 바뀌었음)
//   그 밖의 계획 건물(새로 짓거나 AI 홀의 남는 전력을 씀)은 "확장 예정 부지"
//   계획이 아니면 건물 종류대로: 채굴 / 액체냉각 / 공랭 구역
// byId    = 그 날짜에 보이는 건물 (3D 화면용 값)
// allById = 퇴역한 건물까지 모든 건물 (site._raw.buildings) — 넘겨받는 채굴동이 이미 퇴역해
//           byId 에서 빠진 경우에도 그 종류를 알기 위해 (커낼플랫츠 채굴동은 2026-10 퇴역)
export function areaKeyOf(block, byId, allById = byId) {
  if (block.status === 'planned') {
    const replaced = allById[byId[block.buildingId]?.replaces]   // 이 건물이 전력을 넘겨받는 기존 건물 (없으면 undefined)
    return replaced?.kind === 'miner_hall' ? 'convert' : 'planned'
  }
  if (block.kind === 'miner_hall') return 'mining'
  return block.kind === 'datahall_liquid' ? 'liquid' : 'air'
}
