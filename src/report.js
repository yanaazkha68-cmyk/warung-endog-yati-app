// Perhitungan laporan (harian/mingguan/bulanan/custom) + cetak A4.
// Cetak dilakukan lewat area tersembunyi di halaman yang sama (bukan
// window.open popup) supaya tetap jalan di dalam WebView Android/Capacitor,
// yang sering memblokir popup baru.

import { getDB } from './store.js';
import { money, fmtDateTime, fmtDate, startOfDay, endOfDay, startOfWeek, startOfMonth } from './format.js';

export function rangeFor(preset, fromStr, toStr) {
  const now = new Date();
  if (preset === 'hari') return { from: startOfDay(now), to: endOfDay(now), label: 'Hari Ini' };
  if (preset === 'minggu') return { from: startOfWeek(now), to: endOfDay(now), label: 'Minggu Ini' };
  if (preset === 'bulan') return { from: startOfMonth(now), to: endOfDay(now), label: 'Bulan Ini' };
  const from = fromStr ? startOfDay(new Date(fromStr)) : new Date(0);
  const to = toStr ? endOfDay(new Date(toStr)) : endOfDay(now);
  return { from, to, label: 'Custom' };
}

function within(iso, from, to) {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export function buildReport(range) {
  const db = getDB();
  const { from, to } = range;
  const sales = db.sales.filter((s) => within(s.date, from, to));
  const atm = db.atm.filter((a) => within(a.date, from, to));
  const digital = db.digital.filter((d) => within(d.date, from, to));
  const cashMoves = db.cashMoves.filter((c) => within(c.date, from, to));

  const totalPenjualan = sales.reduce((s, x) => s + x.total, 0);
  const modalPenjualan = sales.reduce((s, x) => s + x.modal, 0);
  const labaPenjualan = totalPenjualan - modalPenjualan;

  const totalDigital = digital.reduce((s, x) => s + x.price, 0);
  const modalDigital = digital.reduce((s, x) => s + x.cost, 0);
  const labaDigital = totalDigital - modalDigital;

  const adminATM = atm.reduce((s, x) => s + x.fee, 0);
  const nominalATM = atm.reduce((s, x) => s + x.amount, 0);

  const kasMasuk = cashMoves.filter((c) => c.type === 'Kas Masuk').reduce((s, x) => s + x.amount, 0);
  const kasKeluar = cashMoves.filter((c) => c.type === 'Kas Keluar').reduce((s, x) => s + x.amount, 0);

  const labaTotal = labaPenjualan + labaDigital + adminATM;

  return {
    range,
    sales,
    atm,
    digital,
    cashMoves,
    totalPenjualan,
    modalPenjualan,
    labaPenjualan,
    totalDigital,
    modalDigital,
    labaDigital,
    adminATM,
    nominalATM,
    kasMasuk,
    kasKeluar,
    labaTotal,
    jumlahTransaksi: sales.length + atm.length + digital.length + cashMoves.length,
    kasSaatIni: db.cash || 0,
    accounts: db.accounts,
    shopName: db.shopName,
  };
}

function rowsTable(title, arr, mapper) {
  if (!arr.length) return '';
  return `<h3>${title}</h3><table><tbody>${arr.map(mapper).join('')}</tbody></table>`;
}

export function reportHTML(report) {
  const { range } = report;
  return `
  <h1>${report.shopName}</h1>
  <div class="p-sub">Laporan periode ${range.label}: ${fmtDate(range.from)} &mdash; ${fmtDate(range.to)}</div>
  <div class="p-sub">Dicetak: ${fmtDateTime(new Date().toISOString())}</div>
  <div class="p-summary">
    <div><span>Total Penjualan</span><b>${money(report.totalPenjualan)}</b></div>
    <div><span>Modal Penjualan</span><b>${money(report.modalPenjualan)}</b></div>
    <div><span>Laba Penjualan</span><b>${money(report.labaPenjualan)}</b></div>
    <div><span>Pendapatan Digital</span><b>${money(report.totalDigital)}</b></div>
    <div><span>Modal Digital</span><b>${money(report.modalDigital)}</b></div>
    <div><span>Laba Digital</span><b>${money(report.labaDigital)}</b></div>
    <div><span>Admin Mini ATM</span><b>${money(report.adminATM)}</b></div>
    <div><span>Nominal Mini ATM</span><b>${money(report.nominalATM)}</b></div>
    <div><span>Kas Masuk Manual</span><b>${money(report.kasMasuk)}</b></div>
    <div><span>Kas Keluar Manual</span><b>${money(report.kasKeluar)}</b></div>
    <div><span><b>Total Laba (Penjualan + Digital + Admin)</b></span><b>${money(report.labaTotal)}</b></div>
    <div><span>Jumlah Transaksi</span><b>${report.jumlahTransaksi}</b></div>
    <div><span><b>Saldo Kas Fisik Saat Ini</b></span><b>${money(report.kasSaatIni)}</b></div>
  </div>
  <h3>Saldo Layanan (per hari ini)</h3>
  <table><tbody>${report.accounts.map((a) => `<tr><td>${a.name}</td><td class="p-num">${money(a.balance)}</td></tr>`).join('')}</tbody></table>
  ${rowsTable(
    'Rincian Penjualan (Kasir)',
    report.sales,
    (s) =>
      `<tr><td>${fmtDateTime(s.date)}</td><td>${s.items.map((i) => `${i.name} x${i.qty}`).join(', ')}</td><td class="p-num">${money(s.total)}</td><td class="p-num">Laba ${money(s.laba)}</td></tr>`
  )}
  ${rowsTable(
    'Rincian Mini ATM',
    report.atm,
    (a) =>
      `<tr><td>${fmtDateTime(a.date)}</td><td>${a.type} &mdash; ${a.accountName}</td><td class="p-num">${money(a.amount)}</td><td class="p-num">Admin ${money(a.fee)}</td></tr>`
  )}
  ${rowsTable(
    'Rincian Pulsa & Digital',
    report.digital,
    (d) =>
      `<tr><td>${fmtDateTime(d.date)}</td><td>${d.product}${d.customer ? ' &mdash; ' + d.customer : ''}</td><td class="p-num">${money(d.price)}</td><td class="p-num">Laba ${money(d.laba)}</td></tr>`
  )}
  ${rowsTable(
    'Rincian Kas Manual',
    report.cashMoves,
    (c) =>
      `<tr><td>${fmtDateTime(c.date)}</td><td>${c.type}${c.note ? ' &mdash; ' + c.note : ''}</td><td class="p-num">${money(c.amount)}</td><td></td></tr>`
  )}
  `;
}

export function printReport(report) {
  let area = document.getElementById('print-area');
  if (!area) {
    area = document.createElement('div');
    area.id = 'print-area';
    document.body.appendChild(area);
  }
  area.innerHTML = reportHTML(report);
  // requestAnimationFrame agar konten sempat ter-render sebelum dialog cetak dipanggil
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}
