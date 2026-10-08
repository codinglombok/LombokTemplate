# LombokTemplate — Bahasa & i18n v0.1.0

## 1. Unicode

Templat dan data diproses sebagai teks Unicode apa adanya; tidak ada normalisasi. `length` dan `truncate` menghitung code point, sehingga emoji dan aksara di luar BMP tidak terpotong di tengah. `upper` dan `lower` memakai pemetaan huruf Unicode penuh tanpa locale (`ß` menjadi `SS`); aturan khusus locale (misalnya `i` bertitik dalam bahasa Turki) bukan bagian dari bawaan.

## 2. RTL dan aksara kompleks

LombokTemplate tidak mengubah urutan teks. Arah teks (`dir="rtl"`) dan shaping ditangani oleh lapisan tampilan.

## 3. Format bergantung locale

Mata uang, angka, persen, dan tanggal sengaja tidak menjadi helper bawaan agar keluaran identik di semua port. Daftarkan helper aplikasi, misalnya dengan LombokLocale:

```ts
env.registerHelper('currency', ([v], { hash }) => formatCurrency(String(v), hash['locale'] ?? 'id-ID', 'IDR'))
```

## 4. Pesan galat

Pesan galat berbahasa Inggris dengan kode stabil (SPEC §10). Aplikasi menerjemahkan berdasarkan `code`.
