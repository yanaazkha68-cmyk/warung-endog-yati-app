# WARUNG ENDOG YATI — Aplikasi Kasir & Pembukuan (Android)

Status: **source code lengkap, siap di-build**. Lihat bagian *"Tentang build APK"*
di bawah untuk cara mendapatkan file `Warung-Endog-Yati.apk`.

## Fitur

- **Kasir** — keranjang multi-item, ambil cepat dari daftar produk (otomatis
  potong stok) atau input manual, hitung total & laba per transaksi.
- **Mini ATM** — Tarik Tunai, Setor Tunai, Transfer, Top Up E-Wallet,
  Pembayaran/PPOB. Saldo layanan **tidak pernah minus** (divalidasi sebelum
  transaksi disimpan). Nominal pokok & biaya/admin dicatat terpisah; admin
  selalu tercatat sebagai laba.
- **Saldo Layanan** — kelola banyak akun (DANA, SUPERBANK, Bank, custom),
  top-up saldo dengan opsi ambil dari kas atau modal luar.
- **Pulsa & Digital** — jual pulsa/paket data/token, laba = harga jual − modal.
- **Kas** — kas masuk/keluar manual dengan keterangan; **kas fisik dan saldo
  layanan adalah dua akun terpisah** dan tidak saling tertukar.
- **Riwayat** — semua transaksi (Kasir, Mini ATM, Digital, Kas) dalam satu
  linimasa, terurut waktu terbaru, masing-masing bertanggal & berjam.
- **Produk** — CRUD produk + stok.
- **Laporan** — filter Hari Ini / Minggu Ini / Bulan Ini / Custom, ringkasan
  penjualan-modal-laba per kategori, dan **cetak/simpan PDF ukuran A4**
  langsung dari HP (lewat dialog cetak bawaan Android).
- **Backup/Restore** — export/import JSON (via share sheet Android atau
  unduhan browser), reset data, plus **sinkronisasi cloud opsional** ke
  Cloudflare Worker + D1 milik Anda sendiri.
- **Offline-first** — semua data tersimpan di penyimpanan lokal HP
  (localStorage di dalam WebView Android); tidak hilang saat aplikasi
  ditutup, tidak butuh internet untuk dipakai sehari-hari.
- Tombol **Back Android** berfungsi (kembali ke Beranda, keluar app dari Beranda).
- **Tidak pernah** login, menyimpan, atau memproses PIN/OTP/password DANA,
  SUPERBANK, Bank, OrderKuota, atau layanan pihak ketiga apa pun — aplikasi
  ini murni mencatat transaksi yang Anda input sendiri.

## Struktur proyek

```
src/            kode aplikasi (store.js = logika akuntansi, ui.js = tampilan,
                report.js = laporan & cetak, sync.js = cloud opsional,
                backup.js = export/import file, native.js = integrasi Android)
public/         manifest, service worker, ikon PWA, logo resmi
resources/      aset sumber untuk @capacitor/assets (icon, adaptive icon, splash)
database/       skema D1 (Cloudflare) untuk backup cloud opsional
cloudflare/     Worker API backup/restore (worker.js) + wrangler.toml
.github/workflows/android-build.yml   CI yang meng-compile APK otomatis
```

## Tentang build APK — baca ini dulu

Source code di project ini **sudah lengkap dan siap di-build**, tapi
meng-compile-nya menjadi file `.apk` butuh Android SDK + Gradle + koneksi
internet (untuk mengunduh dependency) yang **tidak tersedia di lingkungan
kerja Claude**. Karena itu APK tidak bisa dihasilkan langsung di sini.

Cara paling praktis mendapatkan APK tanpa install apa pun di komputer Anda:

### Opsi A — GitHub Actions (otomatis, direkomendasikan)

### Langkah paling sederhana (tanpa install apa pun, lewat browser saja)

1. **Buat repo**: buka github.com → tombol **+** (kanan atas) → **New repository**
   → beri nama (mis. `warung-endog-yati`) → **Private** atau **Public**, bebas
   → **Create repository**. Jangan centang "Add a README" (biar tidak bentrok).
2. **Unggah project**: di halaman repo kosong tsb akan ada tautan
   **"uploading an existing file"** — klik itu. Di komputer, **ekstrak dulu**
   `Warung-Endog-Yati-source-ready.zip`, lalu **drag semua ISI folder hasil
   ekstrak** (bukan file zip-nya, dan bukan folder pembungkusnya — masuk dulu
   ke dalamnya, baru drag isinya: `src/`, `public/`, `.github/`, `README.md`, dst)
   ke area upload GitHub. Tunggu sampai semua ter-upload, lalu klik
   **Commit changes** di bawah.
3. **Jalankan Actions**: klik tab **Actions** di bagian atas repo. GitHub akan
   otomatis mendeteksi & menjalankan workflow *"Build Warung Endog Yati APK"*
   begitu ada push (biasanya langsung mulai berjalan setelah langkah 2). Kalau
   belum, klik workflow tsb di sidebar kiri → tombol **Run workflow** → **Run workflow**.
4. **Tunggu selesai**: proses berjalan ±5–10 menit. Refresh halaman Actions,
   tunggu tanda ✅ hijau (bukan ❌ merah) di sebelah nama run.
5. **Unduh APK**: klik run yang sudah selesai tsb → scroll ke bawah ke bagian
   **Artifacts** → klik **Warung-Endog-Yati-apk** untuk mengunduh file `.zip`
   kecil berisi dua APK:
   - `Warung-Endog-Yati.apk` → **APK release** (siap dipakai).
   - `Warung-Endog-Yati-debug.apk` → APK debug (untuk keperluan tes/debug saja).
6. Pindahkan `Warung-Endog-Yati.apk` ke HP Android (lewat kabel, Google Drive,
   WhatsApp ke diri sendiri, dll), buka filenya, aktifkan **"Izinkan dari
   sumber ini" / "Install aplikasi tidak dikenal"** saat diminta, lalu Install.

Ikon launcher otomatis dibuat dari `resources/icon.png` &
`resources/icon-foreground.png`/`icon-background.png` (sudah disiapkan dari
logo resmi Anda) oleh langkah `capacitor-assets generate` di dalam workflow.

**Soal tanda tangan APK release** — workflow ini **selalu berhasil** membuat
`Warung-Endog-Yati.apk`, tanpa perlu setup tambahan:
- **Tanpa secret keystore** (langkah di atas, paling sederhana): APK release
  ditandatangani otomatis dengan *debug key* bawaan. File ini **100% bisa
  di-install & dipakai sehari-hari di HP Android** — hanya belum memenuhi
  syarat untuk dipublikasikan ke Google Play Store.
- **Kalau nanti ingin tanda tangan produksi sendiri** (mis. untuk dipublikasikan
  ke Play Store): buat keystore sendiri, lalu simpan sebagai GitHub Secrets di
  *Settings > Secrets and variables > Actions* pada repo Anda:
  - `ANDROID_KEYSTORE_BASE64` — isi file `.jks`/`.keystore` Anda, di-encode base64
  - `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`

  ```bash
  keytool -genkeypair -v -keystore warung-endog-yati.keystore \
    -alias warungendogyati -keyalg RSA -keysize 2048 -validity 10000
  # simpan file warung-endog-yati.keystore ini baik-baik — kalau hilang,
  # Anda tidak bisa lagi meng-update APK dengan tanda tangan yang sama.
  base64 -w0 warung-endog-yati.keystore > keystore-base64.txt
  # isi file keystore-base64.txt itulah yang ditempel ke secret ANDROID_KEYSTORE_BASE64
  ```
  Setelah keempat secret diisi, jalankan ulang workflow (Actions → Run workflow)
  — `Warung-Endog-Yati.apk` yang dihasilkan otomatis akan pakai keystore Anda.

### Opsi B — Android Studio di komputer sendiri

```bash
npm install
npm run build
npx cap add android
npx capacitor-assets generate --android   # bikin launcher icon & splash dari resources/
npx cap sync android
npx cap open android
```
Lalu di Android Studio: **Build > Generate Signed Bundle / APK > APK**.

Build cepat lewat terminal (debug, tanpa perlu buka Android Studio):
```bash
cd android
./gradlew assembleDebug      # hasil: android/app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease    # perlu konfigurasi signing terlebih dahulu
```

## Catatan logika akuntansi (Mini ATM)

Supaya konsisten dan saldo layanan tidak pernah minus:

- **Tarik Tunai**: nasabah menitipkan dana ke akun Anda → **saldo layanan
  bertambah**, **kas fisik berkurang** sebesar nominal (Anda beri tunai),
  lalu **kas bertambah** sebesar biaya/admin. Divalidasi: kas harus cukup.
- **Setor Tunai / Transfer / Top Up E-Wallet / Pembayaran-PPOB**: nasabah
  bayar tunai ke Anda, Anda pakai saldo layanan sendiri untuk melayani →
  **saldo layanan berkurang** (divalidasi tidak boleh minus), **kas fisik
  bertambah** sebesar nominal + biaya/admin.

Sesuaikan di `src/store.js` (`recordATM`, konstanta `ATM_TYPES_SALDO_MASUK`)
jika alur kerja Anda berbeda.

## Cloudflare (opsional)

1. `npx wrangler d1 create warung-endog-yati` → salin `database_id` yang
   diberikan ke `cloudflare/wrangler.toml`.
2. `npx wrangler d1 execute warung-endog-yati --file=./database/schema.sql`
3. `cd cloudflare && npx wrangler deploy`
4. Di aplikasi: menu **Backup** → isi *URL Worker* (mis. `https://warung-endog-yati-api.<akun>.workers.dev`)
   dan *Kode Sinkronisasi* bebas buatan sendiri (bukan PIN/password bank apa pun) → **Simpan ke Cloud** / **Ambil dari Cloud**.

Jangan pernah menaruh API key, PIN, OTP, atau password bank/e-wallet di
source code atau di Worker ini.

## Catatan

Aplikasi ini hanya mencatat transaksi yang diinput manual oleh pengguna.
Tidak ada login atau otomasi apa pun terhadap akun DANA, SUPERBANK, Bank,
OrderKuota, atau aplikasi pihak ketiga lainnya.
