/**
 * LombokTemplate - tag scanner (SPEC sections 2 and 3).
 *
 * Splits a template into text and tags, applies the standalone-line rule
 * (Mustache) and whitespace control (`~`).
 */
import { TemplateError } from './errors.js'

export type TagKind =
  | 'var'      // {{ expr }}           escaped output
  | 'raw'      // {{{ expr }}} {{& expr}} unescaped output
  | 'comment'  // {{! ... }} {{!-- ... --}}
  | 'open'     // {{# ... }}
  | 'inverted' // {{^ name }}
  | 'close'    // {{/ name }}
  | 'else'     // {{else}} {{else if expr}} {{^}}
  | 'partial'  // {{> name [expr]}}

export interface TextToken {
  type: 'text'
  value: string
}

export interface TagToken {
  type: 'tag'
  kind: TagKind
  /** Tag content without delimiters, sigil and `~` markers, trimmed. */
  content: string
  line: number
  column: number
  /** `{{~`: remove whitespace before the tag. */
  trimBefore: boolean
  /** `~}}`: remove whitespace after the tag. */
  trimAfter: boolean
  /** Whitespace removed in front of a standalone partial; prefixed to every line of its output. */
  indent: string
}

export type Token = TextToken | TagToken

const STANDALONE_KINDS = new Set<TagKind>(['comment', 'open', 'inverted', 'close', 'else', 'partial'])

/** Line/column of increasing offsets in one pass (keeps scanning linear). */
function positions(src: string): (offset: number) => [number, number] {
  let at = 0
  let line = 1
  let lineStart = 0
  return offset => {
    for (; at < offset; at++) {
      if (src.charCodeAt(at) === 10) { line++; lineStart = at + 1 }
    }
    return [line, offset - lineStart + 1]
  }
}

/** Scan `src` into tokens (SPEC section 2). */
export function scan(src: string): Token[] {
  const tokens: Token[] = []
  const position = positions(src)
  let pos = 0
  while (pos < src.length) {
    const start = src.indexOf('{{', pos)
    if (start < 0) {
      tokens.push({ type: 'text', value: src.slice(pos) })
      break
    }
    if (start > pos) tokens.push({ type: 'text', value: src.slice(pos, start) })

    const [line, column] = position(start)
    const fail = (msg: string): never => { throw new TemplateError('SYNTAX', msg, line, column) }

    let i = start + 2
    const triple = src[i] === '{'
    if (triple) i++
    let trimBefore = false
    if (src[i] === '~') { trimBefore = true; i++ }

    let kind: TagKind
    let content: string
    let trimAfter = false
    let end: number

    if (!triple && src.startsWith('!--', i)) {
      const m = /--~?\}\}/.exec(src.slice(i + 3))
      if (!m) fail('unclosed comment')
      const j = i + 3 + m!.index
      trimAfter = src[j + 2] === '~'
      end = j + (trimAfter ? 5 : 4)
      kind = 'comment'
      content = src.slice(i + 3, j)
    } else {
      const closer = triple ? '}}}' : '}}'
      const close = src.indexOf(closer, i)
      if (close < 0) fail(triple ? 'unclosed {{{ tag' : 'unclosed {{ tag')
      let bodyEnd = close
      if (src[close - 1] === '~' && close - 1 >= i) { trimAfter = true; bodyEnd = close - 1 }
      end = close + closer.length
      let body = src.slice(i, bodyEnd)
      if (triple) {
        kind = 'raw'
      } else {
        const sigil = body.trimStart()[0]
        switch (sigil) {
          case '!': kind = 'comment'; body = body.trimStart().slice(1); break
          case '#': kind = 'open'; body = body.trimStart().slice(1); break
          case '^': kind = 'inverted'; body = body.trimStart().slice(1); break
          case '/': kind = 'close'; body = body.trimStart().slice(1); break
          case '>': kind = 'partial'; body = body.trimStart().slice(1); break
          case '&': kind = 'raw'; body = body.trimStart().slice(1); break
          case '=': fail('changing delimiters is not supported'); kind = 'var'; break
          default: kind = 'var'
        }
      }
      content = body.trim()
      if (kind === 'var' && (content === 'else' || content.startsWith('else '))) kind = 'else'
      if (kind === 'inverted' && content === '') kind = 'else'
      if (kind !== 'comment' && kind !== 'else' && content === '') fail('empty tag')
    }
    tokens.push({ type: 'tag', kind, content, line, column, trimBefore, trimAfter, indent: '' })
    pos = end
  }
  applyStandalone(tokens)
  applyTrim(tokens)
  return tokens.filter(t => t.type === 'tag' || t.value !== '')
}

const isBlank = (s: string): boolean => /^[ \t]*$/.test(s)

/** SPEC 3.1: a standalone tag removes its whole line. */
function applyStandalone(tokens: Token[]): void {
  const cutTail = new Map<number, number>() // text index -> new length
  const cutHead = new Map<number, number>() // text index -> chars removed from start
  for (let i = 0; i < tokens.length; i++) {
    const tag = tokens[i]!
    if (tag.type !== 'tag' || !STANDALONE_KINDS.has(tag.kind)) continue

    const prev = tokens[i - 1]
    let lineStartOk: boolean
    let indent = ''
    if (!prev) lineStartOk = true
    else if (prev.type === 'tag') lineStartOk = false
    else {
      const nl = prev.value.lastIndexOf('\n')
      indent = prev.value.slice(nl + 1)
      lineStartOk = isBlank(indent) && (nl >= 0 || i - 1 === 0)
    }
    if (!lineStartOk) continue

    const next = tokens[i + 1]
    let headCut: number
    if (!next) headCut = 0
    else if (next.type === 'tag') continue
    else {
      const m = /^[ \t]*(\r?\n)/.exec(next.value)
      if (m) headCut = m[0].length
      else if (i + 1 === tokens.length - 1 && isBlank(next.value)) headCut = next.value.length
      else continue
    }

    if (prev && prev.type === 'text') cutTail.set(i - 1, prev.value.length - indent.length)
    if (next && next.type === 'text') cutHead.set(i + 1, headCut)
    tag.indent = indent
  }
  for (const [idx, n] of cutHead) {
    const t = tokens[idx] as TextToken
    t.value = t.value.slice(n)
  }
  for (const [idx, len] of cutTail) {
    const t = tokens[idx] as TextToken
    const removed = (cutHead.get(idx) ?? 0)
    t.value = t.value.slice(0, Math.max(0, len - removed))
  }
}

/** SPEC 3.2: `~` removes all whitespace (including newlines) next to the tag. */
function applyTrim(tokens: Token[]): void {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t.type !== 'tag') continue
    const prev = tokens[i - 1]
    const next = tokens[i + 1]
    if (t.trimBefore && prev?.type === 'text') prev.value = prev.value.replace(/[ \t\r\n\f\v]+$/, '')
    if (t.trimAfter && next?.type === 'text') next.value = next.value.replace(/^[ \t\r\n\f\v]+/, '')
  }
}
