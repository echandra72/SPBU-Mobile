import { supabase } from './supabase';

// ================================================================
// Tangki & Stok (Kartu Stok) — PORT PERSIS dari pages/spbu/tank-ledger.js
// buildLedgerEvents(): saldo awal (locked) + Penerimaan LO (received) −
// Penjualan Shift (posted), dihitung dari sumber, TIDAK dari
// t_tank_mutations. Murni read-only, tidak ada insert/update.
// ================================================================
export type TankRow = {
  id: string;
  tank_code: string;
  tank_name: string | null;
  capacity: number;
  current_stock: number;
  branch_id: string;
  product_id: string;
  product_name: string;
};

export type LedgerEvent = {
  mutation_date: string;
  notes: string;
  qty_in: number;
  qty_out: number;
  balance: number;
  seq: number;
};

export async function listTanksForBranch(branchId: string): Promise<TankRow[]> {
  const { data, error } = await supabase
    .from('m_tanks')
    .select('id, tank_code, tank_name, capacity, current_stock, branch_id, product_id, product:m_fuel_products(product_name)')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('tank_code');
  if (error) throw new Error(error.message);
  return (data || []).map((t: any) => ({
    id: t.id,
    tank_code: t.tank_code,
    tank_name: t.tank_name,
    capacity: Number(t.capacity) || 0,
    current_stock: Number(t.current_stock) || 0,
    branch_id: t.branch_id,
    product_id: t.product_id,
    product_name: t.product?.product_name || 'BBM',
  }));
}

export async function buildLedgerEvents(tank: TankRow): Promise<LedgerEvent[]> {
  let openVol = 0;
  let openDate: string | null = null;
  const { data: balRows } = await supabase
    .from('t_tank_initial_balances')
    .select('balance_date, volume, status')
    .eq('tank_id', tank.id)
    .eq('status', 'locked')
    .order('balance_date', { ascending: false })
    .limit(1);
  if (balRows && balRows.length) {
    openVol = Number(balRows[0].volume) || 0;
    openDate = balRows[0].balance_date;
  }

  const { data: nozRows } = await supabase.from('m_nozzles').select('id, tank_id').eq('tank_id', tank.id);
  const nozIds = new Set((nozRows || []).map((n: any) => n.id));

  const { data: loRows } = await supabase
    .from('t_lo_receipts')
    .select('lo_number, receive_date, status, items:t_lo_receipt_items(product_id, tank_id, vol_received)')
    .in('status', ['received', 'verified'])
    .eq('branch_id', tank.branch_id);

  const { data: shiftRows } = await supabase
    .from('t_shift_sales')
    .select('shift_number, shift_date, status, details:t_shift_sale_details(nozzle_id, volume)')
    .eq('status', 'posted')
    .eq('branch_id', tank.branch_id);

  const ev: LedgerEvent[] = [];
  if (openDate) {
    ev.push({ mutation_date: openDate, notes: 'Saldo Awal Tangki', qty_in: openVol, qty_out: 0, balance: 0, seq: 0 });
  }
  (loRows || []).forEach((lo: any) => {
    if (openDate && lo.receive_date && lo.receive_date < openDate) return;
    (lo.items || []).forEach((it: any) => {
      const match = it.tank_id ? String(it.tank_id) === String(tank.id) : String(it.product_id) === String(tank.product_id);
      const v = Number(it.vol_received) || 0;
      if (match && v > 0) {
        ev.push({ mutation_date: lo.receive_date || openDate || '', notes: 'Penerimaan LO ' + (lo.lo_number || ''), qty_in: v, qty_out: 0, balance: 0, seq: 1 });
      }
    });
  });
  (shiftRows || []).forEach((sh: any) => {
    if (openDate && sh.shift_date && sh.shift_date < openDate) return;
    (sh.details || []).forEach((d: any) => {
      const v = Number(d.volume) || 0;
      if (nozIds.has(d.nozzle_id) && v > 0) {
        ev.push({ mutation_date: sh.shift_date || '', notes: 'Penjualan Shift ' + (sh.shift_number || ''), qty_in: 0, qty_out: v, balance: 0, seq: 2 });
      }
    });
  });

  ev.sort((a, b) => (a.mutation_date < b.mutation_date ? -1 : a.mutation_date > b.mutation_date ? 1 : a.seq - b.seq));
  let bal = 0;
  ev.forEach((e) => {
    bal += e.qty_in - e.qty_out;
    e.balance = bal;
  });
  return ev;
}
