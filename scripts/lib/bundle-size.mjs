// manifest의 정적 의존성을 순회합니다. 중복·순환 import는 한 번만 계산합니다.
export function collectChunks(manifest, roots) {
  const seen = new Set()
  const files = new Set()
  function visit(key) {
    if (seen.has(key)) return
    const entry = manifest[key]
    if (!entry) throw new Error(`번들 manifest에 없는 진입점: ${key}`)
    seen.add(key)
    if (entry.file.endsWith('.js')) files.add(entry.file)
    for (const dependency of entry.imports ?? []) visit(dependency)
  }
  roots.forEach(visit)
  return [...files]
}
