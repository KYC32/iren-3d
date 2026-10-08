// Visual environments, not surveyed site plans. Reviewed 2026-10-08.
// Photo seasons/dates are not known: the timeline never changes these surroundings.
const texas = {
  type: 'scrub', background: '#eff0e9', ground: '#d2c4a7', soil: '#beaa89', field: '#c1c09a',
  foliage: ['#75815b', '#8c966c', '#a4a378'], grass: '#a8a479', trunk: '#87775e',
  trees: 30, shrubs: 100, relief: .22, road: '#92968d',
}
const forest = {
  type: 'forest', background: '#eaf0ea', ground: '#c4c6b7', soil: '#adb5a0', field: '#9da98b',
  foliage: ['#50755e', '#678369', '#799478'], grass: '#8c9b74', trunk: '#827769',
  trees: 110, shrubs: 65, relief: .55, road: '#8b9690',
}
const official = slug => `https://iren.com/data-centers/${slug}`
export const CAMPUS_LANDSCAPES = {
  childress: {
    ...texas, source: official('childress'),
    regionalSource: 'https://hallhall.com/property-for-sale/texas/diamond-h-headquarters/a09Nu000008tH6r/',
    notes_ko: '칠드레스 항공사진의 평탄한 흙빛 부지와 마른 초지, 낮은 수목 군락을 반영했습니다.',
    notes_en: 'Flat earth-toned terrain, dry grassland and clusters of low trees follow Childress aerial imagery.',
  },
  'sweetwater-1': {
    ...texas, trees: 18, turbines: true, source: official('sweetwater'),
    notes_ko: '스위트워터 공식 사진의 넓은 초지와 관목, 멀리 보이는 풍력발전기를 반영했습니다. 풍력발전기는 주변 경관이며 캠퍼스 전력 공급원을 뜻하지 않습니다.',
    notes_en: 'Open grassland, scrub and distant turbines follow official Sweetwater photos. Turbines depict the surroundings, not a campus power supply.',
  },
  'prince-george': {
    ...forest, mixed: true, source: official('prince-george'),
    notes_ko: '프린스조지 공식 현장 사진의 숲과 자갈 부지를 반영했습니다. 침엽수와 활엽수의 높이·밀도에 변화를 주었습니다.',
    notes_en: 'Woodland and gravel grounds follow official Prince George photos, with varied conifer and broadleaf heights and density.',
  },
  mackenzie: {
    ...forest, trees: 130, source: official('mackenzie'),
    regionalSource: 'https://www.datacentermap.com/canada/prince-george/iren-mackenzie/',
    notes_ko: '매켄지 공개 항공사진의 넓은 정지 부지와 주변 침엽수림을 반영했습니다.',
    notes_en: 'A cleared pad and surrounding conifer woodland follow published Mackenzie aerial imagery.',
  },
  'canal-flats': {
    ...forest, trees: 90, relief: .8, ridges: true, source: official('canal-flats'),
    regionalSource: 'https://www.canalflats.ca/your-canal-flats/',
    notes_ko: '커낼플랫츠 공식 사진과 지역 자료의 침엽수림·산간 계곡 분위기를 반영했습니다. 배경 능선의 모양과 거리는 축약 표현입니다.',
    notes_en: 'Conifers and a mountain-valley setting follow official campus imagery and local references. Background ridges are simplified.',
  },
  bundey: {
    ...texas, trees: 18, shrubs: 120, ground: '#d6c8ac', soil: '#c8ad89', field: '#baba95',
    foliage: ['#849276', '#9ca386', '#a4aa8d'], source: official('bundey'),
    regionalSource: 'https://www.realestate.com.au/sold/property-lifestyle-sa-morgan-7156392',
    notes_ko: '공식 번디 소개 이미지와 남호주 지역 사진을 참고해 건조한 흙, 낮은 관목과 성긴 수목을 표현했습니다. 현장 경계·시설 배치는 미확인입니다.',
    notes_en: 'The official Bundey introduction and regional South Australian imagery inform dry soil, scrub and sparse trees. Site boundaries and facilities are unverified.',
  },
  kiowa: {
    ...texas, trees: 46, shrubs: 65, relief: .5, ground: '#caccb3', soil: '#b5b396', field: '#a4b48b',
    foliage: ['#64805b', '#7c9468', '#8e9f70'], source: official('oklahoma'),
    regionalSource: 'https://www.land.com/property/250-acres-in-Pittsburg-County-Oklahoma/17419861/',
    notes_ko: '공식 오클라호마 소개 이미지와 피츠버그 카운티 지역 사진의 초지·활엽수 군락을 참고했습니다. 현장 주변 배치는 미확인입니다.',
    notes_en: 'Meadows and broadleaf clusters reference the official Oklahoma introduction and Pittsburg County photographs. The actual site surroundings are unverified.',
  },
}
CAMPUS_LANDSCAPES['sweetwater-2'] = { ...CAMPUS_LANDSCAPES['sweetwater-1'], turbines: false,
  notes_ko: '스위트워터 지역의 건조한 초지와 낮은 관목을 반영했습니다. 2번 부지의 정확한 주변 배치는 미확인입니다.',
  notes_en: 'Dry grassland and low scrub reflect the Sweetwater region; the precise surroundings of site 2 remain unverified.' }

export const campusLandscape = id => CAMPUS_LANDSCAPES[id] ?? null

export function terrainHeight(x, z, side, relief) {
  const edge = Math.max(Math.abs(x), Math.abs(z))
  const rise = Math.min(1, Math.max(0, (edge - side / 2 - 2) / 6))
  return -.28 + rise * relief * (.48 + Math.sin(x * .17) * .22 + Math.cos(z * .23) * .2)
}

// Static, seeded placement keeps trees stable across timeline changes and re-renders.
// Leave the capacity diagram, truck road and incoming power corridor unobstructed.
export function landscapePlants(siteId, side, roadZ, powerZ, profile) {
  let seed = [...siteId].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7)
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
  const plants = [], half = side / 2
  const counts = [profile.trees, profile.shrubs, 230]
  for (let type = 0; type < counts.length; type++) {
    for (let attempts = 0, added = 0; added < counts[type] && attempts < 4000; attempts++) {
      const x = (random() - .5) * side * 2.15, z = (random() - .5) * side * 2.15
      if (Math.max(Math.abs(x), Math.abs(z)) < half + 1.7 || Math.hypot(x, z) > side * 1.13) continue
      if (Math.abs(z - roadZ) < 3.5 || (x < -half && Math.abs(z - powerZ) < 1.8)) continue
      // Patchy vegetation, with more open ground at the front of the model.
      if (type === 0 && (Math.sin(x * .29) + Math.cos(z * .37) < -.2 || (z > half && random() < .5))) continue
      const scale = type === 0 ? .7 + random() * .7 : type === 1 ? .3 + random() * .5 : .14 + random() * .19
      plants.push({ type, x, z, y: terrainHeight(x, z, side, profile.relief), scale, angle: random() * Math.PI * 2, color: profile.foliage[Math.floor(random() * profile.foliage.length)] })
      added++
    }
  }
  return plants
}
