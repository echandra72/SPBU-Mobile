import { ShiftSale, Nozzle, FuelProduct, BankAccount, ExpenseCoa } from './api';
import { DENOMS, BalancingResult } from './api-cash-balancing';

// Format struk 80mm untuk printer thermal ESC/POS (lib/thermal-printer.ts).
// LINE_WIDTH = jumlah karakter per baris pada font default printer — 32
// adalah nilai konservatif yang cocok untuk sebagian besar printer 80mm
// murah (font besar/Font B). Kalau printer Pak Edy pakai font kecil (Font A,
// muat ~42-48 karakter), naikkan angka ini saja, tidak perlu ubah logic lain.
const LINE_WIDTH = 32;

const SHIFT_LABEL: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };
const METHOD_LABEL: Record<string, string> = { tunai: 'Tunai', edc: 'EDC', qris: 'QRIS', piutang: 'Piutang' };

function fc(n: number) {
  return Math.round(n || 0).toLocaleString('id-ID');
}
function fmtL(n: number) {
  return `${Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })}L`;
}

// Rata kiri di satu sisi, rata kanan di sisi lain — dipotong kalau kepanjangan.
function twoCol(left: string, right: string, width = LINE_WIDTH): string {
  const r = right.slice(0, width);
  const maxLeft = width - r.length - 1;
  const l = left.length > maxLeft ? left.slice(0, Math.max(0, maxLeft - 1)) + '.' : left;
  const gap = width - l.length - r.length;
  return l + ' '.repeat(Math.max(1, gap)) + r;
}
function sep(width = LINE_WIDTH): string {
  return '-'.repeat(width);
}

// Laporan Harian Penjualan BBM & Setoran Operator — versi ringkas untuk
// struk 80mm (bukan replikasi A4 lengkap web: tanpa tabel ringkasan operator
// multi-kolom, cuma per-nozzle + total + pembayaran + pengeluaran + selisih).
export function buildDailySalesReceipt(
  shift: ShiftSale,
  nozzles: Nozzle[],
  products: FuelProduct[],
  banks: BankAccount[],
  branchName: string,
  expenseCoaList: ExpenseCoa[] = []
): string {
  const totalVolume = shift.details.reduce((a, d) => a + (Number(d.volume) || 0), 0);
  const totalSale = shift.details.reduce((a, d) => a + (Number(d.subtotal) || 0), 0);
  const totalPay = shift.payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const totalExpense = (shift.expenses || []).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const selisih = totalPay + totalExpense - totalSale;

  const lines: string[] = [];
  lines.push('<CB>LAPORAN PENJUALAN SHIFT</CB>');
  lines.push(`<C>${branchName}</C>`);
  lines.push(sep());
  lines.push(`No: ${shift.shift_number}`);
  lines.push(`${new Date(shift.shift_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}  Shift ${SHIFT_LABEL[shift.shift_type] || shift.shift_type}`);
  lines.push(`Operator: ${shift.operator_name}`);
  lines.push(sep());

  lines.push('<B>RINCIAN NOZZLE</B>');
  shift.details.forEach((d) => {
    const nz = nozzles.find((n) => n.id === d.nozzle_id);
    const prod = products.find((p) => p.id === d.product_id);
    lines.push(`${nz?.nozzle_code || '-'} ${prod?.product_name || '-'}`);
    lines.push(twoCol(`${fmtL(d.volume)} x ${fc(d.unit_price)}`, fc(d.subtotal)));
  });
  lines.push(sep());
  lines.push(twoCol('TOTAL PENJUALAN', fc(totalSale)));
  lines.push(sep());

  lines.push('<B>PEMBAYARAN</B>');
  shift.payments.forEach((p) => {
    const bank = banks.find((b) => b.id === p.bank_coa_id);
    lines.push(twoCol(`${METHOD_LABEL[p.method] || p.method}${bank ? ' ' + bank.account_code : ''}`, fc(p.amount)));
  });
  lines.push(twoCol('TOTAL SETORAN', fc(totalPay)));

  if ((shift.expenses || []).length) {
    lines.push(sep());
    lines.push('<B>PENGELUARAN LANGSUNG</B>');
    shift.expenses.forEach((e) => {
      const coa = expenseCoaList.find((c) => c.id === e.expense_coa_id);
      lines.push(twoCol(coa ? coa.account_name : '-', fc(e.amount)));
    });
    lines.push(twoCol('TOTAL PENGELUARAN', fc(totalExpense)));
  }

  lines.push(sep());
  lines.push(twoCol(selisih >= 0 ? 'LEBIH SETOR' : 'KURANG SETOR', fc(Math.abs(selisih))));
  if (shift.notes) {
    lines.push(sep());
    lines.push(`Catatan: ${shift.notes}`);
  }
  lines.push(sep());
  lines.push(`<C>${new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</C>`);
  lines.push('\n\n');

  return lines.join('\n');
}

// Laporan Balancing Setoran Operator — struk 80mm, TERPISAH (cut sendiri)
// dari struk Rincian Uang Tunai (buildCashCountReceipt), sama seperti
// halaman terpisah di web (rpt-cash-count page-break).
export function buildCashBalancingReceipt(shift: ShiftSale, branchName: string, balancing: BalancingResult): string {
  const lines: string[] = [];
  lines.push('<CB>LAPORAN BALANCING</CB>');
  lines.push('<CB>SETORAN OPERATOR</CB>');
  lines.push(`<C>${branchName}</C>`);
  lines.push(sep());
  lines.push(`No: ${shift.shift_number}`);
  lines.push(`${new Date(shift.shift_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}  Shift ${SHIFT_LABEL[shift.shift_type] || shift.shift_type}`);
  lines.push(sep());

  lines.push('<B>DEBIT</B>');
  balancing.debitRows.forEach((r) => lines.push(twoCol(r.label, fc(r.amount))));
  lines.push(twoCol('Total Debit', fc(balancing.totalDebit)));
  lines.push(sep());

  lines.push('<B>KREDIT</B>');
  balancing.kreditRows.forEach((r) => lines.push(twoCol(r.label, fc(r.amount))));
  lines.push(twoCol('Total Kredit', fc(balancing.totalKredit)));
  lines.push(sep());

  lines.push('<B>' + twoCol('NET SETORAN', fc(balancing.netSetoran)) + '</B>');
  lines.push(sep());
  lines.push(`<C>${new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</C>`);
  lines.push('\n\n');

  return lines.join('\n');
}

// Rincian Uang Tunai — struk 80mm terpisah, dicetak setelah Laporan
// Balancing (cut sendiri di antara keduanya, mirip 2 halaman terpisah di web).
export function buildCashCountReceipt(shift: ShiftSale, branchName: string, balancing: BalancingResult, denomText: Record<string, string>): string {
  const totalHitung = DENOMS.reduce((a, d) => a + (parseFloat(denomText[d.key]) || 0) * d.value, 0);
  const selisih = totalHitung - balancing.netSetoran;

  const lines: string[] = [];
  lines.push('<CB>RINCIAN UANG TUNAI</CB>');
  lines.push(`<C>${branchName}</C>`);
  lines.push(sep());
  lines.push(`No: ${shift.shift_number}`);
  lines.push(`${new Date(shift.shift_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}  Shift ${SHIFT_LABEL[shift.shift_type] || shift.shift_type}`);
  lines.push(sep());

  DENOMS.forEach((d) => {
    const qty = parseFloat(denomText[d.key]) || 0;
    if (qty > 0) lines.push(twoCol(`${d.label} x${qty}`, fc(qty * d.value)));
  });
  lines.push(sep());
  lines.push(twoCol('Total Hitungan Fisik', fc(totalHitung)));
  lines.push(twoCol('Net Setoran', fc(balancing.netSetoran)));
  lines.push('<B>' + twoCol('Selisih', fc(selisih)) + '</B>');
  lines.push(sep());
  lines.push(`<C>${new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</C>`);
  lines.push('\n\n');

  return lines.join('\n');
}
