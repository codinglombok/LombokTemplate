# LombokTemplate — Map v0.1.0

## 1. Posisi di ekosistem

```
Cluster 03 Format, Parser & Serialisasi · tingkat L0 (tanpa dependensi Lombok wajib)

L0  LombokTemplate
     dependensi wajib    : (tidak ada)
     dependensi opsional : LombokLocale (helper format yang didaftarkan aplikasi; bukan impor)
     dependensi dev      : typescript, vitest, tsup
```

Nomor katalog dan posisi cluster mengikuti dokumen induk ekosistem v3.6 (tidak di-commit, ADR-024).

## 2. Contoh pemakai di ekosistem

Bagian ini satu-satunya tempat nama aplikasi atau framework boleh muncul (ADR-019). Ini ilustrasi, bukan kepemilikan; siapa pun dapat memakai LombokTemplate.

| Pemakai | Jenis | Status | Pemakaian |
|---|---|---|---|
| LombokPDF | Produk L3 | rencana (F2) | 12 templat dokumen (faktur, laporan, surat) dengan front matter |
| LombokClarion | Framework | rencana | view server |
| LombokDocFlow | Framework | rencana | ekspor dokumen dari templat |

## 3. Fitur x port

| Fitur | TypeScript | Rust | Python | Go | PHP |
|---|---|---|---|---|---|
| pemindaian, standalone, `~` (SPEC §2-3) | YA | rencana | rencana | rencana | rencana |
| ekspresi, filter, subexpression (§4) | YA | rencana | rencana | rencana | rencana |
| blok dan seksi (§5-6) | YA | rencana | rencana | rencana | rencana |
| helper bawaan (§8) | YA | rencana | rencana | rencana | rencana |
| Mustache spec 122 kasus | 122/122 | - | - | - | - |
| vector | 168/168 | - | - | - | - |

## 4. Jalur kontrak normatif

`docs/SPEC_LombokTemplate_v0.1.0.md` -> `vectors/lomboktemplate-vectors-v1.json` (sha256 di SPEC) -> runner `tests/vectors.test.ts`.
