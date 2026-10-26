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
// scripts/apply-translations.mjs 가 쓰고, 결과는 public/data/news-ko.json
// =============================================================

const NUM = /\d+(?:[.,]\d+)*/g
const MONEY = /\$\s?\d+(?:[.,]\d+)*\s?(?:bn|billion|million|mn|m|k|trillion|tn)?\b/gi
const LATIN_UP = /\b[A-Z][A-Z0-9]{1,6}\b/g
const HAN = /[一-鿿]/
const HANGUL = /[가-힣]/g

const EXCHANGE = /\b(NASDAQ|NYSE)\s?:\s?([A-Z]{1,6})\b/g          // "NASDAQ:IREN" 같은 거래소:티커
const EXCHANGE_KO = { NASDAQ: /NASDAQ|나스닥/, NYSE: /NYSE|뉴욕증권거래소|뉴욕 증권거래소/ }
const ENGLISH_LEFT = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|June|July|August|September|October|November|December)\b/

const list = (re, s) => (String(s).match(re) ?? []).map((x) => x.replace(/\s+/g, '').toLowerCase()).sort()

// src: 영어 원문 · out: 번역 → 'ok' 또는 탈락 까닭 ('empty'·'han'·'not-korean'·'numbers'·'money'·'new-token'·'iren'·'exchange'·'english-left'·'too-long')
export function checkTranslation(src, out) {
  const o = String(out ?? '').trim()
  if (!o) return 'empty'
  if (HAN.test(o)) return 'han'
  if ((o.match(HANGUL) ?? []).length < 4) return 'not-korean'
  if (list(MONEY, src).some((m) => !list(MONEY, o).includes(m))) return 'money'
  if (list(NUM, src).join('|') !== list(NUM, o).join('|')) return 'numbers'
  const srcUp = new Set(String(src).match(LATIN_UP) ?? [])
  if ((o.match(LATIN_UP) ?? []).some((w) => !srcUp.has(w))) return 'new-token'
  if (srcUp.has('IREN') && !/\bIREN\b/.test(o)) return 'iren'
  if (/아이언|아이렌|이렌|아이리엔/.test(o)) return 'iren'   // 회사 이름을 한글로 옮긴 표기 (원문엔 늘 IREN)
  // 거래소:티커 → 티커와 거래소(영문 또는 '나스닥')가 남아야 함 (실제로 "IREN(주식회사)"로 바꾼 번역이 있었음)
  for (const [, ex, tk] of String(src).matchAll(EXCHANGE)) if (!new RegExp(`\\b${tk}\\b`).test(o) || !EXCHANGE_KO[ex].test(o)) return 'exchange'
  if (ENGLISH_LEFT.test(o)) return 'english-left'   // 요일·달을 영어로 남긴 번역 (덜 옮긴 것)
  if (o.length > String(src).length * 2.5 + 20) return 'too-long'
  return 'ok'
}
