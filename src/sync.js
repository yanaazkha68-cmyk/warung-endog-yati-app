// Sinkronisasi cloud OPSIONAL ke Cloudflare Worker + D1 (lihat /cloudflare).
// Tidak pernah menyentuh akun DANA/SUPERBANK/Bank/OrderKuota pihak ketiga —
// ini hanya backup/restore data toko sendiri, dikunci dengan "Kode Sinkronisasi"
// yang dibuat sendiri oleh pemilik warung (bukan PIN/OTP layanan manapun).

import { getDB, setSync, exportData, importData } from './store.js';

function endpoint(path) {
  const url = (getDB().sync.url || '').replace(/\/$/, '');
  if (!url) throw new Error('Isi dulu "URL Worker" di menu Backup.');
  return url + path;
}

function requireCode() {
  const code = (getDB().sync.code || '').trim();
  if (!code) throw new Error('Isi dulu "Kode Sinkronisasi" di menu Backup.');
  return code;
}

export async function pushToCloud() {
  const code = requireCode();
  const res = await fetch(endpoint('/api/backup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, data: exportData() }),
  });
  if (!res.ok) throw new Error('Gagal mengirim data ke cloud (status ' + res.status + ').');
  setSync({ lastSyncedAt: new Date().toISOString() });
}

export async function pullFromCloud() {
  const code = requireCode();
  const res = await fetch(endpoint('/api/restore?code=' + encodeURIComponent(code)));
  if (!res.ok) throw new Error('Gagal mengambil data dari cloud (status ' + res.status + ').');
  const json = await res.json();
  if (!json || !json.data) throw new Error('Belum ada backup cloud untuk kode ini.');
  importData(json.data);
  setSync({ lastSyncedAt: new Date().toISOString() });
}
