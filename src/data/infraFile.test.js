// 빌드 결과(infra.json)가 화면에서 쓰는 스키마(InfraFile)를 통과하는지 검사
// — 데이터 빌드에 새 항목을 추가하고 스키마를 깜빡하면, 개발 화면이 "스키마 오류"로 비어 버림 (2026-10-09 실제로 있었음)
import { describe, it, expect } from 'vitest'
import { buildInfra } from '../../scripts/build-data.mjs'
import { InfraFile } from './schema.js'

describe('infra.json', () => {
  it('passes the InfraFile schema that the app validates against', () => {
    const r = InfraFile.safeParse(buildInfra())
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true)
  })
})
