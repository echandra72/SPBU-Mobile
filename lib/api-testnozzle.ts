import { supabase } from './supabase';

// ================================================================
// Uji Nozzle (Tera/Kalibrasi) — port dari pages/spbu/test-nozzle.html.
// Modul paling sederhana: murni catat data (tanpa jurnal, tanpa efek
// stok tangki) — BBM dikembalikan ke tangki secara fisik saat uji,
// hanya volumenya dicatat supaya setoran kasir tidak selisih.
// ================================================================
export type NozzleOption = {
  id: string;
  nozzle_code: string;
  side: string;
  product_id: string;
  product_name: string;
  color_code: string | null;
  dispenser_code: string;
  dispenser_name: string;
};

export type TestNozzleRow = {
  id: string;
  test_date: string;
  shift_type: string | null;
  nozzle_id: string;
  volume_test: number;
  notes: string | null;
};

export async function listNozzleOptions(branchId: string): Promise<NozzleOption[]> {
  const { data, error } = await supabase
    .from('m_nozzles')
    .select('id, nozzle_code, side, product_id, m_dispensers!inner(branch_id, dispenser_code, dispenser_name), m_fuel_products(product_name, color_code)')
    .eq('is_active', true)
    .eq('m_dispensers.branch_id', branchId)
    .order('nozzle_code');
  if (error) throw new Error(error.message);
  return (data || []).map((n: any) => ({
    id: n.id,
    nozzle_code: n.nozzle_code,
    side: n.side || '',
    product_id: n.product_id,
    product_name: n.m_fuel_products?.product_name || '-',
    color_code: n.m_fuel_products?.color_code || null,
    dispenser_code: n.m_dispensers?.dispenser_code || '-',
    dispenser_name: n.m_dispensers?.dispenser_name || '-',
  }));
}

export async function listTestNozzle(branchId: string): Promise<TestNozzleRow[]> {
  const { data, error } = await supabase
    .from('t_spbu_test_nozzle')
    .select('id, test_date, shift_type, nozzle_id, volume_test, notes')
    .eq('branch_id', branchId)
    .order('test_date', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []) as TestNozzleRow[];
}

export async function saveTestNozzle(params: {
  companyId: string;
  branchId: string;
  nozzleId: string;
  testDate: string;
  shiftType: string;
  volumeTest: number;
  notes?: string | null;
  createdBy: string;
}): Promise<TestNozzleRow> {
  const { data, error } = await supabase
    .from('t_spbu_test_nozzle')
    .insert([
      {
        company_id: params.companyId,
        branch_id: params.branchId,
        nozzle_id: params.nozzleId,
        test_date: params.testDate,
        shift_type: params.shiftType,
        volume_test: params.volumeTest,
        notes: params.notes || null,
        created_by: params.createdBy,
      },
    ])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TestNozzleRow;
}
