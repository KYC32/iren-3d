// =============================================================
// TourPlayer — 자동 투어 진행기: 대본(tourSteps.js)을 한 단계씩 화면에 적용하고 자막 카드를 띄움
// -------------------------------------------------------------
// 단계가 바뀌면 store 액션으로 화면을 옮깁니다 (지도 이동 / 3D 진입 / 본사 3D / 계약 구역 / 건물 / 날짜 / 하늘).
// 단계 길이(dur)만큼 기다렸다가 다음으로 넘어가고, 사용자는 이전·다음·일시정지·끝내기를 누를 수 있습니다.
// 키보드: ← → 이동, 스페이스 일시정지, Esc 끝내기.
// 투어는 store.tour 가 있을 때만 그려지고(App.jsx), 끝나면 stopTour 가 날짜·하늘을 되돌립니다.
// 음성 안내(한국어만, 2026-10-28): 단계마다 미리 만든 소리 파일(public/audio/tour — Qwen3-TTS 'Sohee', scripts/narrate/tour.mjs)
//   기본은 꺼짐 · 스피커 단추로 켜면 이 기기에서 기억(localStorage) · 문장엔 숫자가 없어 자료가 바뀌어도 자막과 어긋나지 않음
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.js'
import { useT } from '../i18n/useT.js'
import { buildTourSteps } from '../tour/tourSteps.js'

// 음성 안내 설정 (이 기기에서 기억 — 저장소를 못 쓰는 창이면 늘 꺼짐으로 시작)
const VOICE_KEY = 'iren-tour-voice'
const readVoice = () => { try { return localStorage.getItem(VOICE_KEY) === '1' } catch { return false } }
const saveVoice = (on) => { try { localStorage.setItem(VOICE_KEY, on ? '1' : '0') } catch { /* 저장 못 해도 이번 투어엔 적용 */ } }
// 소리 파일 목록 (작은 JSON — 한국어 투어를 열 때 한 번 받음 · 없거나 실패하면 스피커 단추를 숨김)
let voiceList = null
const loadVoiceList = () => (voiceList ??= fetch('/audio/tour/manifest.json').then((r) => (r.ok ? r.json() : null)).catch(() => null))

// 한 단계를 화면에 적용
function applyStep(step) {
  const st = useAppStore.getState()
  st.setPlaying(false)
  st.setMonth(step.month ?? st.asOfMonth)
  st.setSkyMode(step.sky ?? 'day')
  // 페이지 단계(사업 현황): 지도 위에 페이지를 띄움 (투어는 계속). 다음 단계로 가면 페이지를 닫음
  if (step.page) { st.setPage(step.page, null, { fromTour: true }); return }
  if (st.page) st.setPage(null, null, { fromTour: true })
  // 본사 단계: 시드니 본사 3D 화면 (이미 본사면 카메라만 처음 시점으로, 열린 약속 카드는 닫음)
  if (step.view === 'hq') {
    if (st.view === 'hq' && st.surface === '3d') { st.closeHqCard(); st.requestCampusHome() }
    else st.enterHq3D()
    return
  }
  if (step.surface === 'map') {
    if (step.site) st.focusSiteOnMap(step.site)
    else { st.setMapRegion(step.region ?? 'NA'); st.setCampusListOpen(window.innerWidth >= 768) }
    return
  }
  // 3D: 같은 캠퍼스에 이미 있으면 전체 보기로 되돌리고, 아니면 진입
  if (st.surface === '3d' && st.selectedSiteId === step.site) st.requestCampusHome()
  else st.enterSite3D(step.site)
  if (step.zone) useAppStore.getState().selectZone(step.zone)
  if (step.building) useAppStore.getState().selectBuilding(step.building, true)
  // 좁은 화면: 캠퍼스 패널이 3D 를 거의 다 가리므로 접어 둠 (건물 속 단계는 패널 카드를 보여 줘야 해서 그대로)
  if (window.innerWidth < 768 && !step.building) useAppStore.getState().setCampusPanelCollapsed(true)
}

export default function TourPlayer() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const data = useAppStore((s) => s.data)
  const tour = useAppStore((s) => s.tour)
  const setTourStep = useAppStore((s) => s.setTourStep)
  const stopTour = useAppStore((s) => s.stopTour)
  // 대본은 데이터·언어가 바뀔 때만 다시 만듦 (날짜는 투어가 스스로 바꾸므로 기준일 데이터로 고정)
  const steps = useMemo(() => {
    const st = useAppStore.getState()
    const base = st.month === st.asOfMonth ? data : null
    return buildTourSteps(base ?? data, lang)
  }, [data, lang]) // eslint-disable-line react-hooks/exhaustive-deps
  const [paused, setPaused] = useState(false)
  const [voice, setVoice] = useState(readVoice)   // 음성 안내 켜짐
  const [clips, setClips] = useState(null)       // 단계 id → { src, sec }
  const audio = useRef(null)                     // 소리 재생기 하나를 계속 씀 (브라우저가 한 번 허락한 재생기)
  const [elapsed, setElapsed] = useState(0) // 이 단계에서 지난 시간(ms) — 일시정지 후 이어서 재생하려고 기억
  const index = Math.min(tour?.step ?? 0, steps.length - 1)
  const step = steps[index]
  const stepRef = useRef(null)

  // 단계가 바뀌면 화면 적용 + 진행 시간 초기화
  useEffect(() => {
    if (!step || stepRef.current === `${tour.seq}:${index}`) return
    stepRef.current = `${tour.seq}:${index}`
    setElapsed(0)
    applyStep(step)
  }, [step, index, tour?.seq])

  // 자동 진행 타이머 (일시정지면 멈춤)
  useEffect(() => {
    if (!step || paused) return
    const start = performance.now() - elapsed
    const id = setInterval(() => {
      const e = performance.now() - start
      if (e >= step.dur) {
        clearInterval(id)
        if (index + 1 < steps.length) setTourStep(index + 1)
        else stopTour()
      } else setElapsed(e)
    }, 100)
    return () => clearInterval(id)
  }, [step, index, paused, steps.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // 음성 안내: 한국어면 소리 파일 목록을 받아 둠 (단추를 누르는 순간 바로 재생해야 브라우저가 소리를 허락함)
  useEffect(() => { if (lang === 'ko') loadVoiceList().then((m) => setClips(m?.clips ?? null)) }, [lang])
  const speak = (id) => {
    const a = (audio.current ??= new Audio())
    const clip = clips?.[id]
    if (!clip) { a.pause(); return }
    if (!a.src.endsWith(clip.src)) a.src = clip.src
    a.currentTime = 0
    a.play().catch(() => {})   // 브라우저가 막으면(사용자 동작 전) 조용히 넘어감 — 다음 단계나 단추를 누르면 다시 시도
  }
  // 단계가 바뀌면 그 단계 문장을 처음부터 (일시정지 중이면 기다림)
  useEffect(() => {
    if (voice && lang === 'ko' && clips && step && !paused) speak(step.id)
    else audio.current?.pause()
  }, [voice, lang, clips, step?.id, tour?.seq, paused]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => audio.current?.pause(), [])   // 투어가 끝나면 소리도 멈춤
  const toggleVoice = () => {
    const on = !voice
    setVoice(on); saveVoice(on)
    if (on && step && !paused) speak(step.id)   // 누른 순간 재생 (사용자 동작 안에서 시작해야 소리가 허락됨)
    else audio.current?.pause()
  }

  // 키보드
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return
      if (e.key === 'Escape') stopTour()
      else if (e.key === 'ArrowRight') { e.preventDefault(); setTourStep(Math.min(index + 1, steps.length - 1)) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setTourStep(Math.max(index - 1, 0)) }
      else if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p) }
    }
    window.addEventListener('keydown', onKey, true) // capture: 타임라인 슬라이더의 ←→ 처리보다 먼저
    return () => window.removeEventListener('keydown', onKey, true)
  }, [index, steps.length, setTourStep, stopTour])

  if (!step) return null
  const pct = Math.min(100, (elapsed / step.dur) * 100)
  return (
    <div className="tour-card panel" role="dialog" aria-live="polite" aria-label={t.tour.start}>
      <div className="tour-progress" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      <div className="tour-body">
        <small>{index + 1} {t.tour.of} {steps.length}</small>
        <b>{step.title}</b>
        <p>{step.text}</p>
      </div>
      <div className="tour-actions">
        <button onClick={() => setTourStep(Math.max(index - 1, 0))} disabled={index === 0} aria-label={t.tour.prev} title={t.tour.prev}><ChevronLeft size={16} /></button>
        <button onClick={() => setPaused((p) => !p)} aria-label={paused ? t.tour.resume : t.tour.pause} title={paused ? t.tour.resume : t.tour.pause} aria-pressed={paused}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
        <button onClick={() => (index + 1 < steps.length ? setTourStep(index + 1) : stopTour())} aria-label={t.tour.next} title={t.tour.next}><ChevronRight size={16} /></button>
        {lang === 'ko' && clips && <button onClick={toggleVoice} aria-pressed={voice} aria-label={voice ? '음성 안내 끄기' : '음성 안내 켜기'} title={voice ? '음성 안내 끄기' : '음성 안내 켜기 (한국어 · AI 음성)'}>{voice ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>}
        <button className="tour-stop" onClick={stopTour} aria-label={t.tour.stop} title={t.tour.stop}><X size={14} /><span>{t.tour.stop}</span></button>
      </div>
      <div className="tour-hint">{t.tour.hint}</div>
    </div>
  )
}
