# LombokTemplate — SPEC v0.1.0

This document is the normative cross-language contract. Every language port MUST produce byte-identical output for all specified inputs. Deviations from this specification are bugs.

| Atribut | Nilai |
|---|---|
| Versi SPEC | 0.1.0 (berlaku untuk paket `lomboktemplate` 0.1.x) |
| Standar acuan | Mustache spec (github.com/mustache/spec, commit e8ec001; berkas interpolation, sections, inverted, comments, partials); sintaks blok dan helper mengikuti Handlebars 4; filter mengikuti gaya Liquid |
| Suite kesesuaian | 122 kasus Mustache spec (`tests/fixtures/*.json`, lisensi MIT) |
| Vector | `vectors/lomboktemplate-vectors-v1.json`: 168 kasus (135 keluaran, 33 galat). SHA-256 `789489faf9bc9d0c01890e50eb5965bc9c88983ac2abdc94e1c410269d38f22d` |
| Referensi | TypeScript (`src/`) |
| Tanggal tinjauan | 2026-10-08 |

Kata MUST, MUST NOT, SHOULD, MAY mengikuti RFC 2119. "Karakter" berarti unit kode UTF-16 untuk posisi galat dan batas panjang, dan code point untuk fungsi teks (`length`, `truncate`).

## 1. Ruang lingkup

1. Masukan: teks templat dan data berbentuk model JSON (null, boolean, angka IEEE 754 double, string, array, objek dengan urutan kunci sisipan).
2. Di luar bahasa ini (ditolak atau tidak didukung): ganti delimiter (`{{= =}}`), lambda, nama partial dinamis, pewarisan templat, block parameter (`as |x|`), helper blok buatan pengguna, evaluasi kode apa pun.
3. Keluaran: string. Tidak ada I/O; partial disediakan pemanggil.

## 2. Pemindaian tag

1. Tag dibuka `{{` dan ditutup `}}`. `{{{ ... }}}` adalah tag mentah dan harus ditutup `}}}`.
2. Penanda `~` tepat setelah pembuka (`{{~`) atau tepat sebelum penutup (`~}}`) mengaktifkan kontrol spasi (3.2).
3. Jenis tag ditentukan karakter pertama isi setelah spasi: `!` komentar, `#` buka blok, `^` buka seksi terbalik, `/` tutup, `>` partial, `&` mentah, `=` MUST ditolak (`SYNTAX`). Isi `else`, `else ...`, atau `^` saja adalah tag else.
4. Komentar `{{!-- ... --}}` berakhir pada `--}}` pertama dan boleh memuat `}}`. Komentar `{{! ... }}` berakhir pada `}}` pertama.
5. Tag tanpa penutup, atau tag selain komentar dengan isi kosong, MUST menghasilkan `SYNTAX` dengan baris dan kolom pembuka tag.

## 3. Spasi

### 3.1 Baris standalone

Tag komentar, buka blok, buka seksi terbalik, else, tutup, dan partial adalah *standalone* bila sendirian di barisnya: sebelum tag hanya ada spasi/tab sejak awal baris (atau awal templat), sesudah tag hanya ada spasi/tab sampai `\n` atau `\r\n` (atau akhir templat), dan tidak ada tag lain di baris itu. Untuk tag standalone, spasi di depannya dan akhir barisnya (termasuk `\n`) MUST dihapus. Spasi depan yang dihapus dari partial standalone menjadi indentasi: setiap baris berisi pada sumber partial diberi awalan indentasi itu sebelum partial di-parse, sehingga baris baru di dalam data tidak terindentasi.

### 3.2 Kontrol spasi

`{{~` menghapus semua spasi ASCII (spasi, `\t`, `\n`, `\r`, `\f`, `\v`) di akhir teks sebelum tag; `~}}` menghapus semua spasi ASCII di awal teks sesudah tag. Kontrol spasi diterapkan setelah aturan standalone.

## 4. Ekspresi

```
ekspresi   = kepala ( "|" filter )*
kepala     = nama-helper argumen+          ; pemanggilan helper (minimal satu argumen)
           | primer
filter     = nama-helper [ ":" primer ( "," primer )* ]
argumen    = primer | kunci "=" primer     ; argumen bernama setelah argumen posisional
primer     = string | angka | "true" | "false" | "null" | "undefined"
           | path | "(" nama-helper argumen* ")"
string     = '...' | "..."                 ; \n \t, dan \x untuk x lain berarti x
angka      = -?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][-+]?[0-9]+)?
path       = ["@"] ("../")* ["@"] ( "this" | "." | segmen ( ("."|"/") segmen )* )
nama-helper= [A-Za-z_$][A-Za-z0-9_$-]*
```

1. Nama tunggal tanpa argumen SELALU berarti pencarian data, bukan helper. `{{date}}` membaca data `date` walaupun ada helper `date`; helper tanpa argumen dipanggil sebagai `(nama)`.
2. Segmen `__proto__`, `constructor`, dan `prototype` MUST ditolak saat parse (`SYNTAX`).
3. Segmen dalam kurung siku (`[x y]`) tidak didukung (`SYNTAX`).
4. `@nama` adalah variabel data blok (`@index`, `@key`, `@first`, `@last`, `@root`). `@../index` membaca variabel blok satu tingkat di atas.

## 5. Blok

| Tag buka | Arti | Penutup | Else |
|---|---|---|---|
| `{{#if e}}` | tampilkan bila `e` truthy | `{{/if}}` | `{{else}}`, `{{else if e2}}` |
| `{{#unless e}}` | tampilkan bila `e` falsy | `{{/unless}}` | `{{else}}` |
| `{{#each e}}` | ulangi array atau objek polos | `{{/each}}` | `{{else}}` bila kosong |
| `{{#with e}}` | jadikan `e` konteks bila truthy | `{{/with}}` | `{{else}}` |
| `{{#nama}}` | seksi Mustache | `{{/nama}}` (teks isi identik) | tidak boleh (`SYNTAX`) |
| `{{^nama}}` | seksi terbalik | `{{/nama}}` | - |

1. Penutup yang tidak cocok, blok tak tertutup, penutup tanpa pembuka, `else` di luar blok, `else` kedua, dan `#if`/`#unless`/`#each`/`#with` tanpa ekspresi MUST menghasilkan `SYNTAX`.
2. Kedalaman blok melebihi `maxDepth` (bawaan 64) MUST menghasilkan `LIMIT_EXCEEDED` saat parse.

## 6. Evaluasi

### 6.1 Tumpukan konteks

Render dimulai dengan satu frame berisi data akar dan variabel `@root`. `#each`, `#with`, dan seksi Mustache menambah frame; `#if` dan `#unless` tidak. `#each` atas array mengikat `@index`, `@first`, `@last`; atas objek polos menambah `@key` dan mengikuti urutan kunci sisipan. Seksi Mustache atas array mengulang seperti `#each`; atas nilai truthy lain menambah satu frame.

### 6.2 Pencarian path

1. `this`/`.` adalah nilai frame teratas; `../` naik satu frame per kemunculan; path yang diawali `../` tidak mencari ke frame lain.
2. Nama biasa dicari dari frame teratas ke bawah; frame pertama yang *memiliki* segmen pertama dipakai, lalu segmen berikutnya dibaca dari nilai itu tanpa mencari frame lain (rantai putus menghasilkan nilai hilang).
3. Akses properti MUST terbatas pada: properti data milik sendiri objek polos (prototipe `Object.prototype` atau null), indeks desimal dan `length` pada array, `length` pada string (jumlah code point). Getter, properti warisan, dan instans kelas menghasilkan nilai hilang.

### 6.3 Truthy

Falsy: hilang, `null`, `false`, `0`, `NaN`, `""`, `[]`. Semua nilai lain truthy, termasuk `{}` dan `"0"`.

## 7. Keluaran

### 7.1 Bentuk teks

| Nilai | Teks |
|---|---|
| hilang, `null` | string kosong |
| string | apa adanya |
| angka | `-0` menjadi `0`; bilangan bulat tanpa titik desimal; lainnya representasi round-trip terpendek (aturan `Number.prototype.toString` ECMAScript, termasuk `1e+21`, `NaN`, `Infinity`) |
| boolean | `true` / `false` |
| array | elemen diubah dengan aturan ini lalu digabung `,` |
| objek | string kosong |

### 7.2 Escaping

`{{ e }}` MUST mengganti `&` `<` `>` `"` `'` `` ` `` `=` menjadi `&amp;` `&lt;` `&gt;` `&quot;` `&#39;` `&#96;` `&#61;`. `{{{ e }}}` dan `{{& e}}` tidak meng-escape. Nilai SafeString (hasil `raw`, `nl2br`, atau helper aplikasi) tidak di-escape. Escaping aman untuk teks HTML dan nilai atribut berkutip; validasi URL dilakukan dengan filter `safeUrl`.

### 7.3 Mode strict

Dengan `strict: true`, keluaran `{{ e }}` yang hilang MUST menghasilkan `MISSING_VALUE`, dan partial yang tidak terdaftar MUST menghasilkan `MISSING_PARTIAL`. `null` bukan nilai hilang. Kondisi blok tidak terpengaruh. Tanpa strict, keduanya menjadi string kosong.

## 8. Helper bawaan

Helper dipanggil dengan argumen yang sudah dievaluasi. Filter `a | f:b,c` setara dengan `f a b c`. Jumlah argumen yang salah, atau galat apa pun di dalam helper, MUST menghasilkan `HELPER_ERROR`. Helper tak dikenal MUST menghasilkan `UNKNOWN_HELPER` saat render.

| Helper | Argumen | Hasil |
|---|---|---|
| `eq`, `ne` | 2 | kesamaan ketat; `null` dan hilang dianggap sama |
| `gt`, `gte`, `lt`, `lte` | 2 | angka dibandingkan numerik, string per code point; tipe lain `false` |
| `and`, `or` | 2 atau lebih | boolean dari truthy (6.3) |
| `not` | 1 | boolean |
| `add`, `sub`, `mul`, `div` | 2 | angka; argumen harus angka berhingga atau string desimal; `div` dengan 0 adalah galat |
| `default` | 2 | argumen kedua bila yang pertama hilang, `null`, atau `""` |
| `upper`, `lower` | 1 | pemetaan huruf Unicode penuh tanpa locale (`ß` menjadi `SS`) |
| `trim` | 1 | buang spasi ASCII di kedua ujung |
| `truncate` | 2 atau 3 | potong ke n code point lalu tambah akhiran (bawaan `…`) bila lebih panjang; n bilangan bulat >= 0 |
| `length` | 1 | panjang array, jumlah code point string, jumlah kunci objek; lainnya 0 |
| `join` | 1 atau 2 | elemen array (7.1) digabung pemisah (bawaan `,`) |
| `nl2br` | 1 | teks di-escape lalu `\r\n`/`\n` menjadi `<br>`; SafeString |
| `raw` | 1 | SafeString dari teks |
| `safeUrl` | 1 | buang spasi ASCII di ujung; bila (setelah membuang kontrol C0 dan spasi) URL memiliki skema selain `http`, `https`, `mailto`, `tel`, hasilnya string kosong |
| `json` | 1 | JSON tanpa spasi, kunci objek diurutkan per code point, angka tak berhingga menjadi `null`, karakter kontrol sebagai `\uXXXX` (kecuali `\b \f \n \r \t`); kedalaman maksimum 64 |

Helper buatan aplikasi menerima argumen, argumen bernama (`hash`), konteks teratas, data akar, dan fungsi escape. Helper yang bergantung pada locale (mata uang, tanggal) bukan bagian dari bawaan, agar keluaran bawaan identik di semua port.

## 9. Partial dan batas

1. `{{> nama}}` me-render partial terdaftar dengan konteks saat ini; `{{> nama e}}` menambah frame bernilai `e`. Nama partial: `[A-Za-z0-9_$\-./]+` atau string berkutip.
2. Kedalaman partial melebihi `maxPartialDepth` (bawaan 32) MUST menghasilkan `LIMIT_EXCEEDED`.
3. Panjang templat melebihi `maxTemplateLength` (bawaan 4 194 304) dan keluaran melebihi `maxOutputLength` (bawaan 67 108 864) MUST menghasilkan `LIMIT_EXCEEDED`.
4. Waktu pemindaian, parse, dan render MUST linear terhadap panjang templat dan keluaran (tanpa jalur kuadratik).

## 10. Galat

| Kode | Kapan |
|---|---|
| `SYNTAX` | tag rusak, ekspresi tidak sah, blok tidak seimbang, segmen terlarang, nama helper/partial tidak sah |
| `UNKNOWN_HELPER` | helper atau filter tidak terdaftar |
| `UNSUPPORTED` | block parameter |
| `LIMIT_EXCEEDED` | batas di 5.2 dan 9 |
| `MISSING_VALUE`, `MISSING_PARTIAL` | mode strict (7.3) |
| `HELPER_ERROR` | argumen salah atau galat di dalam helper |

Galat yang terkait tag membawa baris dan kolom (1-based) dari pembuka tag.

## 11. Vector

Setiap kasus berisi `template`, `data`, opsional `partials` dan `options.strict`, dan `expected` berupa `{ "output": string }` atau `{ "error": KODE }`. Setiap port MUST menjalankan semua kasus dan Mustache spec (bagian 1 tabel atribut).
