// =============================================================
// tour.mjs — 자동 투어 한국어 음성 만들기: 단계마다 읽을 문장 → Qwen3-TTS 'Sohee' 목소리 → 작은 소리 파일
// -------------------------------------------------------------
// 사용법:
//   PYTHON=<TTS 가상환경>/bin/python node scripts/narrate/tour.mjs
// 하는 일:
//   1) src/tour/tourNarration.js 의 TOUR_NARRATION_KO 를 읽음 (숫자 없음·이름 한글은 tourNarration.test.js 가 검사)
//   2) scripts/narrate/speak.py 로 문장마다 소리 조각을 만듦 (영상 내레이션과 같은 도구 — 같은 문장은 저장해 둔 것을 다시 씀)
//   3) ffmpeg 로 AAC(.m4a, 모노 24kHz 40kbps)로 줄여 public/audio/tour/<단계 id>.m4a 에 씀
//   4) public/audio/tour/manifest.json = { clips: { 단계 id: { src, sec, hash } } } — hash = 문장 지문
//      (문장을 고치고 이 스크립트를 안 돌리면 시험이 실패해서 낡은 소리가 배포되지 않음)
// 작업 폴더 video/narration/tour-ko 는 git 에 올라가지 않음 (영상 작업과 같은 규칙)
// =============================================================
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOUR_NARRATION_KO } from '../../src/tour/tourNarration.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ids = Object.keys(TOUR_NARRATION_KO)
const work = path.join(ROOT, 'video', 'narration', 'tour-ko')
const out = path.join(ROOT, 'public', 'audio', 'tour')
mkdirSync(work, { recursive: true })
mkdirSync(out, { recursive: true })

// 1·2) 소리 조각 (파이썬 — speak.py 가 01.wav, 02.wav … 와 clips.json 을 씀)
writeFileSync(path.join(work, 'lines.json'), JSON.stringify({ language: 'Korean', speaker: 'Sohee', lines: ids.map((id) => ({ say: TOUR_NARRATION_KO[id] })) }, null, 1))
const py = spawnSync(process.env.PYTHON ?? 'python3', ['-I', path.join(ROOT, 'scripts/narrate/speak.py'), work], { stdio: 'inherit' })
if (py.status !== 0) { console.error('❌ speak.py 실패 — PYTHON 에 TTS 가상환경의 python 을 주세요'); process.exit(1) }
const { durations } = JSON.parse(readFileSync(path.join(work, 'clips.json'), 'utf8'))

// 3) 작은 파일로 (말소리라 모노·24kHz·40kbps 면 충분 — 한 문장 약 25KB)
const clips = {}
ids.forEach((id, i) => {
  const wav = path.join(work, `${String(i + 1).padStart(2, '0')}.wav`)
  const m4a = path.join(out, `${id}.m4a`)
  const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '24000', '-c:a', 'aac', '-b:a', '40k', '-movflags', '+faststart', m4a], { stdio: 'inherit' })
  if (ff.status !== 0) { console.error(`❌ ffmpeg 실패: ${id}`); process.exit(1) }
  const say = TOUR_NARRATION_KO[id]
  clips[id] = { src: `/audio/tour/${id}.m4a`, sec: Math.round(durations[i] * 100) / 100, hash: createHash('sha1').update(say).digest('hex').slice(0, 12) }
  console.log(`  ${id.padEnd(20)} ${clips[id].sec.toFixed(2)}초  ${say}`)
})

// 4) 목록
writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({
  voice: 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice · Sohee', license: 'Apache-2.0', lang: 'ko', clips,
}, null, 1) + '\n')
console.log(`✅ public/audio/tour — 소리 ${ids.length}개 + manifest.json (단계 길이 안에 드는지는 npm test 가 검사)`)
