# LombokTemplate — Structure Repo v0.1.0

```
LombokTemplate/
├── src/
│   ├── index.ts        API publik: render, Environment, CompiledTemplate
│   ├── lexer.ts        pemindaian tag, baris standalone, kontrol spasi (SPEC §2-3)
│   ├── parser.ts       ekspresi dan pohon blok (SPEC §4-5)
│   ├── render.ts       evaluasi, pencarian path, escaping (SPEC §6-7)
│   ├── helpers.ts      helper bawaan (SPEC §8)
│   └── errors.ts       TemplateError dan kode galat (SPEC §10)
├── tests/
│   ├── vectors.test.ts        runner vector bersama
│   ├── mustache-spec.test.ts  122 kasus Mustache spec
│   ├── api.test.ts            API dan kasus tepi
│   ├── robustness.test.ts     masukan acak dan patologis
│   └── fixtures/              berkas Mustache spec (MIT)
├── vectors/
│   ├── build_vectors.py       sumber kasus (nilai harapan ditulis tangan dari SPEC)
│   ├── lomboktemplate-vectors-v1.json
│   └── SHA256SUMS
├── docs/                      10 dokumen publik
├── scripts/lombok-doctor.sh   pemeriksaan standar ekosistem
├── ports/                     port bahasa lain (rencana)
├── .github/workflows/ci.yml
├── CLAUDE.md, README.md, CHANGELOG.md, LICENSE
└── package.json, tsconfig.json, vitest.config.ts
```
