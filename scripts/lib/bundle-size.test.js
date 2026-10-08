import { it, expect } from 'vitest'
import { collectChunks } from './bundle-size.mjs'

it('동적 Scene을 포함해 정적 의존성을 합산하고 공유·순환 의존성은 중복 계산하지 않음', () => {
  const manifest = {
    app: { file: 'app.js', imports: ['runtime'], dynamicImports: ['scene'] },
    scene: { file: 'scene.js', imports: ['runtime', 'engine'] },
    runtime: { file: 'runtime.js' },
    engine: { file: 'engine.js', imports: ['scene'] },
  }
  expect(collectChunks(manifest, ['app'])).toEqual(['app.js', 'runtime.js'])
  expect(new Set(collectChunks(manifest, ['app', 'scene']))).toEqual(new Set(['app.js', 'runtime.js', 'scene.js', 'engine.js']))
})
it('진입점이 사라지면 조용히 과소계산하지 않고 실패', () => {
  expect(() => collectChunks({}, ['scene'])).toThrow('scene')
})

it('includes map worker and stylesheet assets in the startup budget', () => {
  expect(new Set(collectChunks({map:{file:'map.js',assets:['worker.js'],css:['map.css']}},['map']))).toEqual(new Set(['map.js','worker.js','map.css']))
})
