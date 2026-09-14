// Lapisan data & logika akuntansi Warung Endog Yati.
// Semua aturan pembukuan (saldo layanan tidak boleh minus, pokok vs admin,
// kas fisik vs saldo layanan sebagai akun terpisah, setiap mutasi bertanggal
// & berjam) hidup di sini, TERPISAH dari kode tampilan (ui.js).

import { nowISO, uid } from './format.js';

const STORAGE_KEY = 'wey-db-v3';

const DEFAULT_ACCOUNTS = [
  { id: 'dana', name: 'DANA', balance: 0 },
  { id: 'superbank', name: 'SUPERBANK', balance: 0 },
  { id: 'bank', name: 'Bank', balance: 0 },
  { id: 'miniatm', name: 'Saldo Mini ATM', balance: 0 },
];

// Jenis transaksi Mini ATM yang membuat saldo layanan BERTAMBAH
// (agen menerima dana dari nasabah ke akun sendiri, lalu memberi tunai).
// Jenis lain membuat saldo layanan BERKURANG (agen memakai saldo sendiri
// untuk melayani nasabah yang membayar tunai).
export const ATM_TYPES_SALDO_MASUK = ['Tarik Tunai'];
export const ATM_TYPES = ['Tarik Tunai', 'Setor Tunai', 'Transfer', 'Top Up E-Wallet', 'Pembayaran/PPOB'];

export class AppError extends Error {}

function emptyDB() {
  return {
    version: 3,
    shopName: 'Warung Endog Yati',
    createdAt: nowISO(),
    cash: 0,
    products: [],
    accounts: structuredClone(DEFAULT_ACCOUNTS),
    sales: [],
    atm: [],
    digital: [],
    cashMoves: [],
    sync: { url: '', code: '', lastSyncedAt: null },
  };
}

// Migrasi dari skema lama (prototipe v2 tanpa field "version") supaya data
// yang mungkin sudah sempat dipakai pengguna tidak hilang.
function migrate(raw) {
  const base = emptyDB();
  if (!raw || typeof raw !== 'object') return base;
  if (!raw.version) {
    return {
      ...base,
      cash: Number(raw.cash) || 0,
      products: Array.isArray(raw.products) ? raw.products : [],
      accounts: Array.isArray(raw.accounts) && raw.accounts.length ? raw.accounts : base.accounts,
      sales: Array.isArray(raw.sales)
        ? raw.sales.map((s) => ('items' in s ? s : { id: uid(), items: [{ name: s.name, price: s.price, cost: s.cost, qty: s.qty }], total: s.total, modal: (s.cost || 0) * (s.qty || 1), laba: s.total - (s.cost || 0) * (s.qty || 1), date: s.date || nowISO() }))
        : [],
      atm: Array.isArray(raw.atm) ? raw.atm : [],
      digital: Array.isArray(raw.digital) ? raw.digital : [],
      cashMoves: Array.isArray(raw.cashMoves) ? raw.cashMoves : [],
    };
  }
  return {
    ...base,
    ...raw,
    sync: { ...base.sync, ...(raw.sync || {}) },
  };
}

let db = migrate(safeParse(localStorage.getItem(STORAGE_KEY)));

function safeParse(s) {
  try {
    return JSON.parse(s || 'null');
  } catch {
    return null;
  }
}

const listeners = new Set();
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  listeners.forEach((fn) => fn(db));
}

export function getDB() {
  return db;
}

// ---------------------------------------------------------------- Produk --

export function addProduct({ name, cost, price, stock }) {
  name = (name || '').trim();
  cost = Number(cost) || 0;
  price = Number(price) || 0;
  stock = Number(stock) || 0;
  if (!name) throw new AppError('Nama produk wajib diisi.');
  if (price <= 0) throw new AppError('Harga jual harus lebih dari 0.');
  if (cost < 0 || stock < 0) throw new AppError('Modal dan stok tidak boleh minus.');
  db.products.push({ id: uid(), name, cost, price, stock, createdAt: nowISO() });
  save();
}

export function updateProduct(id, patch) {
  const p = db.products.find((x) => x.id === id);
  if (!p) throw new AppError('Produk tidak ditemukan.');
  if (patch.name != null) p.name = String(patch.name).trim() || p.name;
  if (patch.cost != null) p.cost = Math.max(0, Number(patch.cost) || 0);
  if (patch.price != null) p.price = Math.max(0, Number(patch.price) || 0);
  if (patch.stock != null) p.stock = Math.max(0, Number(patch.stock) || 0);
  save();
}

export function deleteProduct(id) {
  db.products = db.products.filter((p) => p.id !== id);
  save();
}

// -------------------------------------------------------------- Kasir --

/**
 * items: [{ productId?: string, name, price, cost, qty }]
 * Produk dengan stok terdaftar (stock > 0 saat ditambahkan pertama kali)
 * divalidasi & dipotong stoknya. Item manual (tanpa productId) tidak
 * memengaruhi stok, untuk transaksi cepat di luar katalog.
 */
export function recordSale(items) {
  if (!items || !items.length) throw new AppError('Keranjang masih kosong.');
  for (const it of items) {
    const qty = Number(it.qty) || 0;
    if (qty <= 0) throw new AppError('Jumlah item harus lebih dari 0.');
    if (it.productId) {
      const p = db.products.find((x) => x.id === it.productId);
      if (p && p.stock > 0 && p.stock < qty) {
        throw new AppError(`Stok "${p.name}" tidak cukup (sisa ${p.stock}).`);
      }
    }
  }
  let total = 0;
  let modal = 0;
  const cleanItems = items.map((it) => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.price) || 0;
    const cost = Number(it.cost) || 0;
    total += price * qty;
    modal += cost * qty;
    return { productId: it.productId || null, name: it.name, price, cost, qty };
  });
  const sale = { id: uid(), items: cleanItems, total, modal, laba: total - modal, date: nowISO() };
  db.sales.push(sale);
  for (const it of cleanItems) {
    if (it.productId) {
      const p = db.products.find((x) => x.id === it.productId);
      if (p) p.stock = Math.max(0, p.stock - it.qty);
    }
  }
  db.cash = (db.cash || 0) + total;
  save();
  return sale;
}

export function deleteSale(id) {
  const idx = db.sales.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const sale = db.sales[idx];
  // Kembalikan kas & stok agar pembukuan tetap konsisten saat transaksi salah input dibatalkan.
  db.cash = (db.cash || 0) - sale.total;
  for (const it of sale.items) {
    if (it.productId) {
      const p = db.products.find((x) => x.id === it.productId);
      if (p) p.stock += it.qty;
    }
  }
  db.sales.splice(idx, 1);
  save();
}

// ------------------------------------------------------------ Mini ATM --

export function recordATM({ type, accountId, amount, fee }) {
  const acc = db.accounts.find((a) => a.id === accountId);
  if (!acc) throw new AppError('Pilih akun saldo layanan.');
  amount = Number(amount) || 0;
  fee = Number(fee) || 0;
  if (amount <= 0) throw new AppError('Nominal pokok harus lebih dari 0.');
  if (fee < 0) throw new AppError('Biaya/admin tidak boleh minus.');

  if (ATM_TYPES_SALDO_MASUK.includes(type)) {
    // Nasabah menitipkan dana ke akun agen, agen memberi tunai dari kas fisik.
    if ((db.cash || 0) < amount) {
      throw new AppError('Kas fisik tidak cukup untuk menyerahkan tunai transaksi ini.');
    }
    acc.balance += amount;
    db.cash = db.cash - amount + fee;
  } else {
    // Agen memakai saldo layanan sendiri untuk melayani nasabah yang membayar tunai.
    if (acc.balance < amount) {
      throw new AppError(`Saldo ${acc.name} tidak cukup (sisa ${acc.balance}). Saldo layanan tidak boleh minus.`);
    }
    acc.balance -= amount;
    db.cash = (db.cash || 0) + amount + fee;
  }
  db.atm.push({ id: uid(), type, accountId: acc.id, accountName: acc.name, amount, fee, date: nowISO() });
  save();
}

// -------------------------------------------------------- Saldo Layanan --

export function addAccount(name) {
  name = (name || '').trim();
  if (!name) throw new AppError('Nama akun wajib diisi.');
  db.accounts.push({ id: uid(), name, balance: 0 });
  save();
}

export function deleteAccount(id) {
  const acc = db.accounts.find((a) => a.id === id);
  if (acc && acc.balance !== 0) {
    throw new AppError('Kosongkan saldo akun ini dulu sebelum dihapus.');
  }
  db.accounts = db.accounts.filter((a) => a.id !== id);
  save();
}

export function topupAccount(accountId, amount, fromCash) {
  const acc = db.accounts.find((a) => a.id === accountId);
  if (!acc) throw new AppError('Akun tidak ditemukan.');
  amount = Number(amount) || 0;
  if (amount <= 0) throw new AppError('Nominal harus lebih dari 0.');
  if (fromCash) {
    if ((db.cash || 0) < amount) throw new AppError('Kas fisik tidak cukup.');
    db.cash -= amount;
  }
  acc.balance += amount;
  save();
}

// ------------------------------------------------------------- Kas --

export function recordCashMove({ type, amount, note }) {
  amount = Number(amount) || 0;
  if (amount <= 0) throw new AppError('Nominal harus lebih dari 0.');
  const masuk = type === 'Kas Masuk';
  if (!masuk && (db.cash || 0) < amount) throw new AppError('Kas fisik tidak cukup.');
  db.cash = (db.cash || 0) + (masuk ? amount : -amount);
  db.cashMoves.push({ id: uid(), type, amount, note: (note || '').trim(), date: nowISO() });
  save();
}

// --------------------------------------------------------- Pulsa & Digital --

export function recordDigital({ product, customer, cost, price }) {
  product = (product || '').trim();
  cost = Number(cost) || 0;
  price = Number(price) || 0;
  if (!product) throw new AppError('Nama produk/paket wajib diisi.');
  if (price <= 0) throw new AppError('Harga jual harus lebih dari 0.');
  if (cost < 0) throw new AppError('Harga modal tidak boleh minus.');
  const laba = price - cost;
  db.digital.push({ id: uid(), product, customer: (customer || '').trim(), cost, price, laba, date: nowISO() });
  db.cash = (db.cash || 0) + price;
  save();
}

// ------------------------------------------------------- Backup & Restore --

export function exportData() {
  return JSON.stringify(db, null, 2);
}

export function importData(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new AppError('File backup bukan JSON yang valid.');
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sales)) {
    throw new AppError('Struktur backup tidak dikenali.');
  }
  db = migrate(parsed);
  save();
}

export function resetData() {
  db = emptyDB();
  save();
}

export function setSync(patch) {
  db.sync = { ...db.sync, ...patch };
  save();
}

export function setShopName(name) {
  name = (name || '').trim();
  if (name) db.shopName = name;
  save();
}
