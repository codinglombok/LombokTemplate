import { describe, expect, it } from 'vitest'
import {
  BUILTIN_HELPERS, Environment, SafeString, TemplateError, escapeHTML, isTruthy, render, stringify, toJSON,
} from '../src/index.js'

const err = (fn: () => unknown): TemplateError => {
  try { fn() } catch (e) { if (e instanceof TemplateError) return e; throw e }
  throw new Error('expected a TemplateError')
}

describe('Environment', () => {
  it('compiles once and renders many times', () => {
    const t = new Environment().compile('Hi {{name}}')
    expect(t.render({ name: 'A' })).toBe('Hi A')
    expect(t.render({ name: 'B' })).toBe('Hi B')
    expect(t.render()).toBe('Hi ')
  })

  it('registers helpers usable as call, subexpression and filter', () => {
    const env = new Environment().registerHelper('money', (a, o) => `${o.hash['cur'] ?? 'USD'} ${Number(a[0]).toFixed(2)}`)
    expect(env.render('{{money 5 cur="IDR"}}', {})).toBe('IDR 5.00')
    expect(env.render('{{ n | money }}', { n: 1 })).toBe('USD 1.00')
    expect(env.render('{{#if (money 0)}}y{{/if}}', {})).toBe('y')
    expect(env.hasHelper('money')).toBe(true)
    env.unregisterHelper('money')
    expect(err(() => env.render('{{money 1}}', {})).code).toBe('UNKNOWN_HELPER')
  })

  it('passes context, root and escape to helpers', () => {
    const env = new Environment().registerHelper('peek', (_a, o) => `${stringify((o.context as { v: number }).v)}/${stringify((o.root as { r: string }).r)}/${o.escape('<')}`)
    expect(env.render('{{#each xs}}{{peek 1}} {{/each}}', { xs: [{ v: 1 }], r: 'R' })).toBe('1/R/&amp;lt; ')
  })

  it('does not escape SafeString results', () => {
    const env = new Environment().registerHelper('bold', a => new SafeString(`<b>${escapeHTML(stringify(a[0]))}</b>`))
    expect(env.render('{{bold s}}', { s: '<x>' })).toBe('<b>&lt;x&gt;</b>')
  })

  it('wraps helper exceptions with the helper name and position', () => {
    const env = new Environment().registerHelper('boom', () => { throw new Error('nope') })
    const e = err(() => env.render('a\n {{boom 1}}', {}))
    expect(e.code).toBe('HELPER_ERROR')
    expect([e.line, e.column]).toEqual([2, 2])
    expect(e.message).toContain("helper 'boom' failed: nope")
  })

  it('rethrows TemplateError from helpers unchanged', () => {
    const env = new Environment().registerHelper('t', () => { throw new TemplateError('MISSING_VALUE', 'x') })
    expect(err(() => env.render('{{t 1}}', {})).code).toBe('MISSING_VALUE')
  })

  it('validates helper and partial names', () => {
    const env = new Environment()
    expect(err(() => env.registerHelper('a b', () => 1)).code).toBe('SYNTAX')
    expect(err(() => env.registerPartial('a b', 'x')).code).toBe('SYNTAX')
  })

  it('reports partial syntax errors at registration and supports replacement', () => {
    const env = new Environment()
    expect(err(() => env.registerPartial('p', '{{#if a}}')).code).toBe('SYNTAX')
    env.registerPartial('p', 'one').registerPartial('p', 'two')
    expect(env.render('{{> p}}', {})).toBe('two')
    env.unregisterPartial('p')
    expect(env.render('[{{> p}}]', {})).toBe('[]')
  })

  it('accepts quoted partial names', () => {
    expect(render('{{> "my-part"}}', {}, { partials: { 'my-part': 'ok' } })).toBe('ok')
  })

  it('can start without built-in helpers', () => {
    expect(err(() => new Environment({ builtins: false }).render('{{ a | upper }}', { a: 'x' })).code).toBe('UNKNOWN_HELPER')
  })

  it('limits template and output length', () => {
    expect(err(() => new Environment({ maxTemplateLength: 3 }).render('abcd', {})).code).toBe('LIMIT_EXCEEDED')
    const big = new Environment({ maxOutputLength: 10 })
    expect(err(() => big.render('{{#each xs}}abcd{{/each}}', { xs: [1, 2, 3] })).code).toBe('LIMIT_EXCEEDED')
  })

  it('limits nesting depth by option', () => {
    expect(err(() => new Environment({ maxDepth: 1 }).render('{{#if a}}{{#if a}}{{/if}}{{/if}}', { a: 1 })).code).toBe('LIMIT_EXCEEDED')
  })

  it('reports line and column of syntax errors', () => {
    const e = err(() => render('ok\n  {{#if a}}', {}))
    expect([e.code, e.line, e.column]).toEqual(['SYNTAX', 2, 3])
  })
})

describe('values', () => {
  it('ignores getters, class instances and inherited properties', () => {
    class Box { v = 1 }
    const withGetter = Object.defineProperty({}, 'g', { get: () => 'secret', enumerable: true })
    expect(render('[{{b.v}}][{{o.g}}][{{o.toString}}]', { b: new Box(), o: withGetter })).toBe('[][][]')
  })

  it('treats null-prototype objects as plain data', () => {
    const o = Object.assign(Object.create(null) as Record<string, unknown>, { a: 1 })
    expect(render('{{o.a}}', { o })).toBe('1')
  })

  it('stringifies and tests truthiness per SPEC', () => {
    expect([stringify(NaN), stringify(1e21), stringify(new SafeString('s'))]).toEqual(['NaN', '1e+21', 's'])
    expect([isTruthy(NaN), isTruthy({}), isTruthy([0])]).toEqual([false, true, true])
  })

  it('serializes JSON deterministically', () => {
    expect(toJSON({ b: 1, a: [NaN, undefined, '\u0001'] })).toBe('{"a":[null,null,"\\u0001"],"b":1}')
    expect(toJSON(new SafeString('x'))).toBe('"x"')
    expect(() => toJSON(JSON.parse('['.repeat(70) + ']'.repeat(70)))).toThrow(/nesting/)
  })

  it('exposes the built-in helper table', () => {
    expect([...BUILTIN_HELPERS.keys()].sort()).toEqual([
      'add', 'and', 'default', 'div', 'eq', 'gt', 'gte', 'join', 'json', 'length', 'lower', 'lt', 'lte', 'mul',
      'ne', 'nl2br', 'not', 'or', 'raw', 'safeUrl', 'sub', 'trim', 'truncate', 'upper',
    ])
  })
})
