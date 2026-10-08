# LombokTemplate — How to Dist v0.1.0

## 1. Registry

| Bahasa | Paket | Status |
|---|---|---|
| TypeScript / JavaScript | `lomboktemplate` (npm) | belum terbit |
| Python, Go, PHP, Rust | - | rencana |

## 2. Alur rilis

1. `npm run check` (lint, cakupan, build, lombok doctor) lulus.
2. Versi di `package.json`, nama berkas dokumen, dan CHANGELOG sama.
3. Bila vector berubah: `npm run vectors`, perbarui SHA-256 di SPEC.
4. Tag `vX.Y.Z`; CI menerbitkan ke npm dengan provenance.

## 3. Pasca-rilis

Perbarui tabel status registry di README dan dokumen ini.
