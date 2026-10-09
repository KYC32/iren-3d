// =============================================================
// sun.js — 캠퍼스 하늘(태양 위치·밤낮) 계산 (순수 함수 → sun.test.js 로 검증)
// -------------------------------------------------------------
// 실제 부지의 위도·경도와 날짜·시각으로 태양의 고도(하늘에서 몇 도 높이)·방위(어느 쪽)를 구합니다.
// 3D 캠퍼스는 지도처럼 "북쪽 = 화면 안쪽(−z), 동쪽 = 오른쪽(+x)"이라고 보고 빛 방향을 정합니다.
// (캠퍼스 배치는 도식이라 실제 건물 방향과 다를 수 있음 — 그림자는 분위기 연출이지 측량이 아님)
// 계산식: 천문 연감의 저정밀 근사식 (오차 약 0.5° — 화면 연출에는 충분)
// =============================================================
const RAD = Math.PI / 180

// 하늘 모드: 낮 / 노을 / 밤 / 지금(그 부지의 실제 현지 시각)
export const SKY_MODES = ['day', 'dusk', 'night', 'live']

// 태양 위치: date(실제 시각), lat·lng(도) → { elevation: 고도(도, 음수면 지평선 아래), azimuth: 방위(도, 북=0 동=90 남=180 서=270) }
export function sunPosition(date, lat, lng) {
  const d = date.getTime() / 86400000 - 10957.5 // 2000-01-01 12:00 UTC(J2000) 로부터 지난 날 수
  const g = (357.529 + 0.98560028 * d) * RAD    // 평균 근점 이각 (지구 공전 궤도 위치)
  const q = 280.459 + 0.98564736 * d            // 태양의 평균 황경 (도)
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD // 실제 황경
  const e = (23.439 - 0.00000036 * d) * RAD     // 자전축 기울기
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L))      // 적경
  const dec = Math.asin(Math.sin(e) * Math.sin(L))                    // 적위 (계절에 따라 ±23.4°)
  const gmst = 18.697374558 + 24.06570982441908 * d                  // 그리니치 항성시 (시간)
  const H = (gmst * 15 + lng) * RAD - ra                              // 시간각: 0 이면 정오(남중)
  const phi = lat * RAD
  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H))
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H))
  return { elevation: el / RAD, azimuth: (az / RAD + 360) % 360 }
}

// 타임라인의 달(월 번호) 15일, 그 부지의 "태양시" hour 시 → 실제 UTC 시각
// 태양시 = 해가 가장 높을 때를 12시로 보는 시각 (경도 15° = 1시간). 시간대·서머타임과 무관해 계산이 단순함
export function solarDate(month, hour, lng) {
  const y = Math.floor(month / 12), mo = month % 12
  return new Date(Date.UTC(y, mo, 15) + (hour - lng / 15) * 3600000)
}

// 고도·방위(도) → 장면 속 빛 방향 단위 벡터 [x, y, z] (빛이 "오는" 쪽)
function dirOf(azimuth, elevation) {
  const a = azimuth * RAD, e = elevation * RAD
  return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)]
}

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

// 프리셋 시각들
const DAY_HOUR = 10.5     // 낮 = 태양시 오전 10시 30분 (기존 화면과 비슷한 남동쪽 아침 햇빛)
const MIN_DAY_EL = 30     // 낮 빛의 최소 고도 — 고위도 겨울(예: 매켄지 12월)에도 그림자가 너무 길어지지 않게
const MIN_SHADOW_EL = 10  // 노을·실시간에서도 이보다 낮게 눕히지 않음 (지평선 빛은 그림자가 캠퍼스 밖까지 늘어짐)
const DUSK_EL = 6         // 노을 = 저녁 해가 이 고도까지 내려온 때
const MOON_EL = 40        // 밤의 달빛 고도 (방향은 낮 해와 같은 쪽 → 건물 앞면이 읽히게)

// 노을 시각의 태양: 정오부터 6분 간격으로 내려가며 고도가 DUSK_EL 아래로 처음 떨어지는 때
function duskSun(month, lat, lng) {
  for (let h = 12; h <= 23; h += 0.1) {
    const s = sunPosition(solarDate(month, h, lng), lat, lng)
    if (s.elevation < DUSK_EL) return s
  }
  return sunPosition(solarDate(month, 20, lng), lat, lng) // 백야처럼 해가 안 지는 경우 (지금 데이터엔 없음)
}

// 하늘 목표값: 모드·부지·달(·지금 시각) → { dir: 빛 방향, night: 밤 정도 0~1, golden: 노을 정도 0~1, elevation: 실제 태양 고도 }
//   SkyRig 가 이 목표로 조명·배경색을 부드럽게 옮기고, 건물 창문은 night·golden 으로 불을 켭니다.
export function skyTarget(mode, { lat, lng }, month, now = new Date()) {
  const day = sunPosition(solarDate(month, DAY_HOUR, lng), lat, lng)
  const moon = dirOf(day.azimuth, MOON_EL)
  if (mode === 'night') return { dir: moon, night: 1, golden: 0, elevation: -30 }
  if (mode === 'dusk') {
    const s = duskSun(month, lat, lng)
    return { dir: dirOf(s.azimuth, MIN_SHADOW_EL), night: 0.15, golden: 1, elevation: s.elevation }
  }
  if (mode === 'live') {
    const s = sunPosition(now, lat, lng)
    const night = 1 - smoothstep(-8, 2, s.elevation)                           // 해가 지평선 2° 아래로 → 밤
    const golden = (1 - smoothstep(4, 18, s.elevation)) * smoothstep(-6, 1, s.elevation) // 해가 낮게 걸린 때만 노을빛
    const sun = dirOf(s.azimuth, Math.max(s.elevation, MIN_SHADOW_EL))
    const mixed = sun.map((v, i) => v * (1 - night) + moon[i] * night)        // 해 → 달로 방향을 섞음
    const len = Math.hypot(...mixed)
    return { dir: mixed.map((v) => v / len), night, golden, elevation: s.elevation }
  }
  return { dir: dirOf(day.azimuth, Math.max(day.elevation, MIN_DAY_EL)), night: 0, golden: 0, elevation: day.elevation }
}

// 부지의 현지 시각 'HH:MM' — 시간대(tz)가 있으면 그 시간대(서머타임 포함), 없으면 경도로 계산한 태양시
export function localClock(now, { tz, lng = 0 }) {
  if (tz) {
    try {
      return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(now)
    } catch { /* 모르는 시간대 → 아래 태양시로 */ }
  }
  const mins = Math.round((now.getUTCHours() * 60 + now.getUTCMinutes() + lng * 4 + 1440) % 1440)
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}
