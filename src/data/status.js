// 사이트/건물 상태 목록 — 화면의 색과 애니메이션을 결정하는 핵심 값
// (zod 스키마와 분리해 두면, 화면 코드가 무거운 zod 를 끌고 오지 않습니다)
export const STATUS = ['operating', 'commissioning', 'under_construction', 'planned', 'decommissioning']
