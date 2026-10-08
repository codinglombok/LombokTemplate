# LombokTemplate — Guide How to Use v0.1.0

## 1. Pemasangan

`npm install lomboktemplate` (setelah terbit). Sebelum itu salin `src/` atau pasang dari GitHub.

## 2. Render sederhana

```ts
import { render } from 'lomboktemplate'
render('Halo {{ nama }}', { nama: 'Lombok' })  // 'Halo Lombok'
```

## 3. Templat dokumen (faktur, surat, laporan)

```ts
const env = new Environment()
env.registerHelper('rupiah', ([v]) => 'Rp ' + formatNumber(v))
const t = env.compile(sumber)
const html = t.render({ items, total, catatan })
```

- Gunakan `{{#each items}}` dengan `{{ @index | add:1 }}` untuk nomor baris.
- Gunakan `{{#if (gt diskon 0)}}` untuk kondisi numerik.
- Gunakan `{{ warna | default:'#1a73e8' }}` untuk nilai bawaan.

## 4. Data dari pengguna

Data selalu di-escape oleh `{{ }}`. Untuk tautan dari pengguna gunakan `href="{{ url | safeUrl }}"`. Jangan memakai `{{{ }}}` untuk data yang tidak tepercaya.

## 5. Templat dari pengguna

Templat tidak dapat menjalankan kode atau membaca properti di luar data. Tetap batasi ukuran dengan `maxTemplateLength` dan `maxOutputLength`, dan aktifkan `strict` saat pengembangan untuk menemukan nama yang salah ketik.

## 6. Skenario pemakaian

Dokumen PDF/HTML, email transaksional, halaman statis, berkas konfigurasi, pembangkit kode, label dan tiket di perangkat kasir.

## 7. Batasan

Lihat `full_summary_project_LombokTemplate_v0.1.0.md` bagian 2.
