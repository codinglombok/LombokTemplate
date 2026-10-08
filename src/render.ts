/**
 * LombokTemplate - renderer (SPEC sections 6 to 8).
 */
import { TemplateError } from './errors.js'
import type { Expr, Node, Pos } from './parser.js'

/** Marks a string as already safe HTML: it is not escaped on output. */
export class SafeString {
  readonly value: string
  constructor(value: string) {
    this.value = value
  }
  toString(): string {
    return this.value
  }
}

export interface HelperOptions {
  /** Named arguments (`key=value`). */
  hash: Record<string, unknown>
  /** The innermost context value (`this`). */
  context: unknown
  /** The root data object. */
  root: unknown
  /** HTML-escape a value the same way `{{ }}` does. */
  escape(value: unknown): string
}

/** A helper or filter. Filters receive the piped value as the first argument. */
export type Helper = (args: unknown[], options: HelperOptions) => unknown

export interface RenderLimits {
  maxPartialDepth: number
  maxOutputLength: number
}

export interface RenderEnv {
  helpers: ReadonlyMap<string, Helper>
  /** Parsed partial `name` with every source line prefixed by `indent`, or undefined. */
  partial(name: string, indent: string): Node[] | undefined
  strict: boolean
  limits: RenderLimits
}

interface Frame {
  value: unknown
  vars: Record<string, unknown> | null
}

// ─── Values ──────────────────────────────────────────────────────────────────

const ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;',
}

/** HTML escaping used by `{{ }}` (SPEC 7.2). */
export function escapeHTML(s: string): string {
  return s.replace(/[&<>"'`=]/g, c => ESCAPES[c]!)
}

/** Text form of a value (SPEC 7.1). */
export function stringify(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') {
    if (Object.is(v, -0)) return '0'
    return String(v)
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (v instanceof SafeString) return v.value
  if (Array.isArray(v)) return v.map(stringify).join(',')
  return ''
}

/** SPEC 6.3: false, null, missing, 0, NaN, '' and [] are falsy. */
export function isTruthy(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v)
  return v !== undefined && v !== null && v !== false && v !== ''
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v) || v instanceof SafeString) return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

/** SPEC 6.2: only own data properties of plain objects, array items and `length`. */
function getProp(obj: unknown, key: string): unknown {
  if (Array.isArray(obj)) {
    if (key === 'length') return obj.length
    if (/^(0|[1-9][0-9]*)$/.test(key)) return obj[Number(key)]
    return undefined
  }
  if (typeof obj === 'string') return key === 'length' ? [...obj].length : undefined
  if (isPlainObject(obj) && Object.prototype.hasOwnProperty.call(obj, key)) {
    const d = Object.getOwnPropertyDescriptor(obj, key)
    return d && 'value' in d ? d.value : undefined
  }
  return undefined
}

function hasProp(obj: unknown, key: string): boolean {
  if (Array.isArray(obj)) return key === 'length' || (/^(0|[1-9][0-9]*)$/.test(key) && Number(key) < obj.length)
  if (typeof obj === 'string') return key === 'length'
  return isPlainObject(obj) && Object.prototype.hasOwnProperty.call(obj, key)
}

// ─── Renderer ────────────────────────────────────────────────────────────────

export class Renderer {
  private readonly env: RenderEnv
  private readonly stack: Frame[]
  private out = ''
  private partialDepth = 0

  constructor(env: RenderEnv, data: unknown) {
    this.env = env
    this.stack = [{ value: data, vars: { root: data } }]
  }

  run(nodes: Node[]): string {
    this.nodes(nodes)
    return this.out
  }

  private emit(s: string): void {
    this.out += s
    if (this.out.length > this.env.limits.maxOutputLength) {
      throw new TemplateError('LIMIT_EXCEEDED', `output longer than ${this.env.limits.maxOutputLength} characters`)
    }
  }

  private nodes(list: Node[]): void {
    for (const n of list) this.node(n)
  }

  private push(value: unknown, vars: Record<string, unknown> | null, body: Node[]): void {
    this.stack.push({ value, vars })
    try { this.nodes(body) } finally { this.stack.pop() }
  }

  private node(n: Node): void {
    switch (n.type) {
      case 'text':
        this.emit(n.value)
        return
      case 'out': {
        const v = this.eval(n.expr, n.pos)
        if (v === undefined && this.env.strict) {
          throw new TemplateError('MISSING_VALUE', `'${describe(n.expr)}' is not defined`, n.pos.line, n.pos.column)
        }
        this.emit(n.escape && !(v instanceof SafeString) ? escapeHTML(stringify(v)) : stringify(v))
        return
      }
      case 'if': {
        for (const b of n.branches) {
          if (isTruthy(this.eval(b.cond, b.pos)) !== n.negate) { this.nodes(b.body); return }
        }
        this.nodes(n.otherwise)
        return
      }
      case 'with': {
        const v = this.eval(n.expr, n.pos)
        if (isTruthy(v)) this.push(v, null, n.body)
        else this.nodes(n.otherwise)
        return
      }
      case 'each': {
        const v = this.eval(n.expr, n.pos)
        if (Array.isArray(v) && v.length > 0) {
          v.forEach((item, index) =>
            this.push(item, { index, first: index === 0, last: index === v.length - 1 }, n.body))
        } else if (isPlainObject(v) && Object.keys(v).length > 0) {
          const keys = Object.keys(v)
          keys.forEach((key, index) =>
            this.push(v[key], { key, index, first: index === 0, last: index === keys.length - 1 }, n.body))
        } else {
          this.nodes(n.otherwise)
        }
        return
      }
      case 'section': {
        const v = this.eval(n.expr, n.pos)
        if (n.inverted) {
          if (!isTruthy(v)) this.nodes(n.body)
          return
        }
        if (Array.isArray(v)) {
          v.forEach((item, index) =>
            this.push(item, { index, first: index === 0, last: index === v.length - 1 }, n.body))
        } else if (isTruthy(v)) {
          this.push(v, null, n.body)
        }
        return
      }
      case 'partial': {
        const tree = this.env.partial(n.name, n.indent)
        if (!tree) {
          if (this.env.strict) throw new TemplateError('MISSING_PARTIAL', `partial '${n.name}' is not registered`, n.pos.line, n.pos.column)
          return
        }
        if (this.partialDepth >= this.env.limits.maxPartialDepth) {
          throw new TemplateError('LIMIT_EXCEEDED', `partials nested deeper than ${this.env.limits.maxPartialDepth}`, n.pos.line, n.pos.column)
        }
        const sub = new Renderer(this.env, undefined)
        sub.stack.length = 0
        sub.stack.push(...this.stack)
        sub.partialDepth = this.partialDepth + 1
        if (n.context) sub.stack.push({ value: this.eval(n.context, n.pos), vars: null })
        this.emit(sub.run(tree))
        return
      }
    }
  }

  // ─── Expressions ──────────────────────────────────────────────────────────

  eval(e: Expr, pos: Pos): unknown {
    switch (e.type) {
      case 'lit':
        return e.value
      case 'path':
        return this.lookup(e)
      case 'call':
        return this.call(e.name, e.args.map(a => this.eval(a, pos)), e.hash, pos)
      case 'pipe': {
        let v = this.eval(e.base, pos)
        for (const f of e.filters) v = this.call(f.name, [v, ...f.args.map(a => this.eval(a, pos))], [], pos)
        return v
      }
    }
  }

  private lookup(p: Extract<Expr, { type: 'path' }>): unknown {
    const top = this.stack.length - 1
    if (p.up > top) return undefined
    let value: unknown

    if (p.data) {
      const name = p.parts[0]!
      let found = false
      for (let i = top - p.up; i >= 0; i--) {
        const vars = this.stack[i]!.vars
        if (vars && Object.prototype.hasOwnProperty.call(vars, name)) { value = vars[name]; found = true; break }
      }
      if (!found) return undefined
      return this.walk(value, p.parts, 1)
    }

    if (p.self) return this.walk(this.stack[top - p.up]!.value, p.parts, 0)

    const head = p.parts[0]!
    if (p.up > 0) return this.walk(this.stack[top - p.up]!.value, p.parts, 0)
    for (let i = top; i >= 0; i--) {
      const v = this.stack[i]!.value
      if (hasProp(v, head)) return this.walk(v, p.parts, 0)
    }
    return undefined
  }

  private walk(value: unknown, parts: string[], from: number): unknown {
    let v = value
    for (let i = from; i < parts.length; i++) {
      if (v === undefined || v === null) return undefined
      v = getProp(v, parts[i]!)
    }
    return v
  }

  private call(name: string, args: unknown[], hashExprs: [string, Expr][], pos: Pos): unknown {
    const fn = this.env.helpers.get(name)
    if (!fn) throw new TemplateError('UNKNOWN_HELPER', `helper '${name}' is not registered`, pos.line, pos.column)
    const hash: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    for (const [k, e] of hashExprs) hash[k] = this.eval(e, pos)
    try {
      return fn(args, {
        hash,
        context: this.stack[this.stack.length - 1]!.value,
        root: this.stack[0]!.value,
        escape: (v: unknown) => escapeHTML(stringify(v)),
      })
    } catch (err) {
      if (err instanceof TemplateError) throw err
      const msg = err instanceof Error ? err.message : String(err)
      throw new TemplateError('HELPER_ERROR', `helper '${name}' failed: ${msg}`, pos.line, pos.column)
    }
  }
}

/** Prefix `indent` to every line of `text` that has content (SPEC 3.1). */
export function indentLines(text: string, indent: string): string {
  return indent === '' ? text : text.replace(/(^|\n)(?=[^\n])/g, `$1${indent}`)
}

function describe(e: Expr): string {
  if (e.type === 'path') return e.source
  if (e.type === 'call') return e.name
  if (e.type === 'pipe') return describe(e.base)
  return String(e.value)
}
