/**
 * LombokTemplate - errors with stable, language-neutral codes (SPEC section 9).
 */

export type TemplateErrorCode =
  | 'SYNTAX'
  | 'UNKNOWN_HELPER'
  | 'UNSUPPORTED'
  | 'LIMIT_EXCEEDED'
  | 'MISSING_VALUE'
  | 'MISSING_PARTIAL'
  | 'HELPER_ERROR'

export class TemplateError extends Error {
  readonly code: TemplateErrorCode
  /** 1-based line of the tag that caused the error (0 when not tied to a position). */
  readonly line: number
  /** 1-based column (in UTF-16 code units) of the tag that caused the error. */
  readonly column: number

  constructor(code: TemplateErrorCode, message: string, line = 0, column = 0) {
    super(line > 0 ? `${code}: ${message} (line ${line}, column ${column})` : `${code}: ${message}`)
    this.name = 'TemplateError'
    this.code = code
    this.line = line
    this.column = column
  }
}
