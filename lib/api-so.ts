import { supabase } from './supabase';

// ================================================================
// Buat Surat Order (Penebusan) — port SEBAGIAN dari
// pages/spbu/setoran-so.js. Scope MVP mobile: SO dibuat sebagai
// status 'draft' SAJA — tidak memicu jurnal (kode web sendiri
// mengonfirmasi "Draft tidak membuat jurnal"). Status 'submitted'
// (yang memicu generateSOJournal(): 5 baris pajak PPN/PPh22/PBBKB/
// Margin/Hutang dengan banyak pemetaan COA per produk) SENGAJA tidak
// diikutkan — draft yang dibuat dari mobile perlu ditinjau & di-submit
// dari web oleh admin/back-office.
// ================================================================
export type Supplier = {
  id: string;
  code: string;
  name: string;
};

export async function listSuppliers(companyId: string): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('m_suppliers')
    .select('id, code, name')
    .eq('is_active', true)
    .eq('company_id', companyId)
    .order('code');
  if (error) throw new Error(error.message);
  return (data || []) as Supplier[];
}

function genSoDraftNo(branchCode: string) {
  const d = new Date();
  const ts = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `DRAFT-${branchCode}-${ts}-${rand}`;
}

export async function createSoDraft(params: {
  companyId: string;
  branchId: string;
  branchCode: string;
  supplierId: string;
  productId: string;
  volOrder: number;
  unitPrice: number;
  orderDate: string;
  needDate: string;
  notes?: string | null;
  submittedBy: string;
}): Promise<{ id: string; so_number: string }> {
  const { data: soRow, error: soErr } = await supabase
    .from('t_surat_orders')
    .insert([
      {
        so_number: genSoDraftNo(params.branchCode),
        branch_id: params.branchId,
        company_id: params.companyId,
        supplier_id: params.supplierId,
        order_date: params.orderDate,
        need_date: params.needDate,
        submitted_by: params.submittedBy,
        notes: params.notes || null,
        status: 'draft',
      },
    ])
    .select()
    .single();
  if (soErr) throw new Error(soErr.message);

  const { error: itemErr } = await supabase.from('t_surat_order_items').insert([
    {
      so_id: soRow.id,
      product_id: params.productId,
      vol_order: params.volOrder,
      vol_received_total: 0,
      unit_price: params.unitPrice,
      margin_per_liter: 0,
      ppn_amount: 0,
      pbbkb_amount: 0,
      pph22_amount: 0,
    },
  ]);
  if (itemErr) throw new Error(itemErr.message);

  return { id: soRow.id, so_number: soRow.so_number };
}
