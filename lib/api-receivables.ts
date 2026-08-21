import { supabase } from './supabase';

// ================================================================
// Piutang / Kupon Konsumen SPBU — port dari pages/spbu/receivables.js
// (tabel t_spbu_receivables). Catatan koreksi terhadap web: web
// menulis field `description` ke t_journals (kolom itu TIDAK ada,
// kolom aslinya `notes`) dan mengandalkan `m_branches.cash_account_id`
// (kolom itu juga TIDAK ada) untuk auto-pilih akun Kas — keduanya
// tampak seperti bug laten di web (auto-select Kas tidak pernah
// benar-benar jalan). Di mobile ini ditulis dengan kolom yang benar
// (`notes`) dan akun Kas dipilih manual oleh operator (chip list COA
// asset), bukan auto-select yang sebenarnya tidak berfungsi di web.
// ================================================================
export type Customer = {
  id: string;
  name: string;
  coa_ar_control: string | null;
};

export type CoaAccount = {
  id: string;
  account_code: string;
  account_name: string;
};

export type Receivable = {
  id: string;
  date: string;
  voucher_no: string | null;
  customer_id: string | null;
  customer_name?: string;
  qty: number;
  total_amount: number;
  vehicle_no: string | null;
  driver_name: string | null;
  status: string;
};

export async function listCustomers(companyId: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('m_customers')
    .select('id, name, coa_ar_control')
    .eq('is_active', true)
    .eq('company_id', companyId)
    .order('name');
  if (error) throw new Error(error.message);
  return (data || []) as Customer[];
}

export async function listCashCoaAccounts(companyId: string): Promise<CoaAccount[]> {
  const { data, error } = await supabase
    .from('m_coa')
    .select('id, account_code, account_name')
    .eq('is_active', true)
    .eq('level', 'detail')
    .eq('coa_type', 'asset')
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .order('account_code');
  if (error) throw new Error(error.message);
  return (data || []) as CoaAccount[];
}

export async function listReceivables(branchId: string): Promise<Receivable[]> {
  const { data, error } = await supabase
    .from('t_spbu_receivables')
    .select('id, date, voucher_no, customer_id, qty, total_amount, vehicle_no, driver_name, status, customer:customer_id(name)')
    .eq('branch_id', branchId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({ ...r, customer_name: r.customer?.name || '-' }));
}

function genJournalNo() {
  return 'JV-AR-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function saveReceivable(params: {
  companyId: string;
  branchId: string;
  date: string;
  voucherNo: string;
  customerId: string;
  coaDrId: string; // akun Piutang (dari customer.coa_ar_control)
  coaCrId: string; // akun Kas/Bank pengurang
  description?: string | null;
  qty: number;
  unitPrice: number;
  vehicleNo?: string | null;
  driverName?: string | null;
  customerName: string;
  userName: string;
}): Promise<Receivable> {
  const total = params.qty * params.unitPrice;
  if (total <= 0) throw new Error('Nilai transaksi harus lebih dari 0.');

  const { data: jRows, error: jErr } = await supabase
    .from('t_journals')
    .insert([
      {
        company_id: params.companyId,
        branch_id: params.branchId,
        journal_number: genJournalNo(),
        journal_date: params.date,
        reference_type: 'PIUTANG_SPBU',
        reference_id: null,
        notes: `Piutang SPBU ${params.voucherNo} - ${params.customerName}${params.description ? ' (' + params.description + ')' : ''}`,
        total_debit: total,
        total_kredit: total,
        status: 'posted',
        created_by: params.userName,
        customer_id: params.customerId,
      },
    ])
    .select()
    .single();
  if (jErr) throw new Error(jErr.message);
  const journalId = jRows.id;

  const { error: itemsErr } = await supabase.from('t_journal_items').insert([
    { journal_id: journalId, coa_id: params.coaDrId, debit: total, kredit: 0, description: `Piutang SPBU ${params.voucherNo}` },
    { journal_id: journalId, coa_id: params.coaCrId, debit: 0, kredit: total, description: `Pengurang Kas Piutang ${params.voucherNo}` },
  ]);
  if (itemsErr) throw new Error(itemsErr.message);

  const { data: recRows, error: recErr } = await supabase
    .from('t_spbu_receivables')
    .insert([
      {
        company_id: params.companyId,
        branch_id: params.branchId,
        date: params.date,
        voucher_no: params.voucherNo,
        customer_id: params.customerId,
        description: params.description || null,
        qty: params.qty,
        unit: 'Ltr',
        unit_price: params.unitPrice,
        total_amount: total,
        vehicle_no: params.vehicleNo || null,
        driver_name: params.driverName || null,
        journal_id: journalId,
        status: 'posted',
        created_by: params.userName,
      },
    ])
    .select()
    .single();
  if (recErr) throw new Error(recErr.message);

  await supabase.from('t_journals').update({ reference_id: recRows.id }).eq('id', journalId);

  return { ...recRows, customer_name: params.customerName } as Receivable;
}
