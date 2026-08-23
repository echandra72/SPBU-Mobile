import { supabase } from './supabase';
import { ShiftSale, Nozzle, FuelProduct, FuelPrice, ExpenseCoa } from './api';

// ================================================================
// Laporan Balancing Kas (Setoran Operator) — port dari calcCashBalancing()
// di pages/spbu/fuel-sales.js (web). Debit = penjualan per dispenser,
// Kredit = semua yang mengurangi kas tunai (Piutang, EDC/QRIS/e-wallet,
// E-BBM Polres, Test Nozzle/Tera, Pengeluaran Langsung+Susulan) — semuanya
// sudah berjurnal di modul masing-masing, di sini cuma direkap.
// ================================================================

export const DENOMS = [
  { key: '100000', label: 'Rp 100.000,-', value: 100000 },
  { key: '75000', label: 'Rp 75.000,-', value: 75000 },
  { key: '50000', label: 'Rp 50.000,-', value: 50000 },
  { key: '20000', label: 'Rp 20.000,-', value: 20000 },
  { key: '10000', label: 'Rp 10.000,-', value: 10000 },
  { key: '5000', label: 'Rp 5.000,-', value: 5000 },
  { key: '2000', label: 'Rp 2.000,-', value: 2000 },
  { key: '1000k', label: 'Rp 1.000,-', value: 1000 },
  { key: '1000l', label: 'Rp 1.000,- (logam)', value: 1000 },
  { key: '500l', label: 'Rp 500,- (logam)', value: 500 },
  { key: '200l', label: 'Rp 200,- (logam)', value: 200 },
  { key: '100l', label: 'Rp 100,- (logam)', value: 100 },
];

export type BalancingRow = { label: string; amount: number };
export type BalancingResult = {
  debitRows: BalancingRow[];
  kreditRows: BalancingRow[];
  totalDebit: number;
  totalKredit: number;
  netSetoran: number;
};

type ReceivableRow = { total_amount: number; customer: { name: string } | null };
type EdcRow = { payment_type: string; amount: number };
type EbbmRow = { total_penjualan: number };
type TestNozzleRow = { nozzle_id: string; volume_test: number };
type EbbmSetting = { institution_name: string | null };

export type RelatedShiftData = {
  receivables: ReceivableRow[];
  edc: EdcRow[];
  ebbm: EbbmRow[];
  testNozzle: TestNozzleRow[];
  ebbmSetting: EbbmSetting | null;
};

export async function fetchRelatedShiftData(branchId: string, date: string, shiftType: string): Promise<RelatedShiftData> {
  const [rcv, edc, ebbm, tn, settings] = await Promise.all([
    supabase.from('t_spbu_receivables').select('total_amount, customer:customer_id(name)').eq('branch_id', branchId).eq('date', date).eq('shift_type', shiftType),
    supabase.from('t_spbu_edc').select('payment_type, amount').eq('branch_id', branchId).eq('date', date).eq('shift_type', shiftType),
    supabase.from('t_ebbm_voucher_usage').select('total_penjualan').eq('branch_id', branchId).eq('date', date).eq('shift_type', shiftType),
    supabase.from('t_spbu_test_nozzle').select('nozzle_id, volume_test').eq('branch_id', branchId).eq('test_date', date).eq('shift_type', shiftType),
    supabase.from('m_ebbm_settings').select('institution_name').eq('branch_id', branchId).maybeSingle(),
  ]);
  return {
    receivables: (rcv.data || []) as unknown as ReceivableRow[],
    edc: (edc.data || []) as EdcRow[],
    ebbm: (ebbm.data || []) as EbbmRow[],
    testNozzle: (tn.data || []) as TestNozzleRow[],
    ebbmSetting: (settings.data as EbbmSetting) || null,
  };
}

const PT_LABEL: Record<string, string> = { edc: 'EDC', linkaja: 'LinkAja', qris: 'QRIS' };

export function calcCashBalancing(
  shift: ShiftSale,
  nozzles: Nozzle[],
  products: FuelProduct[],
  fuelPrices: FuelPrice[],
  expenseCoaList: ExpenseCoa[],
  related: RelatedShiftData
): BalancingResult {
  // ── Debit: penjualan per dispenser
  const byDispenser: Record<string, number> = {};
  shift.details.forEach((d) => {
    const nz = nozzles.find((n) => n.id === d.nozzle_id);
    const code = nz?.dispenser_code || '-';
    byDispenser[code] = (byDispenser[code] || 0) + (Number(d.subtotal) || 0);
  });
  const debitRows: BalancingRow[] = Object.entries(byDispenser).map(([code, amount]) => ({
    label: `Penjualan Opr ${code}`,
    amount,
  }));
  const totalDebit = debitRows.reduce((a, r) => a + r.amount, 0);

  // ── Kredit: Piutang (per konsumen)
  const kreditRows: BalancingRow[] = [];
  const byCustomer: Record<string, number> = {};
  related.receivables.forEach((r) => {
    const name = r.customer?.name || 'Konsumen';
    byCustomer[name] = (byCustomer[name] || 0) + (Number(r.total_amount) || 0);
  });
  Object.entries(byCustomer).forEach(([name, amount]) => kreditRows.push({ label: `Nota/Voucher BBM ${name}`, amount }));

  // ── Kredit: EDC/QRIS/e-wallet (per jenis)
  const byType: Record<string, number> = {};
  related.edc.forEach((e) => {
    const lbl = PT_LABEL[e.payment_type] || 'Non-Tunai';
    byType[lbl] = (byType[lbl] || 0) + (Number(e.amount) || 0);
  });
  Object.entries(byType).forEach(([lbl, amount]) => kreditRows.push({ label: lbl, amount }));

  // ── Kredit: E-BBM Polres (1 baris)
  if (related.ebbm.length) {
    const total = related.ebbm.reduce((a, v) => a + (Number(v.total_penjualan) || 0), 0);
    kreditRows.push({ label: `Nota/Voucher BBM ${related.ebbmSetting?.institution_name || 'Polres'}`, amount: total });
  }

  // ── Kredit: Test Nozzle/Tera (volume x harga jual aktif)
  related.testNozzle.forEach((t) => {
    const nz = nozzles.find((n) => n.id === t.nozzle_id);
    const prod = products.find((p) => p.id === nz?.product_id);
    const fp = fuelPrices.find((p) => p.product_id === nz?.product_id);
    const amount = (Number(t.volume_test) || 0) * (Number(fp?.sell_price) || 0);
    kreditRows.push({ label: `Tes Nozzle/Tera ${prod?.product_name || '-'} ${t.volume_test} Liter`, amount });
  });

  // ── Kredit: Pengeluaran Langsung + Susulan (per akun beban)
  (shift.expenses || []).forEach((e) => {
    const coa = expenseCoaList.find((c) => c.id === e.expense_coa_id);
    kreditRows.push({ label: coa ? coa.account_name : e.notes || 'Pengeluaran', amount: Number(e.amount) || 0 });
  });

  const totalKredit = kreditRows.reduce((a, r) => a + r.amount, 0);
  const netSetoran = totalDebit - totalKredit;

  return { debitRows, kreditRows, totalDebit, totalKredit, netSetoran };
}

export async function saveCashDenominations(shiftId: string, denoms: Record<string, number>): Promise<void> {
  const { error } = await supabase.from('t_shift_sales').update({ cash_denominations: denoms }).eq('id', shiftId);
  if (error) throw new Error(error.message);
}

export function totalFromDenominations(denoms: Record<string, number> | null | undefined): number {
  if (!denoms) return 0;
  return DENOMS.reduce((a, d) => a + (Number(denoms[d.key]) || 0) * d.value, 0);
}
