// 한 프레임 동안 지난 시간을 월 단위로 반영합니다 (느린 프레임에서도 시간 보존).
export function advancePlayback(month, elapsed, maxMonth, stepMs) {
  const steps = Math.floor(elapsed / stepMs)
  return {
    month: Math.min(maxMonth, month + steps),
    remainder: elapsed % stepMs,
    finished: month + steps >= maxMonth,
  }
}
