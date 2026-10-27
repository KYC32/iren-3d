// =============================================================
// narrate.mjs — 영상 내레이션 만들기: 읽을 문장 → Qwen3-TTS 'Sohee' 목소리 → 시간표에 맞춘 소리 파일 하나
// -------------------------------------------------------------
// 사용법:
//   PYTHON=<TTS 가상환경>/bin/python node scripts/narrate/narrate.mjs          (한국어)
//   그다음 node scripts/record-server.mjs all  → 영상에 video/narration-ko.wav 가 자동으로 들어감
// 하는 일:
//   1) src/record/storyboard.js 의 NARRATION[lang] 을 검사 (narration.js checkNarration — 화면에 없는 숫자 금지 등)
//   2) scripts/narrate/speak.py 로 문장마다 소리 조각을 만듦 (같은 문장은 저장해 둔 것을 다시 씀)
//   3) placeClips 로 시작 시각·빠르기를 정하고 ffmpeg 로 하나로 합침 → video/narration-<lang>.wav (영상 길이와 같음)
// 결과는 video/ 아래라 git 에 올라가지 않음
// =============================================================
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CARDS, NARRATION, DURATION } from '../../src/record/storyboard.js'
import { checkNarration, placeClips } from '../../src/record/narration.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const lang = process.argv.find((a) => a.startsWith('--lang='))?.split('=')[1] ?? 'ko'
const VOICE = { ko: { language: 'Korean', speaker: 'Sohee' } }   // 다른 언어는 목소리를 정한 뒤 추가
const lines = NARRATION[lang]
if (!lines || !VOICE[lang]) { console.error(`❌ ${lang} 내레이션이 없음 (storyboard.js NARRATION · narrate.mjs VOICE)`); process.exit(1) }

// 1) 문장 검사
const problems = checkNarration(CARDS[lang], lines, DURATION)
if (problems.length) { console.error('❌ 읽을 문장 문제:\n  ' + problems.join('\n  ')); process.exit(1) }

// 2) 소리 조각 만들기 (파이썬)
const dir = path.join(ROOT, 'video', 'narration', lang)
mkdirSync(dir, { recursive: true })
writeFileSync(path.join(dir, 'lines.json'), JSON.stringify({ ...VOICE[lang], lines: lines.map(({ say }) => ({ say })) }, null, 1))
const py = spawnSync(process.env.PYTHON ?? 'python3', ['-I', path.join(ROOT, 'scripts/narrate/speak.py'), dir], { stdio: 'inherit' })
if (py.status !== 0) { console.error('❌ speak.py 실패 — PYTHON 에 TTS 가상환경의 python 을 주세요'); process.exit(1) }
const { durations } = JSON.parse(readFileSync(path.join(dir, 'clips.json'), 'utf8'))

// 3) 시간표에 놓기 → ffmpeg 로 합치기
const { clips, problems: late } = placeClips(lines, durations)
if (late.length) { console.error('❌ 시간 안에 안 들어감:\n  ' + late.join('\n  ')); process.exit(1) }
const out = path.join(ROOT, 'video', `narration-${lang}.wav`)
const inputs = clips.flatMap((_, i) => ['-i', path.join(dir, `${String(i + 1).padStart(2, '0')}.wav`)])
// 조각마다: (필요하면) 빠르게 → 시작 시각만큼 뒤로 미룸 → 모두 섞음 → 영상 길이로 맞춤
const chains = clips.map((c, i) => {
  const ms = Math.round(c.start * 1000)
  const tempo = c.speed > 1.0001 ? `atempo=${c.speed.toFixed(4)},` : ''
  return `[${i}:a]${tempo}aresample=48000,adelay=${ms}:all=1[a${i}]`
})
const mix = `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0,apad,atrim=0:${DURATION}[out]`
const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', [...chains, mix].join(';'), '-map', '[out]', '-ac', '1', '-ar', '48000', out], { stdio: 'inherit' })
if (ff.status !== 0) { console.error('❌ ffmpeg 실패'); process.exit(1) }
// 어떤 문장으로 만든 소리인지 남김 → record-server 가 스토리보드와 다르면 소리를 넣지 않고 알림
writeFileSync(path.join(ROOT, 'video', `narration-${lang}.json`), JSON.stringify({ lines }, null, 1))
clips.forEach((c, i) => console.log(`  #${i + 1} ${c.start.toFixed(2)}~${c.end.toFixed(2)}초${c.speed > 1.0001 ? ` · ${c.speed.toFixed(2)}배` : ''}  ${lines[i].say}`))
console.log(`✅ ${path.relative(ROOT, out)} (${DURATION}초) — 이제 node scripts/record-server.mjs all 로 영상에 들어감`)
