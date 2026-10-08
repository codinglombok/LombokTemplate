/**
 * Random and adversarial input: only TemplateError may escape, and time stays linear.
 */
import { describe, expect, it } from 'vitest'
import { TemplateError, render } from '../src/index.js'

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32 }
}

const PIECES = ['{{', '}}', '{{{', '}}}', '#if a', '#each xs', '/if', '/each', 'else', '^', '!', '>', '|', ':', "'", '"', '(', ')', '~', 'a', 'xs', '.', '../', '@index', ' ', '\n', 'x', '=', 'upper', 'add', '1']

describe('robustness', () => {
  it('only throws TemplateError on 5000 random templates', () => {
    const r = rng(42)
    for (let n = 0; n < 5000; n++) {
      let t = ''
      const len = 1 + Math.floor(r() * 30)
      for (let i = 0; i < len; i++) t += PIECES[Math.floor(r() * PIECES.length)]
      try {
        render(t, { a: 1, xs: [1, 2] }, { partials: { a: '{{a}}' } })
      } catch (e) {
        if (!(e instanceof TemplateError)) throw new Error(`non-TemplateError for ${JSON.stringify(t)}: ${String(e)}`)
      }
    }
  })

  it('handles long and repetitive input in linear time', () => {
    const cases = [
      '{{'.repeat(50_000),
      '{'.repeat(200_000),
      '{{a}}'.repeat(50_000),
      'x\n'.repeat(100_000) + '{{#if a}}{{/if}}',
      '{{!' + '-'.repeat(100_000),
      '{{' + "'".repeat(100_000) + '}}',
    ]
    for (const t of cases) {
      const start = performance.now()
      try { render(t, { a: 1 }) } catch (e) { expect(e).toBeInstanceOf(TemplateError) }
      expect(performance.now() - start).toBeLessThan(2000)
    }
  })
})
