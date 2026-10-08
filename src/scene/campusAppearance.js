// Visual references describe materials and building typology, never surveyed footprints.
// Childress official gallery was inspected on 2026-10-08; image capture dates are unknown.
export const CAMPUS_APPEARANCES = {
  childress: {
    source: 'https://iren.com/data-centers/childress',
    referenceImages: ['/media/iren/childress-main.avif', '/media/iren/childress-interior.avif'],
    background: '#edf0ed', ground: '#d6cebb', road: '#949992',
    roof: '#d8dfdc', wall: '#8fa6ae', endWall: '#597f91', steel: '#929e99',
    notes_ko: '기존 채굴동의 긴 저층 형태·청회색 외벽·금속 지붕과 환기 설비, 건조한 지형을 반영했습니다.',
    notes_en: 'Long, low mining sheds, blue-grey cladding, metal roofs and ventilation, with dry terrain, follow official campus photos.',
  },
}
export const campusAppearance = (siteId) => CAMPUS_APPEARANCES[siteId] ?? null
