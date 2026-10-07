// 숫자 표시: 1,000MW 이상은 GW 로
export function fmtMw(mw, digits = 1) {
  if (mw == null) return '–'
  if (mw >= 1000) return `${(mw / 1000).toFixed(digits).replace(/\.0$/, '')} GW`
  return `${Math.round(mw).toLocaleString()} MW`
}

