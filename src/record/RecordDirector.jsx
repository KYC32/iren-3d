// =============================================================
// RecordDirector — 녹화 모드에서 영상을 한 프레임씩 만들어 녹화 서버로 보냅니다.
// -------------------------------------------------------------
// 프레임마다:
//   1) 스토리보드에서 지금 장면(shot)을 찾아 지구본/캠퍼스 화면을 맞추고
//   2) 카메라를 장면의 동선 함수로 배치하고
//   3) advance(t): R3F 시계를 정확히 t초로 맞춰 애니메이션(트럭·크레인·링)을 진행시키고 렌더
//   4) 3D 그림을 2D 캔버스에 옮긴 뒤 라벨·자막·페이드를 그려
//   5) PNG 로 /frame 에 POST  → 녹화 서버가 저장 → 끝나면 ffmpeg 가 mp4 로 합침
// Canvas 는 frameloop="never" 라서 화면 속도와 상관없이 정확히 30fps 로 찍힙니다.
// =============================================================
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useAppStore } from '../store/useAppStore.js'
import { latLngToVec3, spreadPins, labelRanks, pinHeight, fmtMw } from '../scene/geo.js'
import { layoutCampus } from '../scene/layoutCampus.js'
import { styleOf, PENDING_COLOR } from '../data/statusStyle.js'
import ko from '../i18n/ko.js'
import en from '../i18n/en.js'
import { RECORD } from './recordMode.js'
import { DURATION, CARDS, shotAt, fadeAt, clamp01, easeInOut, lerp } from './storyboard.js'
import { drawPill, drawCards, drawFade } from './overlay.js'

// 숨겨진 브라우저 탭에서는 setTimeout 이 크게 늦춰지므로(탭 절전),
// MessageChannel 로 "한 차례 양보"하며 조건을 기다립니다. (탭 상태와 무관하게 동작)
const yieldTask = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0) })
async function waitFor(cond, timeoutMs = 15000) {
  const end = performance.now() + timeoutMs
  while (!cond() && performance.now() < end) await yieldTask()
  return cond()
}
async function settleFrames(n = 5) { for (let i = 0; i < n; i++) await yieldTask() }

// 지구본 전체가 화면에 알맞게 들어오는 고도 (세로 화면은 가로 폭 기준으로 더 멀리)
function globeBaseAlt(aspect) {
  const D = 200 / 0.78 / (0.536 * Math.min(1, aspect)) // 0.536 = 2·tan(15°), fov 30
  return D / 100 - 1
}

export default function RecordDirector() {
  const { camera, gl, scene, advance } = useThree()
  const data = useAppStore((s) => s.data)

  useEffect(() => {
    if (!data || !RECORD) return
    let cancelled = false
    const { W, H, FPS, only, lang, format } = RECORD
    const t = lang === 'en' ? en : ko
    const aspect = W / H
    const baseAlt = globeBaseAlt(aspect)
    const sites = data.sites
    const byId = Object.fromEntries(sites.map((s) => [s.id, s]))
    const display = spreadPins(sites)
    const ranks = labelRanks(sites)
    const layouts = Object.fromEntries(sites.map((s) => [s.id, layoutCampus(s)]))
    // 캠퍼스에서 카메라가 바라볼 곳: 실제 건물(빈 부지 제외)과 변전소의 중심
    const focusOf = Object.fromEntries(
      Object.entries(layouts).map(([id, L]) => {
        const pts = [...L.blocks.filter((b) => b.kind !== 'lot').map((b) => [b.x, b.z]), [L.substation.x, L.substation.z]]
        const cx = pts.reduce((n, p) => n + p[0], 0) / pts.length
        const cz = pts.reduce((n, p) => n + p[1], 0) / pts.length
        return [id, new Vector3(cx, 0, cz)]
      }),
    )
    const name = (o) => (lang === 'ko' && o.name_ko ? o.name_ko : o.name)
    const v = new Vector3()

    // ---------- 1) 화면(지구본/캠퍼스) 맞추기 ----------
    async function ensureView(shot) {
      const st = useAppStore.getState()
      if (shot.type === 'site') {
        if (st.view === 'site' && st.selectedSiteId === shot.site) return
        useAppStore.setState({ view: 'site', selectedSiteId: shot.site, hoverId: null })
        // React 가 캠퍼스를 실제로 만들 때까지 기다림
        await waitFor(() => scene.getObjectByName(`site-${shot.site}`))
        await settleFrames()
      } else {
        if (st.view === 'globe') return
        useAppStore.setState({ view: 'globe', selectedSiteId: null, hoverId: null })
        await waitFor(() => !scene.getObjectByName(`site-${st.selectedSiteId}`))
        await settleFrames()
      }
    }

    // ---------- 2) 카메라 동선 ----------
    function placeCamera(time, shot) {
      const p = clamp01((time - shot.t0) / (shot.t1 - shot.t0))
      const e = easeInOut(p)
      if (shot.type === 'globe' && shot.fly) {
        // 사이트로 날아 들어가기: 위치는 사이트 상공으로, 시선은 지구 중심 → 사이트 지표로
        const site = byId[shot.fly]
        const f = shot.cam.from
        const lat = lerp(f.lat, site.lat, e), lng = lerp(f.lng, site.lng, e)
        const alt = lerp(f.alt * baseAlt, 0.8, e) // 너무 가까이 가면 핀 머리가 화면을 가림
        camera.position.copy(latLngToVec3(lat, lng, alt))
        camera.lookAt(latLngToVec3(site.lat, site.lng, 0).multiplyScalar(e))
      } else if (shot.type === 'globe') {
        const { from: a, to: b } = shot.cam
        camera.position.copy(latLngToVec3(lerp(a.lat, b.lat, e), lerp(a.lng, b.lng, e), lerp(a.alt, b.alt, e) * baseAlt))
        camera.lookAt(0, 0, 0)
      } else {
        // 캠퍼스 주위를 천천히 돌며 살짝 다가감
        const L = layouts[shot.site]
        const o = shot.orbit
        const R = L.side * 2.3 * lerp(o.dist0, o.dist1, e) * (aspect < 1 ? 1.45 : 1)
        // 가로 영상은 부지 중심, 세로 영상은 실제 건물 중심을 바라봄 (좁은 화면에 빈 부지보다 건물을)
        const target = aspect < 1 ? focusOf[shot.site] : new Vector3()
        const az = lerp(o.az0, o.az1, e)
        const polar = lerp(o.polar0, o.polar1, e)
        camera.position.set(
          target.x + R * Math.sin(polar) * Math.sin(az),
          R * Math.cos(polar),
          target.z + R * Math.sin(polar) * Math.cos(az),
        )
        camera.lookAt(target)
      }
      // 세로 영상의 캠퍼스 장면: 자막(화면 62% 높이) 위쪽에 캠퍼스가 오도록 화면 프레임을 아래로 12% 밀기
      const fw = gl.domElement.width, fh = gl.domElement.height
      if (aspect < 1 && shot.type === 'site') camera.setViewOffset(fw, fh, 0, fh * 0.12, fw, fh)
      else if (camera.view?.enabled) camera.clearViewOffset()
      camera.updateMatrixWorld()
    }

    // 3D 좌표 → 2D 화면 좌표 (화면 밖이면 null)
    function project(pos) {
      v.copy(pos).project(camera)
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return null
      return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H]
    }

    // ---------- 4) 3D 라벨을 2D 로 ----------
    function drawLabels(o, shot, time) {
      // 세로 영상은 휴대폰에서 보므로 라벨을 더 크게
      const u = (Math.min(W, H) / 1080) * (aspect < 1 ? 1.35 : 1)
      // 아웃트로 정리 카드가 떠 있는 동안은 라벨을 그리지 않음 (카드 뒤로 비치지 않게)
      if (CARDS[lang].some((c) => c.kind === 'outro' && time >= c.t0)) return
      if (shot.type === 'globe') {
        for (const s of sites) {
          const r = ranks[s.id]
          if (!r.lead) continue
          const d = display[s.id]
          const base = latLngToVec3(d.lat, d.lng, 0)
          const n = base.clone().normalize()
          // 지구 뒤편이면 숨김 (카메라 방향과 지표 법선 비교)
          const facing = camera.position.clone().sub(base).normalize().dot(n)
          if (facing < 0.2) continue
          const pos = base.add(n.multiplyScalar(pinHeight(s.grid_mw) + 4))
          const xy = project(pos)
          if (!xy) continue
          const more = r.members.length ? ` +${r.members.length}` : ''
          drawPill(o, xy[0], xy[1], u * 1.15, { color: styleOf(s.status).color, text: name(s), sub: fmtMw(s.grid_mw) + more, alpha: clamp01((facing - 0.2) / 0.2) })
        }
      } else {
        const site = byId[shot.site]
        const L = layouts[shot.site]
        const bById = Object.fromEntries(site.buildings.map((b) => [b.id, b]))
        for (const b of L.blocks) {
          if (!b.isAnchor) continue
          const xy = project(new Vector3(b.x, b.h + 1.6, b.z))
          if (!xy) continue
          const bld = b.buildingId ? bById[b.buildingId] : null
          const text = bld ? name(bld) : fmtMw(L.remainingMw)
          const sub = bld ? (bld.customer ?? t.status[b.status]) : lang === 'ko' ? '용도 미발표' : 'unallocated'
          drawPill(o, xy[0], xy[1], u * 1.05, { color: styleOf(b.status).color, text, sub })
        }
        // 변전소
        const sxy = project(new Vector3(L.substation.x, 4, L.substation.z))
        if (sxy) {
          const energized = L.substation.status === 'energized'
          drawPill(o, sxy[0], sxy[1], u * 1.05, {
            color: energized ? styleOf('operating').color : PENDING_COLOR,
            text: lang === 'ko' ? '변전소' : 'Substation',
            sub: energized ? fmtMw(L.substation.mw) : `${t.panel.energized} ${L.substation.dates?.target ?? ''}`,
          })
        }
      }
    }

    // ---------- 전체 루프 ----------
    async function run() {
      const out = document.createElement('canvas')
      out.width = W
      out.height = H
      const o = out.getContext('2d')
      o.imageSmoothingQuality = 'high'
      await document.fonts.ready
      // 육지 타일·경계선 데이터(fetch)가 씬에 올라올 때까지 기다림 (최대 15초)
      await waitFor(() => scene.getObjectByName('land-hexes') && scene.getObjectByName('borders'))
      await settleFrames(20) // 인스턴스 배치(useLayoutEffect)까지 끝나도록 몇 박자 더
      const total = Math.round(DURATION * FPS)
      const frames = only != null ? only.map((sec) => Math.round(sec * FPS)) : [...Array(total).keys()]
      for (const f of frames) {
        if (cancelled) return
        const time = f / FPS
        const shot = shotAt(time)
        await ensureView(shot)
        placeCamera(time, shot)
        advance(time) // R3F 시계 = time 초, useFrame 실행 + 렌더
        o.clearRect(0, 0, W, H)
        o.drawImage(gl.domElement, 0, 0, W, H) // 2배 크기 3D 그림을 줄여서 옮김
        drawLabels(o, shot, time)
        drawCards(o, time, W, H, lang, format)
        drawFade(o, W, H, fadeAt(time))
        const blob = await new Promise((r) => out.toBlob(r, 'image/png'))
        await fetch(`/frame?fmt=${format}&i=${only != null ? `preview-${(f / FPS).toFixed(1)}` : f}`, { method: 'POST', body: blob })
        document.title = `녹화 ${f + 1}/${total}`
      }
      await fetch(`/done?fmt=${format}&lang=${lang}${only != null ? '&preview=1' : ''}`, { method: 'POST' })
      document.title = '녹화 완료'
    }
    run().catch((e) => {
      document.title = '녹화 오류'
      console.error(e)
    })
    return () => { cancelled = true }
  }, [data, camera, gl, scene, advance])

  return null
}
