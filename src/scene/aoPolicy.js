// 틈새 그늘(AO)을 언제 켜고, 어떤 물체를 계산에서 뺄지 정하는 규칙

// 켜는 조건: 데스크톱의 캠퍼스·본사 화면. 휴대폰 성능을 재지 못했으므로 터치 기기는 끔
//   forced = 주소에 ?fx=ao 를 붙인 확인용 (기기 조건과 프레임 저하를 무시)
export function aoAllowed({ width, coarse, campus, record, declined, forced }) {
  if (!campus || record) return false
  if (forced) return true
  return width >= 768 && !coarse && !declined
}

// 깊이 단계에서 뺄 물체: 투명한 것은 뒤를 가리지 않으므로 그늘을 만들면 안 됨 (땅만 예외: 그늘을 받아야 함)
//   굵은 선(LineMaterial)은 셰이더로 펴는 사각형이라 재질을 덮어쓰면 커다란 판으로 그려짐
export function aoSkipsDepth(object) {
  if (object.isLine || object.isSprite || object.isPoints) return true
  if (object.material?.isLineMaterial) return true
  return Boolean(object.isMesh && object.material?.transparent && !object.userData?.aoReceiver)
}
