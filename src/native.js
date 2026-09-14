// Integrasi native Capacitor. Dibuat defensif (try/catch + dynamic import)
// supaya kode yang sama tetap aman dijalankan di browser biasa saat development
// (npm run dev), dan baru aktif penuh saat berjalan sebagai APK Android.

function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

/**
 * @param {() => string} getActivePage - halaman yang sedang aktif
 * @param {(page:string) => void} goTo - pindah halaman
 * @param {string} rootPage - halaman yang dianggap "beranda" (tombol back di sini keluar app)
 */
export function setupBackButton(getActivePage, goTo, rootPage = 'dashboard') {
  if (!isNative()) return;
  import('@capacitor/app')
    .then(({ App }) => {
      App.addListener('backButton', () => {
        const page = getActivePage();
        if (page === rootPage) {
          App.exitApp();
        } else {
          goTo(rootPage);
        }
      });
    })
    .catch(() => {
      // Plugin belum ter-install (mis. saat pratinjau web) — abaikan dengan aman.
    });
}

export function setupStatusBar() {
  if (!isNative()) return;
  import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) => {
      StatusBar.setBackgroundColor({ color: '#F6B800' }).catch(() => {});
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    })
    .catch(() => {});
}
