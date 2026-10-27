// =============================================================
// translateGuard.js — 뉴스 제목 기계 번역 검사기 (순수 함수)
// -------------------------------------------------------------
// 작은 번역 모델(Kanana 1.5)은 문장은 자연스럽지만 숫자·금액을 틀리거나 없는 내용을 지어낼 때가 있음
//   (2026-10-26 비교: "$2.8bn" → "2.8억 달러"(10배 틀림), 지시문 속 예시를 다른 제목에 끼워 넣음)
// 그래서 아래를 모두 지킨 번역만 쓰고, 하나라도 어기면 영어 원문을 그대로 보임 (틀린 한국어보다 원문이 나음)
//   1) 한자가 없고 한글이 들어 있음
//   2) 숫자 목록이 원문과 같음 (빠지거나 새로 생긴 숫자 없음)
//   3) 금액 표기($2.8bn · $2.6 Billion)는 원문 글자 그대로 (억·조로 바꾸지 않음)
//   4) 대문자 낱말(티커·약어)은 원문에 있던 것만, 원문의 IREN 은 그대로
//   5) 지나치게 길지 않음
//   6) 회사·매체·사람 이름은 원문 글자 그대로 또는 정해 둔 한국어 표기로만 (고유명사 표 translateNames.json)
//      2026-10-27 검토: 숫자 검사만으로는 'IREN Limited' → 'IREN 제한회사'(9건 중 9건),
//      'Applied Digital' → '적용 디지털'(14건 중 9건), 매체 'The Information' → '정보 제공' 같은 오역이 그대로 통과했음
//   7) 번역에 나온 영어 낱말은 원문에 있던 것만 ('IREN, Inc.' 처럼 원문에 없는 'Inc' 를 지어내면 탈락)
// scripts/apply-translations.mjs 가 쓰고, 결과는 public/data/news-ko.json
// =============================================================
import NAME_FILE from './translateNames.json' with { type: 'json' }

const NUM = /\d+(?:[.,]\d+)*/g
const MONEY = /\$\s?\d+(?:[.,]\d+)*\s?(?:bn|billion|million|mn|m|k|trillion|tn)?\b/gi
const LATIN_UP = /\b[A-Z][A-Z0-9]{1,6}\b/g
const HAN = /[一-鿿]/
const HANGUL = /[가-힣]/g

const EXCHANGE = /\b(NASDAQ|NYSE)\s?:\s?([A-Z]{1,6})\b/g          // "NASDAQ:IREN" 같은 거래소:티커
const EXCHANGE_KO = { NASDAQ: /NASDAQ|나스닥/, NYSE: /NYSE|뉴욕증권거래소|뉴욕 증권거래소/ }
const ENGLISH_LEFT = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|June|July|August|September|October|November|December)\b/

const list = (re, s) => (String(s).match(re) ?? []).map((x) => x.replace(/\s+/g, '').toLowerCase()).sort()

// 고유명사 표: { en, ko: [허용 한국어 표기], bad?: [들어 있으면 탈락하는 글자] }
export const NAMES = NAME_FILE.names
const LATIN_WORD = /[A-Za-z]{2,}/g
const squash = (s) => String(s).toLowerCase().replace(/\s+/g, ' ')
// 원문에 그 이름이 낱말로 들어 있는지 (대소문자 무시, 'Cipher' 는 'Cipher Digital' 에도 맞음)
//   앞 글자 검사는 뒷보기 (?<!…) 대신 (^|[^A-Za-z0-9]) — 옛 iOS Safari 가 뒷보기를 못 읽음 (같은 규칙을 화면 코드에도 씀)
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const nameRe = (en) => new RegExp(`(^|[^A-Za-z0-9])${escapeRe(en)}(?![A-Za-z0-9])`, 'i')
const NAME_RES = NAMES.map((n) => [n, nameRe(n.en)])

// src: 영어 원문 · out: 번역 → 'ok' 또는 탈락 까닭 ('empty'·'han'·'not-korean'·'numbers'·'money'·'new-token'·'iren'·'exchange'·'name'·'new-latin'·'english-left'·'too-long')
export function checkTranslation(src, out) {
  const o = String(out ?? '').trim()
  if (!o) return 'empty'
  if (HAN.test(o)) return 'han'
  if ((o.match(HANGUL) ?? []).length < 4) return 'not-korean'
  if (list(MONEY, src).some((m) => !list(MONEY, o).includes(m))) return 'money'
  if (list(NUM, src).join('|') !== list(NUM, o).join('|')) return 'numbers'
  // 6) 고유명사: 원문에 있는 이름은 번역에도 원문 글자나 허용 표기로 남아야 하고, 뜻으로 옮긴 글자(bad)는 없어야 함
  let rest = o   // 4)·7) 검사용 — 허용 표기 속 영어 글자('오픈AI' 의 AI)는 빼고 셈
  for (const [n, re] of NAME_RES) {
    if (!re.test(src)) continue
    if (!re.test(o) && !n.ko.some((k) => squash(o).includes(squash(k)))) return 'name'
    if ((n.bad ?? []).some((b) => o.includes(b))) return 'name'
    for (const k of n.ko) rest = rest.split(k).join(' ')
  }
  const srcUp = new Set(String(src).match(LATIN_UP) ?? [])
  if ((rest.match(LATIN_UP) ?? []).some((w) => !srcUp.has(w))) return 'new-token'
  if (srcUp.has('IREN') && !/\bIREN\b/.test(o)) return 'iren'
  if (/아이언|아이렌|이렌|아이리엔/.test(o)) return 'iren'   // 회사 이름을 한글로 옮긴 표기 (원문엔 늘 IREN)
  // 거래소:티커 → 티커와 거래소(영문 또는 '나스닥')가 남아야 함 (실제로 "IREN(주식회사)"로 바꾼 번역이 있었음)
  for (const [, ex, tk] of String(src).matchAll(EXCHANGE)) if (!new RegExp(`\\b${tk}\\b`).test(o) || !EXCHANGE_KO[ex].test(o)) return 'exchange'
  // 7) 번역의 영어 낱말(2글자 이상)은 원문에도 있어야 함 (대소문자 무시)
  const srcWords = new Set((String(src).match(LATIN_WORD) ?? []).map((w) => w.toLowerCase()))
  if ((rest.match(LATIN_WORD) ?? []).some((w) => !srcWords.has(w.toLowerCase()))) return 'new-latin'
  if (ENGLISH_LEFT.test(o)) return 'english-left'   // 요일·달을 영어로 남긴 번역 (덜 옮긴 것)
  if (o.length > String(src).length * 2.5 + 20) return 'too-long'
  return 'ok'
}
