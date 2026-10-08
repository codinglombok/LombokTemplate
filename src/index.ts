/**
 * LombokTemplate: logic-less templates with Mustache sections, Handlebars-style
 * blocks and helpers, and Liquid-style filters. HTML escaping by default, no
 * code evaluation, bounded nesting and output. Zero dependencies.
 *
 * Behaviour is specified in docs/SPEC_LombokTemplate_v0.1.0.md.
 */
import { TemplateError } from './errors.js'
import { parse, type Node } from './parser.js'
import { BUILTIN_HELPERS } from './helpers.js'
import { Renderer, indentLines, type Helper } from './render.js'

export { TemplateError } from './errors.js'
export type { TemplateErrorCode } from './errors.js'
export { SafeString, escapeHTML, isTruthy, stringify } from './render.js'
export type { Helper, HelperOptions } from './render.js'
export { BUILTIN_HELPERS, toJSON } from './helpers.js'

export interface TemplateOptions {
  /** Throw MISSING_VALUE for undefined output values and MISSING_PARTIAL for unknown partials (default false). */
  strict?: boolean
  /** Register the built-in helpers (default true). */
  builtins?: boolean
  /** Maximum block nesting (default 64). */
  maxDepth?: number
  /** Maximum partial nesting at render time (default 32). */
  maxPartialDepth?: number
  /** Maximum template source length in UTF-16 code units (default 4 194 304). */
  maxTemplateLength?: number
  /** Maximum output length in UTF-16 code units (default 67 108 864). */
  maxOutputLength?: number
}

const NAME = /^[A-Za-z_$][A-Za-z0-9_$\-]*$/
const PARTIAL_NAME = /^[A-Za-z0-9_$\-./]+$/

export class CompiledTemplate {
  private readonly env: Environment
  private readonly tree: Node[]

  /** @internal */
  constructor(env: Environment, tree: Node[]) {
    this.env = env
    this.tree = tree
  }

  /** Render with `data` as the root context. */
  render(data?: unknown): string {
    return this.env._render(this.tree, data)
  }
}

/** Helpers, partials and options shared by the templates compiled from it. */
export class Environment {
  private readonly helpers = new Map<string, Helper>()
  private readonly partialSources = new Map<string, string>()
  private readonly partialCache = new Map<string, Node[]>()
  private readonly opts: Required<TemplateOptions>

  constructor(options: TemplateOptions = {}) {
    this.opts = {
      strict: options.strict ?? false,
      builtins: options.builtins ?? true,
      maxDepth: options.maxDepth ?? 64,
      maxPartialDepth: options.maxPartialDepth ?? 32,
      maxTemplateLength: options.maxTemplateLength ?? 4 * 1024 * 1024,
      maxOutputLength: options.maxOutputLength ?? 64 * 1024 * 1024,
    }
    if (this.opts.builtins) for (const [k, v] of BUILTIN_HELPERS) this.helpers.set(k, v)
  }

  /** Register (or replace) a helper; it can be called as `{{name a b}}`, `(name a b)` or `{{ a | name:b }}`. */
  registerHelper(name: string, fn: Helper): this {
    if (!NAME.test(name)) throw new TemplateError('SYNTAX', `invalid helper name '${name}'`)
    this.helpers.set(name, fn)
    return this
  }

  unregisterHelper(name: string): this {
    this.helpers.delete(name)
    return this
  }

  hasHelper(name: string): boolean {
    return this.helpers.has(name)
  }

  /** Register (or replace) a partial used with `{{> name}}`. Syntax errors are reported here. */
  registerPartial(name: string, source: string): this {
    if (!PARTIAL_NAME.test(name)) throw new TemplateError('SYNTAX', `invalid partial name '${name}'`)
    this.parseSource(source)
    this.partialSources.set(name, source)
    for (const key of [...this.partialCache.keys()]) if (key.startsWith(name + '\u0000')) this.partialCache.delete(key)
    return this
  }

  unregisterPartial(name: string): this {
    this.partialSources.delete(name)
    for (const key of [...this.partialCache.keys()]) if (key.startsWith(name + '\u0000')) this.partialCache.delete(key)
    return this
  }

  /** Parse `source` once; render it many times. */
  compile(source: string): CompiledTemplate {
    return new CompiledTemplate(this, this.parseSource(source))
  }

  /** Compile and render in one step. */
  render(source: string, data?: unknown): string {
    return this.compile(source).render(data)
  }

  private parseSource(source: string): Node[] {
    if (source.length > this.opts.maxTemplateLength) {
      throw new TemplateError('LIMIT_EXCEEDED', `template longer than ${this.opts.maxTemplateLength} characters`)
    }
    return parse(source, { maxDepth: this.opts.maxDepth })
  }

  /** @internal */
  _render(tree: Node[], data: unknown): string {
    const renderer = new Renderer({
      helpers: this.helpers,
      partial: (name, indent) => {
        const src = this.partialSources.get(name)
        if (src === undefined) return undefined
        const key = name + '\u0000' + indent
        let t = this.partialCache.get(key)
        if (!t) {
          t = this.parseSource(indentLines(src, indent))
          this.partialCache.set(key, t)
        }
        return t
      },
      strict: this.opts.strict,
      limits: { maxPartialDepth: this.opts.maxPartialDepth, maxOutputLength: this.opts.maxOutputLength },
    }, data)
    return renderer.run(tree)
  }
}

/** Render `source` with `data` using a fresh environment (built-in helpers only). */
export function render(source: string, data?: unknown, options: TemplateOptions & { partials?: Record<string, string> } = {}): string {
  const env = new Environment(options)
  for (const [name, src] of Object.entries(options.partials ?? {})) env.registerPartial(name, src)
  return env.render(source, data)
}
