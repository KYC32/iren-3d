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

// GPU 근거 종류 글자 (데이터의 gpu.basis — schema.js)
const GPU_BASIS = {
  installed_or_ordered: { ko: '설치·주문 포함', en: 'installed or on order' },
  designed_for: { ko: '설계 기준', en: 'designed for' },   // 회사가 "이 칩을 위해 설계"라고만 밝힘 (주문·설치 발표 전)
}
// 건물을 골랐을 때 GPU 한 줄: "GPU · 모델 × 개수 (근거)" — GPU 정보가 없으면 빈 문자열
export function gpuLine(b, lang) {
  const g = b?.gpu
  if (!g) return ''
  const count = g.count ? ` × ${g.count.toLocaleString('en-US')}` : ''
  const basis = GPU_BASIS[g.basis] ? ` (${GPU_BASIS[g.basis][lang === 'ko' ? 'ko' : 'en']})` : ''
  return `GPU · ${g.model}${count}${basis}`
}
// GPU 모델 글자 → 짧은 모델 이름들: '/' 로 나누고, 괄호 설명과 'NVL72' 같은 랙 구성 꼬리는 뺌
//   'GB300 NVL72' → ['GB300'] · 'B300 (Blackwell Ultra)' → ['B300'] · 'H100 / H200' → ['H100', 'H200']
//   'H200 / B200 / B300 / MI350X (mixed)' → ['H200', 'B200', 'B300', 'MI350X'] · 'Vera Rubin' → ['Vera Rubin']
function gpuModels(model) {
  return String(model)
    .replace(/\([^)]*\)/g, ' ')   // 괄호 설명 빼기: (air-cooled) · (Blackwell Ultra) · (mixed)
    .split('/')                   // 모델이 여럿이면 하나씩
    .map((m) => m.replace(/\bNVL\d+\b/gi, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}
// 개요 칩·건물 이름표의 GPU 표 글자: GPU 모델을 아는 건물이면 액체냉각·공랭 상관없이 모두
//   (Horizon 1~4 = GB300, 스위트워터 1단계 = Vera Rubin, 공랭 홀 = B300, 프린스조지 혼합 홀 = H200·B200·B300·MI350X)
//   모델이 여럿이면 '·' 로 이음. GPU 정보가 없으면 null
export function gpuTag(b) {
  const model = b?.gpu?.model
  if (!model) return null
  const models = gpuModels(model)
  return models.length ? models.join('·') : null
}

// 정규식에서 뜻이 있는 글자(. ( ) 등)를 글자 그대로 찾게 바꿈
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 개요 칩·건물 이름표에 쓰는 { name: 이름, tag: GPU 표 }
//   이름에 표와 같은 모델 글자가 있으면 이름에서 빼서 "GB300 … GB300" 처럼 두 번 나오지 않게
//     프린스조지 "GB300 액체냉각 홀" → "액체냉각 홀" + GB300 표 · 매켄지 "공랭 B300 홀" → "공랭 홀" + B300 표
//     "초기 GPU 파일럿 (H100/H200)" → 괄호째 빼서 "초기 GPU 파일럿" + H100·H200 표
//   (예전엔 반대로 표를 뺐는데, 그러면 이름에 모델이 든 홀만 표가 없어 한눈에 비교가 안 됐음)
//   이름 고르기는 pickName(i18n/useT.js)과 같은 규칙 — 그 파일은 앱 상태(store)까지 불러와서 여기서는 직접 씀
export function gpuLabel(b, lang) {
  const full = (lang === 'ko' && b?.name_ko) || b?.name || ''
  const tag = gpuTag(b)
  if (!tag) return { name: full, tag: null }
  let name = full
  for (const m of gpuModels(b.gpu.model)) {
    // 앞뒤가 영문·숫자가 아닌 곳만 뺌 (GB300 속의 B300 은 다른 모델). 앞쪽은 글자 하나를 잡아 두었다가 되돌려 놓음
    //   — 앞을 살피는 정규식(?<!…)은 옛 iOS Safari 에서 오류가 나서 쓰지 않음
    name = name.replace(new RegExp(`(^|[^A-Za-z0-9])${escapeRe(m)}(?![A-Za-z0-9])`, 'g'), '$1')
  }
  name = name
    .replace(/\(\s*[/·,\s]*\)/g, '')   // 모델만 들어 있던 괄호: "(H100/H200)" → "(/)" → 괄호째 지움
    .replace(/\s+/g, ' ')
    .trim()
  if (!name) return { name: full, tag: null }   // 이름이 모델뿐이었으면 이름을 그대로 두고 표는 뺌
  if (name !== full) name = name.replace(/^[a-z]/, (c) => c.toUpperCase())   // 영어 "liquid-cooled hall" → "Liquid-cooled hall"
  return { name, tag }
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
