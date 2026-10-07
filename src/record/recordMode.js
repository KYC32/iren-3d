// 녹화 모드 설정 읽기
// 주소 예: /?record=x        → 16:9 (1920×1080, X/트위터용)
//         /?record=shorts   → 9:16 (1080×1920, 쇼츠/릴스용)
//         /?record=x&only=12.5  → 12.5초 한 장만 그려 preview 로 저장 (점검용)
//         /?record=og&only=3 → 1200×630 링크 미리보기 이미지(OG) 한 장
//         &lang=en           → 영어 자막
const q = new URLSearchParams(window.location.search)
const fmt = q.get('record')

export const RECORD = fmt
  ? {
      format: fmt === 'shorts' ? 'shorts' : fmt === 'og' ? 'og' : 'x',
      W: fmt === 'shorts' ? 1080 : fmt === 'og' ? 1200 : 1920,
      H: fmt === 'shorts' ? 1920 : fmt === 'og' ? 630 : 1080,
      SS: 2, // 2배 크기로 그린 뒤 줄여서 계단 현상 줄이기 (슈퍼샘플링)
      FPS: 30,
      // only=3,14.5,25 처럼 여러 시점을 주면 그 장면들만 미리보기로 저장
      only: q.has('only') ? q.get('only').split(',').map(Number) : null,
      lang: q.get('lang') === 'en' ? 'en' : 'ko',
    }
  : null
