/**
 * Vector runner (GP-11): every case in vectors/lomboktemplate-vectors-v1.json.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TemplateError, render } from '../src/index.js'

interface Case {
  id: string
  template: string
  data: unknown
  partials?: Record<string, string>
  options?: { strict?: boolean }
  expected: { output?: string; error?: string }
}

const doc = JSON.parse(readFileSync(new URL('../vectors/lomboktemplate-vectors-v1.json', import.meta.url), 'utf8')) as { cases: Case[] }

function run(c: Case): { output: string } | { error: string } {
  try {
    return { output: render(c.template, c.data, { partials: c.partials ?? {}, strict: c.options?.strict ?? false }) }
  } catch (e) {
    if (e instanceof TemplateError) return { error: e.code }
    throw e
  }
}

describe('lomboktemplate vectors v1', () => {
  it('has at least 100 cases', () => expect(doc.cases.length).toBeGreaterThanOrEqual(100))
  for (const c of doc.cases) it(c.id, () => expect(run(c)).toEqual(c.expected))
})
