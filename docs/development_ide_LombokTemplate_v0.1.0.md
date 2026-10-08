# LombokTemplate — Development IDE v0.1.0

## 1. Lingkungan

Node.js 20 atau lebih baru, Python 3.10+ untuk pembangkit vector. Editor apa pun dengan dukungan TypeScript.

## 2. Perintah

| Perintah | Fungsi |
|---|---|
| `npm test` | semua tes |
| `npm run coverage` | tes dengan ambang cakupan |
| `npm run lint` | pemeriksaan tipe ketat |
| `npm run vectors` | bangun ulang berkas vector dan SHA256SUMS |
| `npm run doctor` | lombok doctor |
| `npm run check` | semua di atas plus build |

## 3. Alur mengubah perilaku

1. Ubah SPEC lebih dulu.
2. Tambah atau ubah kasus di `vectors/build_vectors.py`; nilai harapan ditulis tangan dari SPEC, bukan disalin dari keluaran kode.
3. `npm run vectors`, salin SHA-256 baru ke tabel atribut SPEC.
4. Ubah implementasi sampai semua tes lulus.

## 4. Arah pengembangan

Port Rust (rujukan `no_std` + `alloc`), Python, Go, PHP; helper blok terdaftar dengan kontrak lintas bahasa; konteks escaping per atribut.
