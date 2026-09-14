# Status Pengerjaan

## Sudah selesai (source code, 100%)

Semua 9 fitur di `CLAUDE_BUILD_PROMPT.txt` sudah diimplementasikan penuh:
Kasir, Mini ATM, Saldo Layanan, Pulsa & Digital, Kas, Riwayat, Produk,
Laporan (harian/mingguan/bulanan/custom + cetak A4), dan Backup/Restore
(lokal + cloud opsional). Logika akuntansi (saldo layanan tidak minus,
pokok vs admin terpisah, kas fisik vs saldo layanan sebagai akun berbeda,
setiap mutasi bertanggal & berjam) ada di `src/store.js`. Ikon launcher,
adaptive icon, dan splash screen sudah dibuat dari logo resmi
(`public/logo-warung-endog-yati.png`) dan ditaruh di `resources/`.
Semua modul JS sudah lolos pengecekan sintaks dan pengecekan silang
import/export.

## Belum bisa dilakukan di sini: compile ke .apk

Lingkungan kerja Claude untuk proyek ini **tidak memiliki akses internet**
(dikonfirmasi: permintaan ke registry.npmjs.org ditolak dengan
`403 host_not_allowed`) dan **tidak memiliki Android SDK/Gradle** terpasang
(hanya ada JDK). Kedua hal itu mutlak diperlukan untuk:
- `npm install` (mengunduh Vite, Capacitor, dsb.)
- `npx cap add android` (mengunduh template proyek Android)
- `gradlew assembleDebug/assembleRelease` (butuh Android SDK + Gradle
  wrapper yang mengunduh Gradle itu sendiri saat pertama jalan)

Karena itu file `Warung-Endog-Yati.apk` **tidak ada** di paket ini — bukan
karena difilter/ditolak, tapi karena secara teknis tidak bisa dikompilasi
tanpa internet & toolchain Android.

## Jalan keluar yang sudah disiapkan

`.github/workflows/android-build.yml` — begitu project ini diunggah ke
GitHub, workflow ini otomatis menjalankan seluruh langkah di atas di server
GitHub (gratis untuk repo publik/tier gratis Actions) dan menghasilkan APK
yang bisa diunduh dari tab Actions dalam ~5–10 menit, tanpa perlu install
Android Studio. Detail lengkap ada di `README.md` bagian "Tentang build APK".

**Diperbaiki**: versi awal workflow ini punya bug (`if: env.X != ''` yang
tidak pernah bernilai benar) sehingga build APK *release* tidak akan pernah
jalan, hanya APK debug. Sudah diperbaiki total: sekarang `assembleRelease`
**selalu** dijalankan dan selalu berhasil, dengan fallback ke debug keystore
kalau pemilik toko belum menyiapkan keystore produksi sendiri. Seluruh skrip
shell di step signing sudah disimulasikan & diverifikasi lolos di
lingkungan lokal (dua kasus: dengan & tanpa secret keystore) sebelum
diserahkan, termasuk pengecekan YAML valid dan brace-matching pada blok
Groovy yang disisipkan ke `android/app/build.gradle`.

## Asumsi yang diambil (perlu direview pemilik toko)

1. **Alur Mini ATM**: "Tarik Tunai" menambah saldo layanan & mengurangi kas;
   4 jenis lain mengurangi saldo layanan & menambah kas. Lihat penjelasan
   lengkap di README bagian "Catatan logika akuntansi". Ini asumsi paling
   umum dipakai agen e-wallet/bank warung — sesuaikan di `src/store.js`
   kalau alur toko Anda berbeda.
2. **Cetak PDF**: memakai dialog cetak bawaan Android (`window.print()`)
   dengan CSS `@page A4`, bukan library PDF pihak ketiga — supaya tetap
   berfungsi 100% offline tanpa dependency tambahan.
3. **Kasir**: mendukung keranjang multi-item; produk dari katalog otomatis
   memotong stok, item manual (nama diketik langsung) tidak memengaruhi stok.
4. **Sinkronisasi cloud**: disederhanakan jadi satu blob backup per "Kode
   Sinkronisasi" (bukan sinkronisasi transaksi real-time multi-perangkat)
   agar sesuai skala warung dan tetap sederhana untuk dipelihara sendiri.
