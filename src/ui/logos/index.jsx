// =============================================================
// 고객 회사 로고 (계약 배지·사이트 핀·캠퍼스 라벨에 사용)
// -------------------------------------------------------------
// 로고는 각 회사의 상표입니다. 이 사이트에서는 "어느 회사와의 계약인지"를 가리키는 용도로만 씁니다.
// - Microsoft: 공식 4색 사각형 로고를 사각형 4개로 직접 그림
// - NVIDIA: Simple Icons(CC0) 의 경로 데이터 (상표권은 NVIDIA 소유)
// 새 고객 로고를 추가하면 data/companies.json 계약의 logo 값과 아래 LOGOS 키를 맞추세요.
// =============================================================

function MicrosoftLogo({ size = 14 }) {
  const s = size, g = size * 0.09, h = (size - g) / 2
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-label="Microsoft" role="img">
      <rect x={0} y={0} width={h} height={h} fill="#F25022" />
      <rect x={h + g} y={0} width={h} height={h} fill="#7FBA00" />
      <rect x={0} y={h + g} width={h} height={h} fill="#00A4EF" />
      <rect x={h + g} y={h + g} width={h} height={h} fill="#FFB900" />
    </svg>
  )
}

function NvidiaLogo({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="NVIDIA" role="img">
      <path fill="#76B900" d="M8.948 8.798v-1.43a6.7 6.7 0 0 1 .424-.018c3.922-.124 6.493 3.374 6.493 3.374s-2.774 3.851-5.75 3.851c-.398 0-.787-.062-1.158-.185v-4.346c1.528.185 1.837.857 2.747 2.385l2.04-1.714s-1.492-1.952-4-1.952a6.016 6.016 0 0 0-.796.035m0-4.735v2.138l.424-.027c5.45-.185 9.01 4.47 9.01 4.47s-4.08 4.964-8.33 4.964c-.37 0-.733-.035-1.095-.097v1.325c.3.035.61.062.91.062 3.957 0 6.82-2.023 9.593-4.408.459.371 2.34 1.263 2.73 1.652-2.633 2.208-8.772 3.984-12.253 3.984-.335 0-.653-.018-.971-.053v1.864H24V4.063zm0 10.326v1.131c-3.657-.654-4.673-4.46-4.673-4.46s1.758-1.944 4.673-2.262v1.237H8.94c-1.528-.186-2.73 1.245-2.73 1.245s.68 2.412 2.739 3.11M2.456 10.9s2.164-3.197 6.5-3.533V6.201C4.153 6.59 0 10.653 0 10.653s2.35 6.802 8.948 7.42v-1.237c-4.84-.6-6.492-5.936-6.492-5.936z" />
    </svg>
  )
}

export const LOGOS = { microsoft: MicrosoftLogo, nvidia: NvidiaLogo }
// 고객 고유색 (캠퍼스 고객 칩 테두리 등) — data/companies.json 계약 color 와 맞춤
export const BRAND_COLOR = { microsoft: '#0078d4', nvidia: '#76b900' }

// 로고가 있으면 로고, 없으면 null
export function CustomerLogo({ name, size }) {
  const L = LOGOS[name]
  return L ? <L size={size} /> : null
}

// 고객 이름 문자열 → 로고 키 (캠퍼스 건물의 customer 필드용)
export function logoKeyOf(customer) {
  const c = String(customer ?? '').toLowerCase()
  if (c.includes('microsoft')) return 'microsoft'
  if (c.includes('nvidia')) return 'nvidia'
  return null
}
