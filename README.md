# LombokTemplate

> Logic-less templates that combine Mustache sections, Handlebars-style blocks and helpers, and Liquid-style filters. HTML escaping by default, no code evaluation, bounded nesting and output. Zero dependencies.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Mustache spec](https://img.shields.io/badge/Mustache%20spec-122%2F122-success)](tests/mustache-spec.test.ts)
[![Vectors](https://img.shields.io/badge/vectors-168-success)](vectors/lomboktemplate-vectors-v1.json)

Part of the [Lombok Ecosystem](https://github.com/codinglombok).

## Mengapa library ini? (Why this library?)

- **One template, familiar syntax.** `{{#if}}`/`{{else if}}`/`{{#each}}` with `@index`, `@key`, `../`, subexpressions `(gt total 0)`, Mustache sections `{{#items}}`, and filters `{{ total | currency }}`, `{{ color | default:'#1a73e8' }}` in the same template. Passes all 122 Mustache spec cases for interpolation, sections, inverted sections, comments, and partials.
- **Safe by default.** Output is HTML-escaped (`& < > " ' \` =`); templates cannot run code; only own data properties of plain objects are reachable, so `__proto__`, getters, and class internals are out of reach. `safeUrl` empties `javascript:` and similar links.
- **Same output in every language.** Behaviour is fixed by a normative [SPEC](docs/SPEC_LombokTemplate_v0.1.0.md) and 168 shared vectors; built-in helpers are deterministic and locale-independent.
- **Bounded.** Limits for block depth, partial depth, template size, and output size; scanning and rendering are linear (checked by adversarial tests).

Typical uses: invoices, letters and reports rendered to HTML or PDF, transactional e-mail, static pages, configuration files, and code generation.

## Installation

```bash
npm install lomboktemplate
```

Not yet published to npm. Python, Go, PHP, and Rust ports are planned and will run the same vectors.

## Quick start

```ts
import { Environment, render } from 'lomboktemplate'

render('Hello {{ name | upper }}!', { name: 'lombok' })
// 'Hello LOMBOK!'

const env = new Environment()
  .registerHelper('money', ([value], { hash }) => `${hash['cur'] ?? 'USD'} ${Number(value).toFixed(2)}`)
  .registerPartial('row', '<tr><td>{{ @index | add:1 }}</td><td>{{ name }}</td><td>{{ price | money }}</td></tr>')

const invoice = env.compile(`
<table>
  {{#each items}}
  {{> row}}
  {{else}}
  <tr><td colspan="3">No items</td></tr>
  {{/each}}
</table>
{{#if (gt discount 0)}}<p>Discount: {{ discount | money }}</p>{{/if}}
`)

invoice.render({ items: [{ name: 'Coffee <beans>', price: 3.5 }], discount: 0 })
```

## Syntax at a glance

| Syntax | Meaning |
|---|---|
| `{{ path }}` | escaped output; `{{{ path }}}` or `{{& path}}` unescaped |
| `{{ a.b.c }}`, `{{ xs.0 }}`, `{{ xs.length }}`, `{{ this }}`, `{{ ../x }}`, `{{ @index }}` | paths and block variables |
| `{{ helper arg key=value }}`, `(helper arg)` | helper call and subexpression |
| `{{ value \| filter:arg1,arg2 \| other }}` | filters (any helper, value first) |
| `{{#if e}} {{else if e}} {{else}} {{/if}}`, `{{#unless e}}` | conditionals |
| `{{#each e}} ... {{else}} ... {{/each}}`, `{{#with e}}` | loops and context |
| `{{#name}} {{/name}}`, `{{^name}} {{/name}}` | Mustache sections |
| `{{> partial}}`, `{{> partial ctx}}` | partials |
| `{{! note }}`, `{{!-- note --}}`, `{{~ x ~}}` | comments and whitespace control |

Built-in helpers: `eq ne gt gte lt lte and or not add sub mul div default upper lower trim truncate length join nl2br raw safeUrl json`.

## Documentation

- [SPEC](docs/SPEC_LombokTemplate_v0.1.0.md) (normative), [API](docs/API_LombokTemplate_v0.1.0.md), [Guide](docs/guide_how_to_use_LombokTemplate_v0.1.0.md)
- [Map](docs/map_LombokTemplate_v0.1.0.md), [Structure](docs/structure_repo_LombokTemplate_v0.1.0.md), [Summary](docs/full_summary_project_LombokTemplate_v0.1.0.md)
- [Development](docs/development_ide_LombokTemplate_v0.1.0.md), [Distribution](docs/how_to_dist_LombokTemplate_v0.1.0.md), [Languages](docs/Lang_LombokTemplate_v0.1.0.md), [Changelog](docs/changelog_LombokTemplate_v0.1.0.md)

## License

Apache-2.0. The Mustache spec fixtures in `tests/fixtures/` are MIT-licensed (Copyright (c) 2010-2022 Mustache Contributors).
