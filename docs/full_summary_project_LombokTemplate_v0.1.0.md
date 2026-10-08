# LombokTemplate — Full Summary Project v0.1.0

## 1. Tabel gap vs pembanding (jujur)

| Aspek | LombokTemplate 0.1.0 | Handlebars 4 | Mustache | Liquid | Nunjucks/Jinja |
|---|---|---|---|---|---|
| Seksi Mustache | ya (122/122 spec) | sebagian | ya | tidak | tidak |
| `if`/`else if`/`each`/`with` | ya | ya | tidak | ya | ya |
| Filter `a \| f:x` | ya | tidak | tidak | ya | ya |
| Helper blok buatan pengguna | tidak | ya | lambda | tag kustom | ya |
| Block parameter `as \|x\|` | tidak | ya | tidak | tidak | ya |
| Ganti delimiter | tidak | tidak | ya | tidak | konfigurasi |
| Pewarisan templat | tidak | partial blocks | tidak | tidak | ya |
| Eksekusi kode | tidak ada | dikompilasi ke JS | tidak | tidak | ekspresi Python |
| Akses prototipe | diblokir saat parse | diblokir sejak 4.6 | bergantung implementasi | - | sandbox |
| Spesifikasi lintas bahasa + vector | ya | tidak | spec tanpa helper | tidak | tidak |

## 2. Batasan yang diketahui

- Hanya port TypeScript; port lain menyusul dengan vector yang sama.
- Tidak ada helper blok buatan pengguna, block parameter, lambda, ganti delimiter, dan pewarisan templat.
- Escaping aman untuk teks HTML dan atribut berkutip, bukan untuk konteks `<script>`, `<style>`, atau atribut tanpa kutip yang berisi spasi; validasi URL perlu `safeUrl`.
- Format locale (mata uang, tanggal) didaftarkan aplikasi.

## 3. Prinsip Universal (ringkas, untuk publik)

Mandiri dan tanpa dependensi; dipakai siapa pun untuk keperluan apa pun; perilaku ditetapkan SPEC normatif dan vector bersama; aman secara bawaan; batas masukan selalu ada; lisensi Apache-2.0.
