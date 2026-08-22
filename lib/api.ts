import { supabase } from './supabase';

// ================================================================
// Tipe data — mengikuti skema t_shift_sales / t_shift_sale_details /
// t_shift_payments di Supabase (project ejrsgjnjjyegpitccrfc), sama
// persis dengan yang dipakai pages/spbu/fuel-sales.js (web).
// ================================================================
export type ShiftDetail = {
  id: string;
  shift_sale_id: string;
  nozzle_id: string;
  product_id: string;
  meter_mode: 'SINGLE' | 'DUAL';
  meter_start_1: number;
  meter_end_1: number | null;
  volume_1: number;
  meter_start_2: number | null;
  meter_end_2: number | null;
  volume_2: number | null;
  selected_meter: '1' | '2';
  volume: number;
  unit_price: number;
  subtotal: number;
};

export type ShiftPayment = {
  id: string;
  shift_sale_id: string;
  method: string;
  amount: number;
  reference_no: string | null;
  bank_coa_id: string | null;
  notes: string | null;
};

export type ShiftSale = {
  id: string;
  branch_id: string;
  shift_number: string;
  shift_date: string;
  shift_type: string;
  operator_name: string;
  status: 'draft' | 'posted' | 'void';
  total_volume: number;
  total_amount: number;
  total_payment: number;
  selisih: number;
  printed_at: string | null;
  notes: string | null;
  details: ShiftDetail[];
  payments: ShiftPayment[];
};

export type Nozzle = {
  id: string;
  nozzle_code: string;
  side: string;
  meter_mode: 'SINGLE' | 'DUAL';
  last_totalizer: number;
  last_totalizer_2: number | null;
  dispenser_id: string;
  tank_id: string;
  product_id: string;
  dispenser_code: string;
};

export type FuelProduct = {
  id: string;
  product_name: string;
  product_code: string;
  color_code: string | null;
};

export type FuelPrice = {
  id: string;
  branch_id: string;
  product_id: string;
  sell_price: number;
  is_active: boolean;
};

export type BankAccount = {
  id: string;
  account_code: string;
  account_name: string;
};

const SHIFT_SELECT =
  '*, details:t_shift_sale_details(*), payments:t_shift_payments(*)';

export async function getBranchCode(branchId: string): Promise<string> {
  const { data, error } = await supabase.from('m_branches').select('branch_code').eq('id', branchId).single();
  if (error) throw new Error(error.message);
  return (data as any)?.branch_code || 'XX';
}

export type BranchOption = {
  id: string;
  name: string;
  branch_code: string;
  company_id: string;
};

// Untuk akun level 1 (Super Admin): semua cabang semua perusahaan.
// Untuk level 2 (Manajemen): semua cabang di perusahaannya saja.
// Sama seperti pola loadBranches() di berbagai halaman web (mis. receivables.js, edc.js).
export async function listAccessibleBranches(isGodMode: boolean, companyId: string): Promise<BranchOption[]> {
  let query = supabase.from('m_branches').select('id, name, branch_code, company_id').eq('is_active', true).order('name');
  if (!isGodMode && companyId) query = query.eq('company_id', companyId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as BranchOption[];
}

export async function listShifts(branchId: string): Promise<ShiftSale[]> {
  const { data, error } = await supabase
    .from('t_shift_sales')
    .select(SHIFT_SELECT)
    .eq('branch_id', branchId)
    .order('shift_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []) as unknown as ShiftSale[];
}

export async function getShift(shiftId: string): Promise<ShiftSale> {
  const { data, error } = await supabase
    .from('t_shift_sales')
    .select(SHIFT_SELECT)
    .eq('id', shiftId)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ShiftSale;
}

export async function listNozzles(branchId: string): Promise<Nozzle[]> {
  const { data, error } = await supabase
    .from('m_nozzles')
    .select(
      'id, nozzle_code, side, meter_mode, last_totalizer, last_totalizer_2, dispenser_id, tank_id, product_id, is_active, m_dispensers!inner(dispenser_code, branch_id)'
    )
    .eq('is_active', true)
    .eq('m_dispensers.branch_id', branchId);
  if (error) throw new Error(error.message);
  return (data || []).map((n: any) => ({
    ...n,
    dispenser_code: n.m_dispensers?.dispenser_code || '',
  }));
}

export async function listFuelProducts(companyId: string): Promise<FuelProduct[]> {
  const { data, error } = await supabase
    .from('m_fuel_products')
    .select('id, product_name, product_code, color_code')
    .or(`company_id.eq.${companyId},company_id.is.null`);
  if (error) throw new Error(error.message);
  return (data || []) as FuelProduct[];
}

export async function listFuelPrices(branchId: string): Promise<FuelPrice[]> {
  const { data, error } = await supabase
    .from('m_fuel_prices')
    .select('id, branch_id, product_id, sell_price, is_active')
    .eq('branch_id', branchId)
    .eq('is_active', true);
  if (error) throw new Error(error.message);
  return (data || []) as FuelPrice[];
}

export async function listBankAccounts(companyId: string): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from('m_coa')
    .select('id, account_code, account_name')
    .eq('coa_type', 'asset')
    .eq('level', 'detail')
    .eq('is_active', true)
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .order('account_code');
  if (error) throw new Error(error.message);
  return (data || []) as BankAccount[];
}

// Cek duplikasi shift (tanggal + jenis + cabang yang sama, bukan void) —
// sama seperti validasi di fuel-sales.js createShift().
export async function findDuplicateShift(branchId: string, shiftDate: string, shiftType: string) {
  const { data, error } = await supabase
    .from('t_shift_sales')
    .select('id, shift_number')
    .eq('branch_id', branchId)
    .eq('shift_date', shiftDate)
    .eq('shift_type', shiftType)
    .neq('status', 'void')
    .limit(1);
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? data[0] : null;
}

export async function createShift(params: {
  branchId: string;
  branchCode: string;
  shiftDate: string;
  shiftType: string;
  operatorName: string;
  notes?: string | null;
  createdBy: string;
}): Promise<ShiftSale> {
  const { branchId, branchCode, shiftDate, shiftType, operatorName, notes, createdBy } = params;

  const nozzles = await listNozzles(branchId);
  if (!nozzles.length) throw new Error('Tidak ada nozzle di cabang ini.');

  const prices = await listFuelPrices(branchId);

  // Nomor shift — pola sama seperti web: SHF-{kode_cabang}-{tgl}-{seq}-{ts}
  const { count } = await supabase
    .from('t_shift_sales')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId);
  const seq = String((count || 0) + 1).padStart(3, '0');
  const ts = Date.now().toString().slice(-4);
  const shiftNumber = `SHF-${branchCode || 'XX'}-${shiftDate.replace(/-/g, '')}-${seq}-${ts}`;

  const { data: headRows, error: headErr } = await supabase
    .from('t_shift_sales')
    .insert([
      {
        branch_id: branchId,
        shift_number: shiftNumber,
        shift_date: shiftDate,
        shift_type: shiftType,
        operator_name: operatorName,
        status: 'draft',
        notes: notes || null,
        created_by: createdBy,
      },
    ])
    .select();
  if (headErr) throw new Error(headErr.message);
  const head = headRows?.[0];
  if (!head) throw new Error('Gagal membuat shift.');

  const detailPayload = nozzles.map((n) => {
    const price = prices.find((p) => p.product_id === n.product_id);
    return {
      shift_sale_id: head.id,
      nozzle_id: n.id,
      product_id: n.product_id,
      meter_mode: n.meter_mode || 'SINGLE',
      meter_start_1: Number(n.last_totalizer) || 0,
      meter_start_2: n.last_totalizer_2 != null ? Number(n.last_totalizer_2) : null,
      selected_meter: '1',
      unit_price: Number(price?.sell_price) || 0,
    };
  });
  const { error: detErr } = await supabase.from('t_shift_sale_details').insert(detailPayload);
  if (detErr) throw new Error(detErr.message);

  // Baris pembayaran tunai default (dummy amount kecil, sama seperti web —
  // wajib ada minimal 1 metode, user isi nominal aktual di layar Pembayaran).
  await supabase.from('t_shift_payments').insert([
    {
      shift_sale_id: head.id,
      method: 'tunai',
      amount: 0.01,
      bank_coa_id: null,
    },
  ]);

  return getShift(head.id);
}

// Simpan meter akhir 1 nozzle — volume & subtotal dihitung sama persis
// seperti updateMeterEnd()/recalcDetailFinal() di fuel-sales.js.
export async function saveNozzleMeter(
  detail: ShiftDetail,
  meterNum: '1' | '2',
  endValue: number
): Promise<ShiftDetail> {
  const start = meterNum === '1' ? detail.meter_start_1 : detail.meter_start_2 || 0;
  const vol = endValue >= start ? Number((endValue - start).toFixed(3)) : 0;

  const patch: Partial<ShiftDetail> =
    meterNum === '1' ? { meter_end_1: endValue, volume_1: vol } : { meter_end_2: endValue, volume_2: vol };

  const merged = { ...detail, ...patch };
  // MVP: selected_meter selalu '1' (tanpa opsi pilih meter mana yang dipakai
  // untuk DUAL nozzle — simplifikasi dari web yang mengizinkan pilih meter 2).
  const selectedVol = merged.selected_meter === '2' ? merged.volume_2 || 0 : merged.volume_1;
  const subtotal = Math.round(selectedVol * (Number(merged.unit_price) || 0));

  const { data, error } = await supabase
    .from('t_shift_sale_details')
    .update({ ...patch, volume: selectedVol, subtotal })
    .eq('id', detail.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ShiftDetail;
}

export async function addPayment(shiftId: string, method: string): Promise<ShiftPayment> {
  const { data, error } = await supabase
    .from('t_shift_payments')
    .insert([{ shift_sale_id: shiftId, method, amount: 0.01, bank_coa_id: null }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ShiftPayment;
}

export async function updatePayment(
  paymentId: string,
  patch: Partial<Pick<ShiftPayment, 'amount' | 'bank_coa_id' | 'reference_no'>>
): Promise<void> {
  const { error } = await supabase.from('t_shift_payments').update(patch).eq('id', paymentId);
  if (error) throw new Error(error.message);
}

export async function deletePayment(paymentId: string): Promise<void> {
  const { error } = await supabase.from('t_shift_payments').delete().eq('id', paymentId);
  if (error) throw new Error(error.message);
}

// Pengganti langkah "cetak Laporan Harian Totalisator" di web (mobile belum
// punya alur cetak) — menandai printed_at supaya fn_post_shift_sale (yang
// mewajibkan printed_at, sama seperti validasi web) bisa dilanjutkan.
export async function markPrinted(shiftId: string): Promise<void> {
  const { error } = await supabase.from('t_shift_sales').update({ printed_at: new Date().toISOString() }).eq('id', shiftId);
  if (error) throw new Error(error.message);
}

export async function postShiftSale(shiftId: string, userName: string): Promise<{
  shift_id: string;
  shift_number: string;
  journal_id: string;
  total_amount: number;
}> {
  const { data, error } = await supabase.rpc('fn_post_shift_sale', {
    p_shift_id: shiftId,
    p_user_name: userName,
  });
  if (error) throw new Error(error.message);
  return data;
}
