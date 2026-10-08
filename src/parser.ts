/**
 * LombokTemplate - expression and block parser (SPEC sections 4 and 5).
 */
import { TemplateError } from './errors.js'
import { scan, type TagToken } from './lexer.js'

// ─── Expressions ─────────────────────────────────────────────────────────────

export type Expr =
  | { type: 'lit'; value: string | number | boolean | null }
  | { type: 'path'; up: number; data: boolean; self: boolean; parts: string[]; source: string }
  | { type: 'call'; name: string; args: Expr[]; hash: [string, Expr][] }
  | { type: 'pipe'; base: Expr; filters: { name: string; args: Expr[] }[] }

type Tok =
  | { t: 'str'; v: string }
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: '(' | ')' | '|' | ':' | ',' | '=' }

const PATH_CHAR = /[A-Za-z0-9_$@.\-/\[\]]/

function lexExpr(src: string, fail: (m: string) => never): Tok[] {
  const out: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue }
    if ('()|:,='.includes(c)) { out.push({ t: c as '(' }); i++; continue }
    if (c === '"' || c === "'") {
      let v = ''
      let j = i + 1
      for (; j < src.length && src[j] !== c; j++) {
        if (src[j] === '\\' && j + 1 < src.length) { j++; v += src[j] === 'n' ? '\n' : src[j] === 't' ? '\t' : src[j] }
        else v += src[j]
      }
      if (j >= src.length) fail('unterminated string literal')
      out.push({ t: 'str', v })
      i = j + 1
      continue
    }
    const num = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?(?![A-Za-z0-9_$@.\-/])/.exec(src.slice(i))
    if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue }
    if (PATH_CHAR.test(c)) {
      let j = i
      while (j < src.length && PATH_CHAR.test(src[j]!)) j++
      out.push({ t: 'id', v: src.slice(i, j) })
      i = j
      continue
    }
    fail(`unexpected character '${c}' in expression`)
  }
  return out
}

const FORBIDDEN_PARTS = new Set(['__proto__', 'constructor', 'prototype'])
const HELPER_NAME = /^[A-Za-z_$][A-Za-z0-9_$\-]*$/

function parsePath(src: string, fail: (m: string) => never): Expr {
  let rest = src
  let data = false
  if (rest.startsWith('@')) { data = true; rest = rest.slice(1) }
  let up = 0
  while (rest.startsWith('../')) { up++; rest = rest.slice(3) }
  if (rest === '..') { up++; rest = '.' }
  if (rest.startsWith('@')) {
    if (data) fail(`invalid path '${src}'`)
    data = true
    rest = rest.slice(1)
  }
  let self = false
  let parts: string[]
  if (rest === '.' || rest === 'this') { self = true; parts = [] }
  else {
    if (rest.startsWith('this.') || rest.startsWith('this/')) { self = true; rest = rest.slice(5) }
    else if (rest.startsWith('./')) { self = true; rest = rest.slice(2) }
    parts = rest.split(/[./]/).map(p => (p.startsWith('[') && p.endsWith(']') ? p.slice(1, -1) : p))
    if (parts.some(p => p === '' || p.includes('[') || p.includes(']'))) fail(`invalid path '${src}'`)
  }
  if (data && (self || parts.length === 0)) fail(`invalid data variable '${src}'`)
  for (const p of parts) if (FORBIDDEN_PARTS.has(p)) fail(`path segment '${p}' is not allowed`)
  return { type: 'path', up, data, self, parts, source: src }
}

/** Parse the expression inside a tag (SPEC section 4). */
export function parseExpr(src: string, fail: (m: string) => never): Expr {
  const toks = lexExpr(src, fail)
  let i = 0
  const peek = () => toks[i]
  const take = () => toks[i++]

  const primary = (): Expr => {
    const t = take()
    if (!t) return fail('expression expected')
    if (t.t === 'str' || t.t === 'num') return { type: 'lit', value: t.v }
    if (t.t === '(') {
      const name = take()
      if (!name || name.t !== 'id' || !HELPER_NAME.test(name.v)) return fail('helper name expected after (')
      const call = callTail(name.v)
      if (take()?.t !== ')') fail('missing )')
      return call
    }
    if (t.t === 'id') {
      if (t.v === 'true') return { type: 'lit', value: true }
      if (t.v === 'false') return { type: 'lit', value: false }
      if (t.v === 'null' || t.v === 'undefined') return { type: 'lit', value: null }
      return parsePath(t.v, fail)
    }
    return fail(`unexpected '${t.t}'`)
  }

  const callTail = (name: string): Expr => {
    const args: Expr[] = []
    const hash: [string, Expr][] = []
    for (;;) {
      const t = peek()
      if (!t || t.t === ')' || t.t === '|') break
      const n = toks[i + 1]
      if (t.t === 'id' && n?.t === '=') {
        i += 2
        hash.push([t.v, primary()])
      } else {
        if (hash.length > 0) fail('positional argument after hash argument')
        args.push(primary())
      }
    }
    return { type: 'call', name, args, hash }
  }

  // head: a single value, or a helper call when arguments follow the name
  let base: Expr
  const first = peek()
  const second = toks[i + 1]
  if (first?.t === 'id' && second && second.t !== '|' && HELPER_NAME.test(first.v)) {
    i++
    base = callTail(first.v)
  } else {
    base = primary()
  }

  const filters: { name: string; args: Expr[] }[] = []
  while (peek()?.t === '|') {
    i++
    const name = take()
    if (!name || name.t !== 'id' || !HELPER_NAME.test(name.v)) fail('filter name expected after |')
    const args: Expr[] = []
    if (peek()?.t === ':') {
      i++
      args.push(primary())
      while (peek()?.t === ',') { i++; args.push(primary()) }
    }
    filters.push({ name: (name as { v: string }).v, args })
  }
  if (i < toks.length) fail(`unexpected '${(toks[i] as { v?: unknown }).v ?? toks[i]!.t}' in expression`)
  return filters.length > 0 ? { type: 'pipe', base, filters } : base
}

// ─── Template tree ───────────────────────────────────────────────────────────

export interface Pos { line: number; column: number }

export type Node =
  | { type: 'text'; value: string }
  | { type: 'out'; expr: Expr; escape: boolean; pos: Pos }
  | { type: 'if'; negate: boolean; branches: { cond: Expr; body: Node[]; pos: Pos }[]; otherwise: Node[] }
  | { type: 'each'; expr: Expr; body: Node[]; otherwise: Node[]; pos: Pos }
  | { type: 'with'; expr: Expr; body: Node[]; otherwise: Node[]; pos: Pos }
  | { type: 'section'; inverted: boolean; expr: Expr; body: Node[]; pos: Pos }
  | { type: 'partial'; name: string; context: Expr | null; indent: string; pos: Pos }

export interface ParseLimits {
  maxDepth: number
}

interface Frame {
  open: TagToken
  closeName: string
  node: Node & { type: 'if' | 'each' | 'with' | 'section' }
  /** where new nodes go */
  target: Node[]
  sawElse: boolean
}

const BLOCK_KEYWORDS = new Set(['if', 'unless', 'each', 'with'])

/** Parse template source into a tree (SPEC section 5). */
export function parse(src: string, limits: ParseLimits): Node[] {
  const root: Node[] = []
  const stack: Frame[] = []
  const current = (): Node[] => (stack.length ? stack[stack.length - 1]!.target : root)

  for (const tok of scan(src)) {
    if (tok.type === 'text') { current().push({ type: 'text', value: tok.value }); continue }
    const pos = { line: tok.line, column: tok.column }
    const fail = (m: string): never => { throw new TemplateError('SYNTAX', m, tok.line, tok.column) }

    switch (tok.kind) {
      case 'comment':
        break
      case 'var':
      case 'raw':
        current().push({ type: 'out', expr: parseExpr(tok.content, fail), escape: tok.kind === 'var', pos })
        break
      case 'partial': {
        const m = /^("[^"]*"|'[^']*'|[A-Za-z0-9_$\-./]+)(?:\s+([\s\S]+))?$/.exec(tok.content)
        if (!m) fail('partial name expected')
        const raw = m![1]!
        const name = raw.startsWith('"') || raw.startsWith("'") ? raw.slice(1, -1) : raw
        const context = m![2] ? parseExpr(m![2], fail) : null
        current().push({ type: 'partial', name, context, indent: tok.indent, pos })
        break
      }
      case 'open':
      case 'inverted': {
        if (stack.length >= limits.maxDepth) {
          throw new TemplateError('LIMIT_EXCEEDED', `blocks nested deeper than ${limits.maxDepth}`, tok.line, tok.column)
        }
        const sp = tok.content.search(/\s/)
        const keyword = sp < 0 ? tok.content : tok.content.slice(0, sp)
        const rest = sp < 0 ? '' : tok.content.slice(sp + 1).trim()
        let node: Frame['node']
        let target: Node[]
        let closeName: string
        if (tok.kind === 'open' && BLOCK_KEYWORDS.has(keyword)) {
          if (rest === '') fail(`#${keyword} needs an expression`)
          if (/\bas\s*\|/.test(rest)) throw new TemplateError('UNSUPPORTED', 'block parameters (as |x|) are not supported', tok.line, tok.column)
          const expr = parseExpr(rest, fail)
          closeName = keyword
          if (keyword === 'if' || keyword === 'unless') {
            const body: Node[] = []
            node = { type: 'if', negate: keyword === 'unless', branches: [{ cond: expr, body, pos }], otherwise: [] }
            target = body
          } else {
            const body: Node[] = []
            node = { type: keyword as 'each' | 'with', expr, body, otherwise: [], pos }
            target = body
          }
        } else {
          const expr = parseExpr(tok.content, fail)
          const body: Node[] = []
          node = { type: 'section', inverted: tok.kind === 'inverted', expr, body, pos }
          target = body
          closeName = tok.content
        }
        current().push(node)
        stack.push({ open: tok, closeName, node, target, sawElse: false })
        break
      }
      case 'else': {
        const frame = stack[stack.length - 1]
        if (!frame) fail('{{else}} outside a block')
        const f = frame!
        const rest = tok.content === '^' || tok.content === '' ? '' : tok.content.slice(4).trim()
        if (f.sawElse) fail('{{else}} after {{else}} in the same block')
        if (rest === '') {
          if (f.node.type === 'section') fail('{{else}} is not allowed in a section; use {{^name}}')
          f.sawElse = true
          f.target = (f.node as { otherwise: Node[] }).otherwise
        } else {
          const m = /^if\s+([\s\S]+)$/.exec(rest)
          if (!m || f.node.type !== 'if' || f.node.negate) fail(`unsupported '{{else ${rest}}}'`)
          const body: Node[] = []
          ;(f.node as { branches: { cond: Expr; body: Node[]; pos: Pos }[] }).branches.push({ cond: parseExpr(m![1]!, fail), body, pos })
          f.target = body
        }
        break
      }
      case 'close': {
        const frame = stack.pop()
        if (!frame) fail(`unexpected {{/${tok.content}}}`)
        if (frame!.closeName !== tok.content) fail(`{{/${tok.content}}} does not close {{#${frame!.closeName}}}`)
        break
      }
    }
  }
  const open = stack.pop()
  if (open) throw new TemplateError('SYNTAX', `unclosed {{#${open.closeName}}}`, open.open.line, open.open.column)
  return root
}
