/**
 * LombokTemplate - built-in helpers and filters (SPEC section 8).
 *
 * Every built-in is deterministic and locale-independent, so all ports give the
 * same output. Locale-aware formatting (currency, dates) is registered by the
 * application, for example with LombokLocale.
 */
import { SafeString, escapeHTML, isTruthy, stringify, type Helper } from './render.js'

const fail = (msg: string): never => { throw new Error(msg) }

function arity(name: string, args: unknown[], min: number, max = min): void {
  if (args.length < min || args.length > max) {
    fail(min === max ? `${name} takes ${min} argument(s), got ${args.length}` : `${name} takes ${min}-${max} arguments, got ${args.length}`)
  }
}

const DECIMAL = /^[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$/

/** SPEC 8.3: numbers, or strings in decimal notation. */
function toNumber(name: string, v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && DECIMAL.test(v.trim())) return Number(v.trim())
  return fail(`${name} needs numbers, got ${v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v}`)
}

function compare(a: unknown, b: unknown): number | null {
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0
  if (typeof a === 'string' && typeof b === 'string') {
    const x = [...a].map(c => c.codePointAt(0)!)
    const y = [...b].map(c => c.codePointAt(0)!)
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i]! < y[i]! ? -1 : 1
    return x.length - y.length === 0 ? 0 : x.length < y.length ? -1 : 1
  }
  return null
}

const codePoints = (s: string): string[] => [...s]
const ASCII_WS = /^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel'])

/** JSON with sorted keys and no whitespace (SPEC 8.6). */
export function toJSON(v: unknown, depth = 0): string {
  if (depth > 64) fail('json: nesting deeper than 64')
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return Number.isFinite(v) ? stringify(v) : 'null'
  if (typeof v === 'string') {
    return '"' + v.replace(/[\u0000-\u001f"\\]/g, c => {
      const m: Record<string, string> = { '"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' }
      return m[c] ?? '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
    }) + '"'
  }
  if (v instanceof SafeString) return toJSON(v.value, depth)
  if (Array.isArray(v)) return '[' + v.map(x => toJSON(x, depth + 1)).join(',') + ']'
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const keys = Object.keys(obj).sort((a, b) => compare(a, b)!)
    return '{' + keys.map(k => toJSON(k) + ':' + toJSON(obj[k], depth + 1)).join(',') + '}'
  }
  return 'null'
}

export const BUILTIN_HELPERS: ReadonlyMap<string, Helper> = new Map<string, Helper>([
  // comparison (8.2)
  ['eq', a => { arity('eq', a, 2); return a[0] === a[1] || (a[0] == null && a[1] == null) }],
  ['ne', a => { arity('ne', a, 2); return !(a[0] === a[1] || (a[0] == null && a[1] == null)) }],
  ['gt', a => { arity('gt', a, 2); const c = compare(a[0], a[1]); return c !== null && c > 0 }],
  ['gte', a => { arity('gte', a, 2); const c = compare(a[0], a[1]); return c !== null && c >= 0 }],
  ['lt', a => { arity('lt', a, 2); const c = compare(a[0], a[1]); return c !== null && c < 0 }],
  ['lte', a => { arity('lte', a, 2); const c = compare(a[0], a[1]); return c !== null && c <= 0 }],
  ['and', a => { if (a.length < 2) fail('and takes at least 2 arguments'); return a.every(isTruthy) }],
  ['or', a => { if (a.length < 2) fail('or takes at least 2 arguments'); return a.some(isTruthy) }],
  ['not', a => { arity('not', a, 1); return !isTruthy(a[0]) }],

  // arithmetic (8.3)
  ['add', a => { arity('add', a, 2); return toNumber('add', a[0]) + toNumber('add', a[1]) }],
  ['sub', a => { arity('sub', a, 2); return toNumber('sub', a[0]) - toNumber('sub', a[1]) }],
  ['mul', a => { arity('mul', a, 2); return toNumber('mul', a[0]) * toNumber('mul', a[1]) }],
  ['div', a => {
    arity('div', a, 2)
    const d = toNumber('div', a[1])
    if (d === 0) fail('div by zero')
    return toNumber('div', a[0]) / d
  }],

  // strings and collections (8.4)
  ['default', a => { arity('default', a, 2); return a[0] === undefined || a[0] === null || a[0] === '' ? a[1] : a[0] }],
  ['upper', a => { arity('upper', a, 1); return stringify(a[0]).toUpperCase() }],
  ['lower', a => { arity('lower', a, 1); return stringify(a[0]).toLowerCase() }],
  ['trim', a => { arity('trim', a, 1); return stringify(a[0]).replace(ASCII_WS, '') }],
  ['truncate', a => {
    arity('truncate', a, 2, 3)
    const n = toNumber('truncate', a[1])
    if (!Number.isInteger(n) || n < 0) fail('truncate length must be a non-negative integer')
    const cps = codePoints(stringify(a[0]))
    return cps.length > n ? cps.slice(0, n).join('') + (a.length > 2 ? stringify(a[2]) : '\u2026') : cps.join('')
  }],
  ['length', a => {
    arity('length', a, 1)
    const v = a[0]
    if (Array.isArray(v)) return v.length
    if (typeof v === 'string') return codePoints(v).length
    if (v !== null && typeof v === 'object' && !(v instanceof SafeString)) return Object.keys(v).length
    return 0
  }],
  ['join', a => {
    arity('join', a, 1, 2)
    if (!Array.isArray(a[0])) return stringify(a[0])
    return a[0].map(stringify).join(a.length > 1 ? stringify(a[1]) : ',')
  }],

  // HTML (8.5)
  ['nl2br', a => { arity('nl2br', a, 1); return new SafeString(escapeHTML(stringify(a[0])).replace(/\r?\n/g, '<br>')) }],
  ['raw', a => { arity('raw', a, 1); return new SafeString(stringify(a[0])) }],
  ['safeUrl', a => {
    arity('safeUrl', a, 1)
    const url = stringify(a[0]).replace(ASCII_WS, '')
    const probe = url.replace(/[\u0000-\u0020]/g, '')
    const m = /^([A-Za-z][A-Za-z0-9+.\-]*):/.exec(probe)
    return m && !SAFE_SCHEMES.has(m[1]!.toLowerCase()) ? '' : url
  }],

  // data (8.6)
  ['json', a => { arity('json', a, 1); return toJSON(a[0]) }],
])
