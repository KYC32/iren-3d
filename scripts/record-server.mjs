// =============================================================
// 영상 녹화 서버 (Node 기본 기능만 사용)
// 사용법: npm run record   → 빌드 후 http://localhost:4180 에서 서버 시작
//   1) 브라우저로 http://localhost:4180/?record=x       (16:9, X용)
//      또는     http://localhost:4180/?record=shorts  (9:16, 쇼츠용)  을 엽니다.
//   2) 페이지가 프레임(PNG)을 한 장씩 보내면 video/<형식>/0000.png … 로 저장
//   3) 끝나면 ffmpeg 로 video/iren-<형식>-<언어>.mp4 를 자동으로 만듭니다.
// 점검용: /?record=x&only=12.5 → 12.5초 한 장만 video/preview-x.png 로 저장
//
// 자동 모드 (브라우저를 직접 열 필요 없음 — 헤드리스 Chrome 을 띄워 녹화 후 종료):
//   node scripts/record-server.mjs all              → 16:9 + 9:16 둘 다
//   node scripts/record-server.mjs x --lang=en      → 16:9 영어 자막
//   node scripts/record-server.mjs shorts --only=12 → 9:16 12초 한 장 미리보기
//   (헤드리스 Chrome 은 임시 프로필을 써서 평소 쓰는 Chrome 과 섞이지 않습니다)
// =============================================================
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')       // npm run build 결과물
const VIDEO = path.join(ROOT, 'video')     // 프레임·영상 저장 폴더 (git 제외)
const PORT = 4181
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const argv = process.argv.slice(2)
const MODE = argv.find((a) => !a.startsWith('--')) // x | shorts | all | (없으면 수동)
const ONLY = argv.find((a) => a.startsWith('--only='))?.split('=')[1]
const LANG = argv.find((a) => a.startsWith('--lang='))?.split('=')[1] === 'en' ? 'en' : 'ko'
const queue = MODE === 'all' ? ['x', 'shorts'] : MODE ? [MODE] : []
let chrome = null
let profileDir = null
function cleanupChrome() {
  chrome?.kill()
  // Chrome 이 종료되며 프로필에 마지막 파일을 쓰는 중일 수 있어 재시도하며 삭제
  if (profileDir) {
    try { fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }) } catch { /* 다음 실행 때 정리 */ }
  }
  chrome = null
  profileDir = null
}
// 이전 실행에서 남은 임시 프로필 정리
for (const d of fs.existsSync(path.join(ROOT, 'video')) ? fs.readdirSync(path.join(ROOT, 'video')) : []) {
  if (d.startsWith('.chrome-')) try { fs.rmSync(path.join(ROOT, 'video', d), { recursive: true, force: true }) } catch {}
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }

fs.mkdirSync(VIDEO, { recursive: true })
const cleared = new Set() // 형식별로 첫 프레임이 올 때 이전 프레임 폴더를 비움

function makeMp4(fmt, lang, then) {
  const out = path.join(VIDEO, `ai-infra-map-${fmt}-${lang}.mp4`)
  const args = ['-y', '-framerate', '30', '-i', path.join(VIDEO, fmt, '%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', out]
  console.log('ffmpeg 로 합치는 중…')
  const p = spawn('ffmpeg', args, { stdio: 'ignore' })
  p.on('close', (code) => {
    console.log(code === 0 ? `✅ 완성: ${out}` : `❌ ffmpeg 실패 (code ${code})`)
    then?.()
  })
}

// 헤드리스 Chrome 으로 다음 형식 녹화 시작 (큐가 비면 종료)
function next() {
  cleanupChrome()
  const fmt = queue.shift()
  if (!fmt) {
    if (MODE) { console.log('모든 녹화 완료'); process.exit(0) }
    return
  }
  const url = `http://localhost:${PORT}/?record=${fmt}&lang=${LANG}${ONLY ? `&only=${ONLY}` : ''}`
  const profile = (profileDir = fs.mkdtempSync(path.join(VIDEO, '.chrome-')))
  console.log(`▶ 녹화 시작 [${fmt}] ${url}`)
  chrome = spawn(CHROME, [
    '--headless=new', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,800', '--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', url,
  ], { stdio: 'ignore' })
}
process.on('exit', cleanupChrome)
process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    const fmt = ['shorts', 'og'].includes(url.searchParams.get('fmt')) ? url.searchParams.get('fmt') : 'x'

    // 보안: 저장 요청(POST)은 이 서버가 띄운 녹화 페이지에서 온 것만 받습니다.
    // (녹화 중 브라우저로 연 다른 웹사이트가 localhost 로 요청을 보내는 것을 차단)
    if (req.method === 'POST') {
      const origin = req.headers.origin
      if (origin && origin !== `http://localhost:${PORT}` && origin !== `http://127.0.0.1:${PORT}`) {
        res.statusCode = 403
        return res.end('forbidden origin')
      }
    }

    // 프레임 한 장 저장: POST /frame?fmt=x&i=번호
    if (req.method === 'POST' && url.pathname === '/frame') {
      const i = url.searchParams.get('i') ?? ''
      // 보안: 프레임 번호는 숫자, 미리보기는 "preview-12.5" 형식만 허용 → 파일 이름에 ../ 같은 경로가 끼어들 수 없음
      if (!/^\d{1,5}$/.test(i) && !/^preview-\d{1,3}(\.\d)?$/.test(i)) {
        res.statusCode = 400
        return res.end('bad frame id')
      }
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        let file
        if (i.startsWith('preview')) {
          file = path.join(VIDEO, `${i.replace('preview', `preview-${fmt}`)}.png`)
        } else {
          const dir = path.join(VIDEO, fmt)
          if (!cleared.has(fmt) && i === '0') { fs.rmSync(dir, { recursive: true, force: true }); cleared.add(fmt) }
          fs.mkdirSync(dir, { recursive: true })
          file = path.join(dir, String(i).padStart(4, '0') + '.png')
        }
        fs.writeFileSync(file, Buffer.concat(chunks))
        if (i.startsWith('preview')) console.log('미리보기 저장:', file)
        else if (Number(i) % 60 === 0) console.log(`[${fmt}] 프레임 ${i}`)
        res.end('ok')
      })
      return
    }

    // 녹화 끝: mp4 합치기
    if (req.method === 'POST' && url.pathname === '/done') {
      if (url.searchParams.get('preview')) { res.end('ok'); if (MODE) next(); return }
      cleared.delete(fmt)
      const n = fs.readdirSync(path.join(VIDEO, fmt)).length
      console.log(`DONE [${fmt}] ${n} frames`)
      makeMp4(fmt, url.searchParams.get('lang') === 'en' ? 'en' : 'ko', MODE ? next : null)
      return res.end('ok')
    }

    // 그 밖에는 dist 폴더의 정적 파일 (없으면 index.html)
    let file = path.join(DIST, decodeURIComponent(url.pathname))
    if (!file.startsWith(DIST)) { res.statusCode = 403; return res.end() }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream')
    fs.createReadStream(file).pipe(res)
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`record server: http://localhost:${PORT}/?record=x  |  ?record=shorts`)
    if (MODE) next()
  })
