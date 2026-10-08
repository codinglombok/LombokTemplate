# Changelog

Semua perubahan penting dicatat di sini. Format mengikuti Keep a Changelog; versi mengikuti Semantic Versioning.

## [0.1.0] - belum terbit

### Added

- Sintaks Mustache (variabel, seksi, seksi terbalik, komentar, partial) dengan aturan baris standalone.
- Blok `#if`/`else if`/`#unless`/`#each`/`#with`, variabel `@index`, `@key`, `@first`, `@last`, `@root`, path `../`, subexpression, argumen bernama.
- Filter `nilai | filter:arg1,arg2` untuk semua helper.
- 24 helper bawaan deterministik (SPEC §8); helper aplikasi lewat `Environment.registerHelper`.
- Mode strict, batas kedalaman blok dan partial, ukuran templat dan keluaran; galat dengan kode stabil, baris, dan kolom.
- SPEC normatif, 168 vector bersama, 122 kasus Mustache spec.
