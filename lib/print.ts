import * as Print from 'expo-print';
import { ShiftSale, Nozzle, FuelProduct, BankAccount, ExpenseCoa } from './api';
import { DENOMS, BalancingResult, totalFromDenominations } from './api-cash-balancing';

// Versi ringkas dari "Laporan Harian Totalisator" web (fuel-sales.js printShift())
// — isi setara (rincian per nozzle, pembayaran, total) tapi tata letak lebih
// sederhana (bukan replikasi persis grouping per-dispenser/dual-meter/HPP web).
const METHOD_LABEL: Record<string, string> = { tunai: 'Tunai', edc: 'EDC', qris: 'QRIS', piutang: 'Piutang' };
const SHIFT_LABEL: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };

function fc(n: number) {
  return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
}
function fmtL(n: number) {
  return `${Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })} L`;
}
function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function printShiftReport(
  shift: ShiftSale,
  nozzles: Nozzle[],
  products: FuelProduct[],
  banks: BankAccount[],
  branchName: string,
  expenseCoaList: ExpenseCoa[] = [],
  balancing?: BalancingResult
) {
  const totalVolume = shift.details.reduce((a, d) => a + (Number(d.volume) || 0), 0);
  const totalSale = shift.details.reduce((a, d) => a + (Number(d.subtotal) || 0), 0);
  const totalPay = shift.payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const totalExpense = (shift.expenses || []).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const selisih = totalPay + totalExpense - totalSale;

  const rows = shift.details
    .map((d) => {
      const nz = nozzles.find((n) => n.id === d.nozzle_id);
      const prod = products.find((p) => p.id === d.product_id);
      return `<tr>
        <td>${nz?.nozzle_code || '-'} (M${d.selected_meter})</td>
        <td>${nz?.dispenser_code || '-'}</td>
        <td>${prod?.product_name || '-'}</td>
        <td class="num">${fmtL(d.volume)}</td>
        <td class="num">${fc(d.unit_price)}</td>
        <td class="num">${fc(d.subtotal)}</td>
      </tr>`;
    })
    .join('');

  const payRows = shift.payments
    .map((p) => {
      const bank = banks.find((b) => b.id === p.bank_coa_id);
      return `<tr>
        <td>${METHOD_LABEL[p.method] || p.method}${bank ? ` — ${bank.account_name}` : ''}</td>
        <td class="num">${fc(p.amount)}</td>
      </tr>`;
    })
    .join('');

  const expenseRows = (shift.expenses || [])
    .map((e) => {
      const coa = expenseCoaList.find((c) => c.id === e.expense_coa_id);
      return `<tr>
        <td>${coa ? esc(coa.account_name) : '—'}${e.notes ? ` — ${esc(e.notes)}` : ''}</td>
        <td class="num">${fc(e.amount)}</td>
      </tr>`;
    })
    .join('');

  const html = `
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 28px; color: #1e293b; }
        h1 { font-size: 17px; margin: 0 0 2px; }
        .sub { font-size: 11.5px; color: #64748b; margin-bottom: 18px; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
        th, td { border: 1px solid #e2e8f0; padding: 6px 8px; font-size: 10.5px; }
        th { background: #f1f5f9; text-align: left; }
        .num { text-align: right; font-family: monospace; }
        tfoot td { font-weight: bold; background: #f8fafc; }
        .status { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: bold; background: #d1fae5; color: #047857; }
      </style>
    </head>
    <body>
      <h1>Laporan Penjualan Shift</h1>
      <div class="sub">
        ${branchName} · <strong>${shift.shift_number}</strong> <span class="status">${shift.status === 'posted' ? 'Posted' : shift.status === 'void' ? 'Void' : 'Draft'}</span><br/>
        Shift ${SHIFT_LABEL[shift.shift_type] || shift.shift_type} · ${new Date(shift.shift_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}<br/>
        Operator: ${esc(shift.operator_name)}
      </div>

      <table>
        <thead>
          <tr><th>Nozzle</th><th>Dispenser</th><th>Produk</th><th>Volume</th><th>Harga/L</th><th>Subtotal</th></tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td colspan="3">Total</td><td class="num">${fmtL(totalVolume)}</td><td></td><td class="num">${fc(totalSale)}</td></tr>
        </tfoot>
      </table>

      <table>
        <thead><tr><th>Metode Pembayaran</th><th>Jumlah</th></tr></thead>
        <tbody>${payRows}</tbody>
        <tfoot>
          <tr><td>Total Setoran</td><td class="num">${fc(totalPay)}</td></tr>
        </tfoot>
      </table>

      ${expenseRows ? `
      <table>
        <thead><tr><th>Pengeluaran Langsung</th><th>Jumlah</th></tr></thead>
        <tbody>${expenseRows}</tbody>
        <tfoot>
          <tr><td>Total Pengeluaran Langsung</td><td class="num">${fc(totalExpense)}</td></tr>
        </tfoot>
      </table>` : ''}

      <table>
        <tfoot>
          <tr><td>${selisih >= 0 ? 'Lebih Setor' : 'Kurang Setor'} (Setoran + Pengeluaran − Penjualan)</td><td class="num">${fc(Math.abs(selisih))}</td></tr>
        </tfoot>
      </table>

      ${shift.notes ? `<div class="sub">Catatan: ${esc(shift.notes)}</div>` : ''}

      ${balancing ? buildBalancingHTML(shift, balancing) : ''}
    </body>
    </html>
  `;

  await Print.printAsync({ html });
}

function buildBalancingHTML(shift: ShiftSale, balancing: BalancingResult): string {
  const saved = shift.cash_denominations || {};
  const totalHitung = totalFromDenominations(saved);
  const selisih = totalHitung - balancing.netSetoran;
  const hasCount = Object.keys(saved).length > 0;

  const rows = [
    ...balancing.debitRows.map((r) => ({ label: r.label, debit: r.amount, kredit: 0 })),
    ...balancing.kreditRows.map((r) => ({ label: r.label, debit: 0, kredit: r.amount })),
  ];

  return `
    <div style="page-break-before: always; padding-top: 8px;">
      <h1>Laporan Balancing Setoran Operator</h1>
      <table>
        <thead><tr><th>Keterangan / Uraian</th><th>Debit</th><th>Kredit</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="num">${r.debit ? fc(r.debit) : 0}</td><td class="num">${r.kredit ? fc(r.kredit) : 0}</td></tr>`).join('')}
        </tbody>
        <tfoot>
          <tr><td>Total Mutasi / Sub Total</td><td class="num">${fc(balancing.totalDebit)}</td><td class="num">${fc(balancing.totalKredit)}</td></tr>
          <tr><td colspan="2">Total Setoran Operator (Net)</td><td class="num">${fc(balancing.netSetoran)}</td></tr>
        </tfoot>
      </table>

      <table>
        <thead><tr><th>Pecahan Uang</th><th>Jumlah</th><th>Jumlah (Rp)</th></tr></thead>
        <tbody>
          ${DENOMS.map((d) => `<tr><td>${d.label}</td><td class="num">${saved[d.key] ?? ''}</td><td class="num">${saved[d.key] ? fc((Number(saved[d.key]) || 0) * d.value) : ''}</td></tr>`).join('')}
        </tbody>
        <tfoot>
          <tr><td colspan="2">Total Hitungan Fisik</td><td class="num">${fc(totalHitung)}</td></tr>
          ${hasCount ? `<tr><td colspan="2">Selisih (Lebih/Kurang Uang Teller)</td><td class="num">${fc(selisih)}</td></tr>` : ''}
        </tfoot>
      </table>
    </div>
  `;
}
