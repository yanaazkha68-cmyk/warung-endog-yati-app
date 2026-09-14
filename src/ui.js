// Tampilan & interaksi. Modul ini HANYA mengurus DOM; semua aturan
// pembukuan ada di store.js supaya gampang diaudit/diuji terpisah.

import {
  getDB,
  onChange,
  addProduct,
  deleteProduct,
  recordSale,
  deleteSale,
  recordATM,
  addAccount,
  deleteAccount,
  topupAccount,
  recordCashMove,
  recordDigital,
  exportData,
  importData,
  resetData,
  setSync,
  setShopName,
  ATM_TYPES,
  AppError,
} from './store.js';
import { money, fmtDateTime } from './format.js';
import { rangeFor, buildReport, printReport } from './report.js';
import { pushToCloud, pullFromCloud } from './sync.js';
import { saveBackupFile, readFileAsText } from './backup.js';
import { setupBackButton, setupStatusBar } from './native.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let activePage = 'dashboard';
let cart = []; // keranjang kasir sementara (tidak disimpan sampai "Selesaikan Transaksi")
let laporanState = { preset: 'hari', from: '', to: '' };

function toast(msg, isError = false) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = isError ? 'error show' : 'show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

function tryAction(fn) {
  return (...args) => {
    try {
      fn(...args);
    } catch (e) {
      if (e instanceof AppError) toast(e.message, true);
      else {
        console.error(e);
        toast('Terjadi kesalahan tak terduga.', true);
      }
    }
  };
}

function shell() {
  const db = getDB();
  document.querySelector('#app').innerHTML = `
    <header>
      <img src="/logo-warung-endog-yati.png" alt="Logo">
      <div><b>${esc(db.shopName).toUpperCase()}</b><small>Kasir &amp; Pembukuan</small></div>
    </header>
    <main id="page"></main>
    <nav class="bottom">
      <button data-nav="dashboard" class="${activePage === 'dashboard' ? 'active' : ''}">🏠<span>Beranda</span></button>
      <button data-nav="kasir" class="${activePage === 'kasir' ? 'active' : ''}">🧾<span>Kasir</span></button>
      <button data-nav="atm" class="${activePage === 'atm' ? 'active' : ''}">🏧<span>Mini ATM</span></button>
      <button data-nav="riwayat" class="${activePage === 'riwayat' ? 'active' : ''}">📜<span>Riwayat</span></button>
      <button data-nav="laporan" class="${activePage === 'laporan' ? 'active' : ''}">📊<span>Laporan</span></button>
    </nav>
    <div id="print-area"></div>
  `;
  document.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => render(b.dataset.nav)));
}

export function render(page) {
  activePage = page;
  shell();
  const p = document.querySelector('#page');
  const db = getDB();
  const renderers = {
    dashboard: pageDashboard,
    kasir: pageKasir,
    atm: pageATM,
    saldo: pageSaldo,
    kas: pageKas,
    digital: pageDigital,
    riwayat: pageRiwayat,
    produk: pageProduk,
    laporan: pageLaporan,
    backup: pageBackup,
  };
  (renderers[page] || pageDashboard)(p, db);
}

export function getActivePage() {
  return activePage;
}

// -------------------------------------------------------------- Dashboard --

function pageDashboard(p, db) {
  const totalSales = db.sales.reduce((s, x) => s + x.total, 0);
  const totalLaba =
    db.sales.reduce((s, x) => s + x.laba, 0) +
    db.digital.reduce((s, x) => s + x.laba, 0) +
    db.atm.reduce((s, x) => s + x.fee, 0);
  p.innerHTML = `
    <section class="welcome">
      <img src="/logo-warung-endog-yati.png" alt="Logo">
      <div><h1>Selamat Datang</h1><p>Mudah &bull; Cepat &bull; Aman &bull; Offline</p></div>
    </section>
    <div class="grid">
      <button class="tile" data-nav="kasir">🧾<b>KASIR</b></button>
      <button class="tile" data-nav="atm">🏧<b>MINI ATM</b></button>
      <button class="tile" data-nav="digital">📱<b>PULSA &amp; DIGITAL</b></button>
      <button class="tile" data-nav="saldo">💳<b>SALDO LAYANAN</b></button>
      <button class="tile" data-nav="kas">💰<b>KAS MASUK/KELUAR</b></button>
      <button class="tile" data-nav="riwayat">📜<b>RIWAYAT</b></button>
      <button class="tile" data-nav="laporan">📊<b>LAPORAN</b></button>
      <button class="tile" data-nav="produk">📦<b>PRODUK</b></button>
      <button class="tile" data-nav="backup">☁️<b>BACKUP</b></button>
    </div>
    <div class="stats">
      <div>Kas Fisik<strong>${money(db.cash || 0)}</strong></div>
      <div>Total Penjualan<strong>${money(totalSales)}</strong></div>
      <div>Total Laba<strong>${money(totalLaba)}</strong></div>
    </div>
    <h3 class="section-title">Saldo Layanan</h3>
    <div class="account-list">
      ${db.accounts.map((a) => `<div class="account"><span>${esc(a.name)}</span><b>${money(a.balance)}</b></div>`).join('')}
    </div>
  `;
  p.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => render(b.dataset.nav)));
}

// ------------------------------------------------------------------ Kasir --

function cartTotal() {
  return cart.reduce((s, x) => s + x.price * x.qty, 0);
}

function pageKasir(p, db) {
  p.innerHTML = `
    <h2>Kasir</h2>
    ${
      db.products.length
        ? `<div class="quick-products">${db.products
            .map(
              (pr) =>
                `<button class="chip" data-quick="${pr.id}">${esc(pr.name)}<small>${money(pr.price)}${pr.stock ? ' &middot; stok ' + pr.stock : ''}</small></button>`
            )
            .join('')}</div>`
        : `<p class="note">Belum ada produk tersimpan. Anda tetap bisa input manual di bawah, atau tambah produk lewat menu Produk agar stok otomatis terpantau.</p>`
    }
    <form id="form-cart-item">
      <input name="name" placeholder="Nama produk" required>
      <div class="row2">
        <input name="price" type="number" min="0" step="1" placeholder="Harga jual" required>
        <input name="cost" type="number" min="0" step="1" placeholder="Harga modal" value="0">
      </div>
      <input name="qty" type="number" min="1" step="1" value="1" placeholder="Jumlah">
      <button type="submit">+ Tambah ke Keranjang</button>
    </form>
    <h3 class="section-title">Keranjang</h3>
    <div id="cart-list">
      ${
        cart.length
          ? cart
              .map(
                (it, i) =>
                  `<article><b>${esc(it.name)}</b> x${it.qty}<strong>${money(it.price * it.qty)}</strong><button class="link-danger" data-remove="${i}">Hapus</button></article>`
              )
              .join('')
          : '<p class="note">Keranjang kosong.</p>'
      }
    </div>
    <div class="cart-total">Total: <b>${money(cartTotal())}</b></div>
    <button id="btn-checkout" class="primary" ${cart.length ? '' : 'disabled'}>Selesaikan Transaksi</button>
  `;

  p.querySelectorAll('[data-quick]').forEach((b) =>
    b.addEventListener('click', () => {
      const pr = db.products.find((x) => x.id === b.dataset.quick);
      if (!pr) return;
      cart.push({ productId: pr.id, name: pr.name, price: pr.price, cost: pr.cost, qty: 1 });
      render('kasir');
    })
  );
  p.querySelector('#form-cart-item').addEventListener(
    'submit',
    tryAction((e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const name = f.get('name').trim();
      const price = Number(f.get('price'));
      const cost = Number(f.get('cost')) || 0;
      const qty = Number(f.get('qty')) || 1;
      if (!name) throw new AppError('Nama produk wajib diisi.');
      if (!(price > 0)) throw new AppError('Harga jual harus lebih dari 0.');
      if (!(qty > 0)) throw new AppError('Jumlah harus lebih dari 0.');
      cart.push({ productId: null, name, price, cost, qty });
      render('kasir');
    })
  );
  p.querySelectorAll('[data-remove]').forEach((b) =>
    b.addEventListener('click', () => {
      cart.splice(Number(b.dataset.remove), 1);
      render('kasir');
    })
  );
  const btn = p.querySelector('#btn-checkout');
  if (btn)
    btn.addEventListener(
      'click',
      tryAction(() => {
        recordSale(cart);
        cart = [];
        toast('Transaksi tersimpan.');
        render('kasir');
      })
    );
}

// --------------------------------------------------------------- Mini ATM --

function pageATM(p, db) {
  p.innerHTML = `
    <h2>Mini ATM</h2>
    <div class="account-list">
      ${db.accounts.map((a) => `<div class="account"><span>${esc(a.name)}</span><b>${money(a.balance)}</b></div>`).join('')}
    </div>
    <form id="form-atm">
      <select name="type">${ATM_TYPES.map((t) => `<option>${t}</option>`).join('')}</select>
      <select name="accountId">${db.accounts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>
      <div class="row2">
        <input name="amount" type="number" min="1" step="1" placeholder="Nominal pokok" required>
        <input name="fee" type="number" min="0" step="1" value="0" placeholder="Biaya/Admin">
      </div>
      <button type="submit" class="primary">Simpan Transaksi</button>
    </form>
    <p class="note">"Tarik Tunai" menambah saldo layanan &amp; mengurangi kas fisik. Jenis lain memakai saldo layanan (tidak boleh minus) dan menambah kas fisik. Biaya/admin selalu masuk sebagai kas &amp; laba tambahan.</p>
  `;
  p.querySelector('#form-atm').addEventListener(
    'submit',
    tryAction((e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      recordATM({ type: f.get('type'), accountId: f.get('accountId'), amount: f.get('amount'), fee: f.get('fee') });
      toast('Transaksi Mini ATM tersimpan.');
      render('atm');
    })
  );
}

// ----------------------------------------------------------- Saldo Layanan --

function pageSaldo(p, db) {
  p.innerHTML = `
    <h2>Saldo Layanan</h2>
    ${db.accounts
      .map(
        (a) => `
      <form data-topup="${a.id}">
        <b>${esc(a.name)}: ${money(a.balance)}</b>
        <div class="row2">
          <input name="amount" type="number" min="1" step="1" placeholder="Tambah saldo" required>
          <label class="checkbox"><input type="checkbox" name="fromCash" checked> Ambil dari kas</label>
        </div>
        <div class="row2">
          <button type="submit">Tambah Saldo</button>
          <button type="button" class="danger" data-del-account="${a.id}">Hapus Akun</button>
        </div>
      </form>`
      )
      .join('')}
    <form id="form-new-account">
      <input name="name" placeholder="Nama akun baru (mis. OVO, ShopeePay)" required>
      <button type="submit">+ Tambah Akun</button>
    </form>
  `;
  p.querySelectorAll('[data-topup]').forEach((form) =>
    form.addEventListener(
      'submit',
      tryAction((e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        topupAccount(form.dataset.topup, f.get('amount'), f.get('fromCash') === 'on');
        toast('Saldo diperbarui.');
        render('saldo');
      })
    )
  );
  p.querySelectorAll('[data-del-account]').forEach((b) =>
    b.addEventListener(
      'click',
      tryAction(() => {
        if (!confirm('Hapus akun ini?')) return;
        deleteAccount(b.dataset.delAccount);
        render('saldo');
      })
    )
  );
  p.querySelector('#form-new-account').addEventListener(
    'submit',
    tryAction((e) => {
      e.preventDefault();
      addAccount(new FormData(e.target).get('name'));
      render('saldo');
    })
  );
}

// -------------------------------------------------------------------- Kas --

function pageKas(p, db) {
  p.innerHTML = `
    <h2>Kas</h2>
    <h3>Saldo Kas Fisik: ${money(db.cash || 0)}</h3>
    <form id="form-cash">
      <select name="type"><option>Kas Masuk</option><option>Kas Keluar</option></select>
      <input name="amount" type="number" min="1" step="1" required placeholder="Nominal">
      <input name="note" placeholder="Keterangan (mis. modal awal, ambil pribadi)">
      <button type="submit" class="primary">Simpan</button>
    </form>
    <h3 class="section-title">Riwayat Kas Manual</h3>
    ${
      db.cashMoves.length
        ? [...db.cashMoves]
            .reverse()
            .map(
              (c) =>
                `<article><b>${c.type}</b>${c.note ? ' &mdash; ' + esc(c.note) : ''}<strong class="${c.type === 'Kas Masuk' ? 'in' : 'out'}">${c.type === 'Kas Masuk' ? '+' : '-'}${money(c.amount)}</strong><small>${fmtDateTime(c.date)}</small></article>`
            )
            .join('')
        : '<p class="note">Belum ada mutasi kas manual.</p>'
    }
  `;
  p.querySelector('#form-cash').addEventListener(
    'submit',
    tryAction((e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      recordCashMove({ type: f.get('type'), amount: f.get('amount'), note: f.get('note') });
      toast('Mutasi kas tersimpan.');
      render('kas');
    })
  );
}

// -------------------------------------------------------- Pulsa & Digital --

function pageDigital(p, db) {
  p.innerHTML = `
    <h2>Pulsa &amp; Digital</h2>
    <form id="form-digital">
      <input name="product" placeholder="Produk / Pulsa / Token / Paket Data" required>
      <input name="customer" placeholder="Nomor HP / ID Pelanggan (opsional)">
      <div class="row2">
        <input name="cost" type="number" min="0" step="1" placeholder="Harga modal" required>
        <input name="price" type="number" min="0" step="1" placeholder="Harga jual" required>
      </div>
      <button type="submit" class="primary">Simpan Transaksi</button>
    </form>
    <h3 class="section-title">Riwayat Digital</h3>
    ${
      db.digital.length
        ? [...db.digital]
            .reverse()
            .map(
              (d) =>
                `<article><b>${esc(d.product)}</b>${d.customer ? ' &mdash; ' + esc(d.customer) : ''}<strong>${money(d.price)}</strong><small>${fmtDateTime(d.date)} &middot; Laba ${money(d.laba)}</small></article>`
            )
            .join('')
        : '<p class="note">Belum ada transaksi digital.</p>'
    }
  `;
  p.querySelector('#form-digital').addEventListener(
    'submit',
    tryAction((e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      recordDigital({ product: f.get('product'), customer: f.get('customer'), cost: f.get('cost'), price: f.get('price') });
      toast('Transaksi digital tersimpan.');
      render('digital');
    })
  );
}

// ---------------------------------------------------------------- Riwayat --

function pageRiwayat(p, db) {
  const all = [
    ...db.sales.map((s) => ({ id: s.id, kind: 'sale', label: 'Kasir', desc: s.items.map((i) => `${i.name} x${i.qty}`).join(', '), amount: s.total, date: s.date })),
    ...db.atm.map((a) => ({ id: a.id, kind: 'atm', label: 'Mini ATM', desc: `${a.type} &mdash; ${a.accountName}`, amount: a.amount + a.fee, date: a.date })),
    ...db.digital.map((d) => ({ id: d.id, kind: 'digital', label: 'Digital', desc: d.product + (d.customer ? ' — ' + d.customer : ''), amount: d.price, date: d.date })),
    ...db.cashMoves.map((c) => ({ id: c.id, kind: 'cash', label: 'Kas', desc: c.type + (c.note ? ' — ' + c.note : ''), amount: c.amount, date: c.date })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  p.innerHTML = `
    <h2>Riwayat Transaksi</h2>
    ${
      all.length
        ? all
            .map(
              (x) => `
        <article>
          <b>${x.label}</b> &mdash; ${x.desc}
          <strong>${money(x.amount)}</strong>
          <small>${fmtDateTime(x.date)}</small>
          ${x.kind === 'sale' ? `<button class="link-danger" data-del-sale="${x.id}">Batalkan</button>` : ''}
        </article>`
            )
            .join('')
        : '<p class="note">Belum ada transaksi.</p>'
    }
  `;
  p.querySelectorAll('[data-del-sale]').forEach((b) =>
    b.addEventListener(
      'click',
      tryAction(() => {
        if (!confirm('Batalkan transaksi penjualan ini? Kas & stok akan dikembalikan.')) return;
        deleteSale(b.dataset.delSale);
        toast('Transaksi dibatalkan.');
        render('riwayat');
      })
    )
  );
}

// ----------------------------------------------------------------- Produk --

function pageProduk(p, db) {
  p.innerHTML = `
    <h2>Produk</h2>
    <form id="form-product">
      <input name="name" placeholder="Nama produk" required>
      <div class="row2">
        <input name="cost" type="number" min="0" step="1" placeholder="Modal" required>
        <input name="price" type="number" min="0" step="1" placeholder="Harga jual" required>
      </div>
      <input name="stock" type="number" min="0" step="1" value="0" placeholder="Stok awal (0 = tidak dipantau)">
      <button type="submit" class="primary">+ Tambah Produk</button>
    </form>
    ${
      db.products.length
        ? db.products
            .map(
              (x) =>
                `<article><b>${esc(x.name)}</b><strong>${money(x.price)}</strong><small>Modal ${money(x.cost)} &middot; Stok ${x.stock}</small><button class="link-danger" data-del-product="${x.id}">Hapus</button></article>`
            )
            .join('')
        : '<p class="note">Belum ada produk.</p>'
    }
  `;
  p.querySelector('#form-product').addEventListener(
    'submit',
    tryAction((e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      addProduct({ name: f.get('name'), cost: f.get('cost'), price: f.get('price'), stock: f.get('stock') });
      toast('Produk ditambahkan.');
      render('produk');
    })
  );
  p.querySelectorAll('[data-del-product]').forEach((b) =>
    b.addEventListener(
      'click',
      tryAction(() => {
        if (!confirm('Hapus produk ini?')) return;
        deleteProduct(b.dataset.delProduct);
        render('produk');
      })
    )
  );
}

// ---------------------------------------------------------------- Laporan --

function pageLaporan(p) {
  const range = rangeFor(laporanState.preset, laporanState.from, laporanState.to);
  const report = buildReport(range);
  p.innerHTML = `
    <h2>Laporan</h2>
    <div class="tabs">
      ${['hari', 'minggu', 'bulan', 'custom']
        .map((k) => `<button data-preset="${k}" class="${laporanState.preset === k ? 'active' : ''}">${{ hari: 'Hari Ini', minggu: 'Minggu Ini', bulan: 'Bulan Ini', custom: 'Custom' }[k]}</button>`)
        .join('')}
    </div>
    ${
      laporanState.preset === 'custom'
        ? `<div class="row2"><input id="from" type="date" value="${laporanState.from}"><input id="to" type="date" value="${laporanState.to}"></div>`
        : ''
    }
    <div class="report">
      <p>Total Penjualan <b>${money(report.totalPenjualan)}</b></p>
      <p>Modal Penjualan <b>${money(report.modalPenjualan)}</b></p>
      <p>Laba Penjualan <b>${money(report.labaPenjualan)}</b></p>
      <p>Pendapatan Digital <b>${money(report.totalDigital)}</b></p>
      <p>Laba Digital <b>${money(report.labaDigital)}</b></p>
      <p>Admin Mini ATM <b>${money(report.adminATM)}</b></p>
      <p>Kas Masuk Manual <b>${money(report.kasMasuk)}</b></p>
      <p>Kas Keluar Manual <b>${money(report.kasKeluar)}</b></p>
      <p class="total">Total Laba <b>${money(report.labaTotal)}</b></p>
      <p>Jumlah Transaksi <b>${report.jumlahTransaksi}</b></p>
      <p>Saldo Kas Saat Ini <b>${money(report.kasSaatIni)}</b></p>
    </div>
    <button id="btn-print" class="primary">🖨️ Cetak / Simpan PDF (A4)</button>
  `;
  p.querySelectorAll('[data-preset]').forEach((b) =>
    b.addEventListener('click', () => {
      laporanState.preset = b.dataset.preset;
      render('laporan');
    })
  );
  const fromEl = p.querySelector('#from');
  const toEl = p.querySelector('#to');
  if (fromEl) fromEl.addEventListener('change', () => { laporanState.from = fromEl.value; render('laporan'); });
  if (toEl) toEl.addEventListener('change', () => { laporanState.to = toEl.value; render('laporan'); });
  p.querySelector('#btn-print').addEventListener('click', () => printReport(report));
}

// ----------------------------------------------------------- Backup/Sync --

function pageBackup(p, db) {
  p.innerHTML = `
    <h2>Backup &amp; Restore</h2>
    <form id="form-shopname">
      <input name="shopName" value="${esc(db.shopName)}" placeholder="Nama toko">
      <button type="submit">Simpan Nama Toko</button>
    </form>
    <button id="btn-export" class="primary">⬇️ Export Backup (JSON)</button>
    <form id="form-import">
      <label class="note">Pilih file backup .json untuk dipulihkan:</label>
      <input type="file" name="file" accept=".json,application/json">
      <button type="submit">⬆️ Import / Restore</button>
    </form>
    <button id="btn-reset" class="danger">🗑️ Reset Seluruh Data</button>

    <h3 class="section-title">Sinkronisasi Cloud (Opsional)</h3>
    <p class="note">Hanya backup/restore data toko sendiri ke Cloudflare Worker Anda. Tidak pernah login atau menyimpan PIN/OTP/password DANA, SUPERBANK, Bank, atau OrderKuota.</p>
    <form id="form-sync">
      <input name="url" value="${esc(db.sync.url)}" placeholder="URL Worker (mis. https://xxx.workers.dev)">
      <input name="code" value="${esc(db.sync.code)}" placeholder="Kode Sinkronisasi (buat sendiri, rahasiakan)">
      <button type="submit">Simpan Pengaturan</button>
    </form>
    <div class="row2">
      <button id="btn-push">☁️⬆️ Simpan ke Cloud</button>
      <button id="btn-pull">☁️⬇️ Ambil dari Cloud</button>
    </div>
    <p class="note">${db.sync.lastSyncedAt ? 'Sinkron terakhir: ' + fmtDateTime(db.sync.lastSyncedAt) : 'Belum pernah sinkron.'}</p>
  `;

  p.querySelector('#form-shopname').addEventListener(
    'submit',
    tryAction((e) => {
      e.preventDefault();
      setShopName(new FormData(e.target).get('shopName'));
      toast('Nama toko diperbarui.');
      render('backup');
    })
  );

  p.querySelector('#btn-export').addEventListener('click', async () => {
    await saveBackupFile(exportData(), `backup-warung-endog-yati-${Date.now()}.json`);
  });

  p.querySelector('#form-import').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = new FormData(e.target).get('file');
    if (!file || !file.name) return toast('Pilih file backup dulu.', true);
    try {
      const text = await readFileAsText(file);
      importData(text);
      toast('Data berhasil dipulihkan.');
      render('backup');
    } catch (err) {
      toast(err.message || 'Gagal memulihkan backup.', true);
    }
  });

  p.querySelector('#btn-reset').addEventListener('click', () => {
    if (!confirm('Semua data akan dihapus permanen. Lanjutkan?')) return;
    if (!confirm('Yakin? Aksi ini tidak bisa dibatalkan.')) return;
    resetData();
    toast('Data direset.');
    render('dashboard');
  });

  p.querySelector('#form-sync').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    setSync({ url: f.get('url').trim(), code: f.get('code').trim() });
    toast('Pengaturan sinkronisasi disimpan.');
    render('backup');
  });

  p.querySelector('#btn-push').addEventListener('click', async () => {
    try {
      await pushToCloud();
      toast('Berhasil disimpan ke cloud.');
      render('backup');
    } catch (err) {
      toast(err.message, true);
    }
  });
  p.querySelector('#btn-pull').addEventListener('click', async () => {
    if (!confirm('Data lokal akan ditimpa dengan data dari cloud. Lanjutkan?')) return;
    try {
      await pullFromCloud();
      toast('Berhasil dipulihkan dari cloud.');
      render('backup');
    } catch (err) {
      toast(err.message, true);
    }
  });
}

// ------------------------------------------------------------------- Init --

export function initApp() {
  onChange(() => {
    if (activePage !== 'kasir') render(activePage); // kasir re-render sendiri agar keranjang tak hilang
  });
  render('dashboard');
  setupStatusBar();
  setupBackButton(getActivePage, render, 'dashboard');
}
