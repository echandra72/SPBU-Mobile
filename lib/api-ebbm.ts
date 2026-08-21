import { supabase } from './supabase';

// ================================================================
// E-BBM Polres — Penggunaan Voucher. Scope MVP mobile: HANYA "Catat
// Voucher" (insert baru). Titipan Masuk & Penyesuaian Susut/Muai
// tidak diikutkan (operasi admin, lebih jarang, tetap di web).
// Penulisan sebenarnya (jurnal 4-baris + update stok) dilakukan oleh
// RPC fn_confirm_ebbm_voucher (lihat supabase_migrations/confirm_ebbm_voucher.sql)
// — SAMA seperti pola fn_post_shift_sale & fn_confirm_lo_receipt.
// ================================================================
export type EbbmStock = {
  product_id: string;
  stock_qty: number;
};

export type VoucherUsage = {
  id: string;
  voucher_no: string;
  date: string;
  shift_type: string | null;
  qty: number;
  total_penjualan: number;
  product_id: string;
};

export async function hasEbbmSettings(branchId: string): Promise<boolean> {
  const { data, error } = await supabase.from('m_ebbm_settings').select('id').eq('branch_id', branchId).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function listEbbmStock(branchId: string): Promise<EbbmStock[]> {
  const { data, error } = await supabase.from('t_ebbm_stock').select('product_id, stock_qty').eq('branch_id', branchId);
  if (error) throw new Error(error.message);
  return (data || []) as EbbmStock[];
}

export async function listVoucherUsage(branchId: string): Promise<VoucherUsage[]> {
  const { data, error } = await supabase
    .from('t_ebbm_voucher_usage')
    .select('id, voucher_no, date, shift_type, qty, total_penjualan, product_id')
    .eq('branch_id', branchId)
    .order('date', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []) as VoucherUsage[];
}

export async function confirmEbbmVoucher(params: {
  branchId: string;
  companyId: string;
  productId: string;
  voucherNo: string;
  date: string;
  shiftType: string;
  qty: number;
  unitPrice: number;
  pembawaNama?: string | null;
  noKendaraan?: string | null;
  jenisKendaraan?: string | null;
  userName: string;
}): Promise<{ voucher_id: string; voucher_no: string; journal_id: string; total_penjualan: number; stock_after: number }> {
  const { data, error } = await supabase.rpc('fn_confirm_ebbm_voucher', {
    p_branch_id: params.branchId,
    p_company_id: params.companyId,
    p_product_id: params.productId,
    p_voucher_no: params.voucherNo,
    p_date: params.date,
    p_shift_type: params.shiftType,
    p_qty: params.qty,
    p_unit_price: params.unitPrice,
    p_pembawa_nama: params.pembawaNama || null,
    p_no_kendaraan: params.noKendaraan || null,
    p_jenis_kendaraan: params.jenisKendaraan || null,
    p_user_name: params.userName,
  });
  if (error) throw new Error(error.message);
  return data;
}
