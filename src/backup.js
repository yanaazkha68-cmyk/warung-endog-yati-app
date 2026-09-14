// Ekspor/impor file backup JSON. Di Android (native) file ditulis ke
// penyimpanan aplikasi lalu dibuka dialog "Bagikan" (Capacitor Filesystem +
// Share) agar pengguna bisa menyimpannya ke Drive/WhatsApp/dsb. Di browser
// biasa (mis. saat development) jatuh ke unduhan Blob standar.

function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

export async function saveBackupFile(jsonString, filename) {
  if (isNative()) {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const write = await Filesystem.writeFile({
        path: filename,
        data: jsonString,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({
        title: 'Backup Warung Endog Yati',
        text: 'Backup data ' + filename,
        url: write.uri,
      });
      return;
    } catch (e) {
      // Kalau plugin native gagal/belum terpasang, jatuh ke cara browser di bawah.
      console.warn('Native backup gagal, pakai fallback unduhan browser:', e);
    }
  }
  const blob = new Blob([jsonString], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsText(file);
  });
}
