// 현재 언어(store.lang)에 맞는 문자열 사전을 돌려주는 훅.
// 사용법: const t = useT();  t.kpi.operating
import ko from './ko.js'
import en from './en.js'
import { useAppStore } from '../store/useAppStore.js'

const DICTS = { ko, en }

export function useT() {
  const lang = useAppStore((s) => s.lang)
  return DICTS[lang] ?? ko
}

// 사이트/건물처럼 "name_ko" 가 있을 때 언어에 맞는 이름을 고릅니다.
export function pickName(obj, lang) {
  if (lang === 'ko' && obj.name_ko) return obj.name_ko
  return obj.name
}
