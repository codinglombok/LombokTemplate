# LombokTemplate — API v0.1.0

## 1. Ekspor

| Nama | Jenis | Keterangan |
|---|---|---|
| `render(source, data?, options?)` | fungsi | parse dan render sekali jalan dengan helper bawaan; `options.partials` berupa `{ nama: sumber }` |
| `Environment` | kelas | helper, partial, dan opsi bersama |
| `CompiledTemplate` | kelas | hasil `Environment.compile`; `render(data?)` |
| `TemplateError` | kelas | galat dengan `code`, `line`, `column` (SPEC §10) |
| `SafeString` | kelas | penanda teks yang tidak di-escape |
| `escapeHTML`, `stringify`, `isTruthy`, `toJSON` | fungsi | aturan SPEC §7, §6.3, §8 |
| `BUILTIN_HELPERS` | `ReadonlyMap` | tabel helper bawaan |
| `Helper`, `HelperOptions`, `TemplateOptions`, `TemplateErrorCode` | tipe | |

## 2. `Environment`

```ts
new Environment(options?: TemplateOptions)
env.registerHelper(name: string, fn: Helper): this
env.unregisterHelper(name: string): this
env.hasHelper(name: string): boolean
env.registerPartial(name: string, source: string): this   // galat sintaks dilaporkan di sini
env.unregisterPartial(name: string): this
env.compile(source: string): CompiledTemplate
env.render(source: string, data?: unknown): string
```

## 3. Opsi

| Opsi | Bawaan | Efek |
|---|---|---|
| `strict` | `false` | nilai keluaran hilang dan partial tak terdaftar menjadi galat |
| `builtins` | `true` | daftarkan helper bawaan |
| `maxDepth` | 64 | kedalaman blok |
| `maxPartialDepth` | 32 | kedalaman partial |
| `maxTemplateLength` | 4 194 304 | panjang sumber templat (unit kode UTF-16) |
| `maxOutputLength` | 67 108 864 | panjang keluaran |

## 4. Helper

```ts
type Helper = (args: unknown[], options: HelperOptions) => unknown
interface HelperOptions {
  hash: Record<string, unknown>   // argumen bernama
  context: unknown                // nilai frame teratas
  root: unknown                   // data akar
  escape(value: unknown): string  // escaping yang sama dengan {{ }}
}
```

Kembalikan `new SafeString(html)` untuk HTML yang sudah aman. Galat yang dilempar helper dibungkus menjadi `HELPER_ERROR` dengan nama helper dan posisi tag.

## 5. Contoh

```ts
const env = new Environment({ strict: true })
env.registerHelper('currency', ([v], { hash }) => formatCurrency(v, hash['code']))
const t = env.compile('{{#each items}}{{ name }}: {{ price | currency }}\n{{/each}}')
t.render({ items })
```
