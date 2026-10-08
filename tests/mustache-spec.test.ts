/**
 * Mustache spec (https://github.com/mustache/spec, MIT): interpolation, sections,
 * inverted sections, comments and partials. Delimiter changes, lambdas, dynamic
 * names and inheritance are outside the language (SPEC section 1.2).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { render } from '../src/index.js'

interface SpecTest { name: string; desc: string; data: unknown; template: string; partials?: Record<string, string>; expected: string }

for (const file of ['interpolation', 'sections', 'inverted', 'comments', 'partials']) {
  const spec = JSON.parse(readFileSync(new URL(`./fixtures/${file}.json`, import.meta.url), 'utf8')) as { tests: SpecTest[] }
  describe(`mustache spec: ${file}`, () => {
    for (const t of spec.tests) {
      it(t.name, () => {
        expect(render(t.template, t.data, { partials: t.partials ?? {} })).toBe(t.expected)
      })
    }
  })
}
