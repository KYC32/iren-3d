// =============================================================
// fetch-util.mjs — 외부 데이터 받기 공통 도구 (주가·뉴스 갱신 스크립트가 씀)
// -------------------------------------------------------------
//   fetchWithUa        : 제한 시간 + 429/5xx 재시도(백오프) 붙인 fetch
//   sleep              : ms 만큼 기다림 (요청 간격 두기 — SEC 는 초당 10회 제한)
//   readJsonOr         : 파일이 없거나 깨졌으면 대체값
//   writeJsonIfChanged : 내용이 바뀐 경우에만 저장 → git 에 쓸데없는 변경이 생기지 않음
// 외부 요청에는 사용자 개인정보(이메일)를 넣지 않습니다.
// SEC 는 User-Agent 에 "이름 이메일" 꼴을 요구하고(없으면 403) 괄호·URL 이 섞여도 거절하므로 단순한 꼴로 둡니다.
// =============================================================
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const BOT_UA = 'iren-3d research bot research@example.com' // SEC 는 괄호·URL 이 들어간 UA 를 403 으로 거절함
// 일부 공개 API 는 브라우저처럼 보이지 않으면 거절 → 브라우저 UA
export const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function fetchWithUa(url, { headers = {}, timeoutMs = 20000, retries = 2, as = 'text' } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': BOT_UA, ...headers }, signal: AbortSignal.timeout(timeoutMs) })
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true })
      return as === 'json' ? res.json() : res.text()
    } catch (e) {
      lastErr = e
      if (e.fatal || attempt === retries) break
      await sleep(1000 * 3 ** attempt) // 1초 → 3초 → 9초
    }
  }
  throw lastErr
}

export function readJsonOr(path, fallback) {
  try { return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback } catch { return fallback }
}

// 바뀐 경우만 저장. ignoreKeys 에 적은 최상위 키(예: fetched_at)만 다르면 "안 바뀐 것"으로 봄
//   pretty: 사람이 고치는 data/*.json 처럼 2칸 들여쓰기로 저장 (내용 비교는 들여쓰기와 무관)
export function writeJsonIfChanged(path, obj, { ignoreKeys = [], pretty = false } = {}) {
  const strip = (o) => { if (!o || typeof o !== 'object') return o; const c = { ...o }; for (const k of ignoreKeys) delete c[k]; return c }
  const prev = readJsonOr(path, null)
  if (prev && JSON.stringify(strip(prev)) === JSON.stringify(strip(obj))) return false
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(obj, null, pretty ? 2 : undefined) + '\n')
  return true
}
