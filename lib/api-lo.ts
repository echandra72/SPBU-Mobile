import { supabase } from './supabase';

// ================================================================
// Tipe data — Penerimaan LO dari Pertamina (t_surat_orders,
// t_surat_order_items, t_lo_receipts, t_lo_receipt_items). Sama
// persis dengan skema yang dipakai pages/spbu/fuel-receipt.js (web).
// Hanya alur NORMAL (LO tertaut SO) yang didukung — LO Darurat
// (pembelian langsung tanpa SO) belum ada di mobile.
// ================================================================
export type SoItem = {
  id: string;
  so_id: string;
  product_id: string;
  vol_order: number;
  vol_received_total: number;
  unit_price: number;
  margin_per_liter: number;
};

export type SuratOrder = {
  id: string;
  branch_id: string;
  so_number: string;
  order_date: string;
  need_date: string;
  status: string;
  supplier_id: string | null;
  lo_number: string | null;
  items: SoItem[];
};

export type LoReceiptItem = {
  id?: string;
  lo_id?: string;
  product_id: string;
  tank_id: string | null;
  vol_lo: number;
  vol_received: number | null;
  temperature?: number | null;
  density?: number | null;
  seal_number?: string | null;
};

export type LoReceipt = {
  id: string;
  branch_id: string;
  so_id: string | null;
  lo_number: string;
  receive_date: string;
  truck_no: string;
  driver_name: string | null;
  status: string;
  items: LoReceiptItem[];
};

export type Tank = {
  id: string;
  tank_code: string;
  tank_name: string | null;
  product_id: string;
  capacity: number;
  current_stock: number;
};

// SO yang siap diterima: submitted/approved (belum received penuh) —
// sama seperti soQueryPending di fuel-receipt.js.
export async function listPendingSO(branchId: string): Promise<SuratOrder[]> {
  const { data, error } = await supabase
    .from('t_surat_orders')
    .select('*, items:t_surat_order_items(*)')
    .eq('branch_id', branchId)
    .in('status', ['submitted', 'approved'])
    .order('order_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as unknown as SuratOrder[];
}

export async function listRecentLoReceipts(branchId: string): Promise<LoReceipt[]> {
  const { data, error } = await supabase
    .from('t_lo_receipts')
    .select('*, items:t_lo_receipt_items(*)')
    .eq('branch_id', branchId)
    .order('receive_date', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data || []) as unknown as LoReceipt[];
}

export async function listTanks(branchId: string): Promise<Tank[]> {
  const { data, error } = await supabase
    .from('m_tanks')
    .select('id, tank_code, tank_name, product_id, capacity, current_stock')
    .eq('branch_id', branchId)
    .eq('is_active', true);
  if (error) throw new Error(error.message);
  return (data || []) as Tank[];
}

function genLoNumber(branchCode: string) {
  const d = new Date();
  const ts = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LO-${branchCode}-${ts}-${rand}`;
}

// Insert LO + items dengan status langsung 'received' (sama seperti
// submitLOReceived('received') di web) — efek samping (jurnal, stok
// tangki, sinkronisasi SO) DIPISAH ke fn_confirm_lo_receipt (RPC),
// dipanggil terpisah oleh caller setelah insert ini sukses.
export async function createLoReceipt(params: {
  companyId: string;
  branchId: string;
  branchCode: string;
  soId: string | null;
  receiveDate: string;
  truckNo: string;
  driverName?: string | null;
  driverPhone?: string | null;
  pertaminaOfficer?: string | null;
  notes?: string | null;
  items: LoReceiptItem[];
}): Promise<LoReceipt> {
  const loNumber = genLoNumber(params.branchCode);
  const { data: headRows, error: headErr } = await supabase
    .from('t_lo_receipts')
    .insert([
      {
        company_id: params.companyId,
        branch_id: params.branchId,
        so_id: params.soId,
        lo_number: loNumber,
        receive_date: params.receiveDate,
        truck_no: params.truckNo,
        driver_name: params.driverName || null,
        driver_phone: params.driverPhone || null,
        pertamina_officer: params.pertaminaOfficer || null,
        notes: params.notes || null,
        status: 'received',
      },
    ])
    .select()
    .single();
  if (headErr) throw new Error(headErr.message);

  const itemsPayload = params.items.map((it) => ({
    lo_id: headRows.id,
    product_id: it.product_id,
    tank_id: it.tank_id,
    vol_lo: it.vol_lo,
    vol_received: it.vol_received,
    temperature: it.temperature ?? null,
    density: it.density ?? null,
    seal_number: it.seal_number ?? null,
  }));
  const { error: itemsErr } = await supabase.from('t_lo_receipt_items').insert(itemsPayload);
  if (itemsErr) throw new Error(itemsErr.message);

  const { data: full, error: getErr } = await supabase
    .from('t_lo_receipts')
    .select('*, items:t_lo_receipt_items(*)')
    .eq('id', headRows.id)
    .single();
  if (getErr) throw new Error(getErr.message);
  return full as unknown as LoReceipt;
}

export async function confirmLoReceipt(loId: string, userName: string): Promise<{
  lo_id: string;
  lo_number: string;
  journal_id: string;
  total_debit: number;
  so_status: string | null;
}> {
  const { data, error } = await supabase.rpc('fn_confirm_lo_receipt', {
    p_lo_id: loId,
    p_user_name: userName,
  });
  if (error) throw new Error(error.message);
  return data;
}
