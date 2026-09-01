# Agenda Sekretariat — versi Netlify

Project ini **sudah dikembalikan** ke fitur inti: bikin & kelola jadwal
agenda (tampilan "Semua Jadwal" ala Google Calendar + "Per Tanggal"),
ditambah lampiran PDF per-agenda. Login tetap 2 akun: **Lisa** (Sekretaris,
bikin agenda + upload PDF) dan **Amir** (Kepala Sekretariat, lihat agenda +
ubah status + lihat PDF).

## Kenapa sempat "fitur agendanya hilang"

Waktu awal migrasi ke Netlify, saya sempat memangkas ke fitur upload/lihat
PDF saja karena itu yang diminta duluan untuk testing cepat. Sekarang sudah
dikembalikan penuh — agenda tetap jadi fitur utama, PDF jadi lampiran di
tiap agenda (bukan file lepas lagi), persis konsep aslinya.

## Yang TIDAK ada di versi Netlify ini (beda dari versi Render)

- **Role Admin & panel kelola user** — tidak ada, karena tujuan awalnya
  (hubungkan Telegram) tidak relevan di sini.
- **Notifikasi Telegram** — bot Telegram butuh proses yang hidup terus
  (*polling*), sementara Netlify Functions itu proses sesaat (nyala pas ada
  request, lalu mati). Untuk ini jalan, Telegram-nya harus diubah ke mode
  *webhook* — bisa dikerjakan lain waktu kalau dibutuhkan.

Kalau nanti butuh fitur itu semua, tetap tersedia utuh di project
`agenda-app` (versi Render) yang terpisah.

## Bug yang sudah diperbaiki: MissingBlobsEnvironmentError

Sempat muncul error "The environment has not been configured to use Netlify
Blobs" saat coba tambah agenda / upload. Penyebabnya: function di project
ini ditulis pakai format lama (`exports.handler`, disebut "Lambda
compatibility mode" oleh Netlify) — di mode ini, Netlify **tidak**
otomatis menyalakan akses ke Blobs. Fix-nya: panggil `connectLambda(event)`
di baris pertama tiap function yang pakai Blobs, sebelum `getStore()`
dipanggil. Ini sudah diterapkan di semua function terkait
(`agenda.js`, `agenda-item.js`, `attachment-upload.js`,
`attachment-view.js`, `attachment-delete.js`) — tidak perlu diapa-apakan
lagi, tinggal deploy versi ini.

## Kenapa upload PDF kemarin gagal — dan cara benerinnya

Fungsi `login`/`me`/`logout` cuma pakai fitur bawaan Node.js, jadi langsung
jalan. Tapi fungsi upload PDF butuh 2 package tambahan (`busboy`,
`@netlify/blobs`) yang perlu di-install dulu oleh Netlify sebelum function-nya
bisa jalan — dan ini kemungkinan besar terlewat karena kolom **Build
command** dikosongkan waktu setup awal.

**Cara pastikan ini kepasang setelah push kode terbaru ini:**
1. Buka dashboard Netlify → site Anda → **Site configuration** → **Build &
   deploy** → **Build settings** → klik **Edit**.
2. Isi **Build command** dengan: `npm install`
3. **Publish directory** tetap `public` (jangan diubah).
4. Save, lalu ke tab **Deploys** → **Trigger deploy** → **Deploy site**.
5. Kalau upload masih gagal setelah ini, buka tab **Functions** di
   dashboard → klik `attachment-upload` → lihat **Function log**, akan ada
   pesan error asli di situ (bukan pesan generik di halaman web) — kirim
   screenshot log itu kalau masih error, supaya bisa didiagnosis pasti.

## Environment Variables

| Nama | Isi |
|---|---|
| `LISA_PASSWORD` | password akun Lisa (default `lisa123` kalau kosong) |
| `AMIR_PASSWORD` | password akun Amir (default `amir123` kalau kosong) |
| `JWT_SECRET` | string acak panjang, WAJIB diisi sendiri |

Username tetap `lisa` dan `amir` (huruf kecil).

## Struktur data

Semua agenda (termasuf metadata lampiran) disimpan dalam satu blob JSON di
Netlify Blobs (store `app-data`, key `state`). Isi PDF-nya sendiri disimpan
terpisah per file di store `pdf-files`. Semua ini otomatis tersedia begitu
function pertama kali jalan — tidak perlu setup manual.

## Batasan

- **Ukuran file maksimal 4MB per PDF** (batas aman di bawah limit payload
  Netlify Functions).
- Functions gratis Netlify punya timeout 10 detik per request — cukup jauh
  untuk upload PDF beberapa MB.
- Ini penyimpanan sederhana (bukan database transaksional) — kalau 2 orang
  menyimpan perubahan persis bersamaan di detik yang sama, ada kemungkinan
  kecil salah satu perubahan tertimpa. Untuk pemakaian testing/kecil ini
  bukan masalah; kalau nanti dipakai serius dengan banyak orang, ini bisa
  diperkuat lagi.

## Deploy

1. Push ke GitHub (repo terpisah dari project lain).
2. Netlify → Add new site → Import dari GitHub → pilih repo ini.
3. **Build command**: `npm install` (WAJIB diisi, jangan dikosongkan — lihat
   bagian di atas). **Publish directory**: `public`.
4. Deploy → tunggu Published.
5. Site configuration → Environment variables → isi `LISA_PASSWORD`,
   `AMIR_PASSWORD`, `JWT_SECRET` → Save.
6. Deploys → Trigger deploy → Deploy site (supaya env var baru kepakai).
7. Buka URL-nya, login sebagai Lisa, coba tambah agenda & upload PDF. Login
   sebagai Amir, coba lihat agendanya & buka PDF-nya.
