import { supabase } from './supabase';

// ================================================================
// Transaksi Non-Tunai (EDC/QRIS) — port dari pages/spbu/edc.js.
// Scope MVP mobile HANYA "Catat Transaksi" (insert + jurnal posting
// otomatis) — fitur Settle ke Bank, Batch Settle, dan Edit tidak
// diikutkan (itu proses rekonsiliasi back-office, lebih cocok di web).
// ================================================================
export type EdcRow = {
  id: string;
  date: string;
  payment_type: 'edc' | 'qris' | 'linkaja';
  card_no: string;
  ref_no: string;
  amount: number;
  operator_name: string | null;
  status: string;
  settlement_date: string | null;
};

export type EdcMapping = {
  branch_id: string;
  payment_type: string;
  account_receivable_id: string | null;
  account_kas_id: string | null;
};

const PT_LABEL: Record<string, string> = { edc: 'EDC', qris: 'QRIS', linkaja: 'LinkAja' };

export async function listEdcTransactions(branchId: string): Promise<EdcRow[]> {
  const { data, error } = await supabase
    .from('t_spbu_edc')
    .select('id, date, payment_type, card_no, ref_no, amount, operator_name, status, settlement_date')
    .eq('branch_id', branchId)
    .order('date', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []) as EdcRow[];
}

export async function getMapping(branchId: string, paymentType: string): Promise<EdcMapping | null> {
  const { data, error } = await supabase
    .from('m_edc_account_mapping')
    .select('branch_id, payment_type, account_receivable_id, account_kas_id')
    .eq('branch_id', branchId)
    .eq('payment_type', paymentType)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as EdcMapping | null;
}

function genJournalNo(refType: string, date: string) {
  return `${refType}-${date.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

export async function saveEdcTransaction(params: {
  companyId: string;
  branchId: string;
  paymentType: 'edc' | 'qris' | 'linkaja';
  shiftType: string;
  date: string;
  amount: number;
  cardNo: string;
  refNo: string;
  operatorName?: string | null;
  notes?: string | null;
  userName: string;
}): Promise<EdcRow> {
  const { data: insRows, error: insErr } = await supabase
    .from('t_spbu_edc')
    .insert([
      {
        company_id: params.companyId,
        branch_id: params.branchId,
        payment_type: params.paymentType,
        shift_type: params.shiftType,
        date: params.date,
        amount: params.amount,
        card_no: params.cardNo,
        ref_no: params.refNo,
        operator_name: params.operatorName || null,
        notes: params.notes || null,
        created_by: params.userName,
        status: 'posted',
      },
    ])
    .select()
    .single();
  if (insErr) throw new Error(insErr.message);

  // Jurnal posting otomatis: Dr. Piutang [Metode] / Cr. Kas — hanya kalau
  // mapping akun untuk cabang+metode ini sudah dikonfigurasi (sama seperti
  // web: kalau mapping belum ada, transaksi tetap tersimpan tanpa jurnal).
  try {
    const mapping = await getMapping(params.branchId, params.paymentType);
    if (mapping?.account_receivable_id && mapping?.account_kas_id) {
      const refType = params.paymentType === 'qris' ? 'QRIS_POSTING' : params.paymentType === 'linkaja' ? 'LINKAJA_POSTING' : 'EDC_POSTING';
      const ptLbl = PT_LABEL[params.paymentType] || 'EDC';

      const { data: jRows, error: jErr } = await supabase
        .from('t_journals')
        .insert([
          {
            company_id: params.companyId,
            branch_id: params.branchId,
            journal_date: params.date,
            journal_number: genJournalNo(refType, params.date),
            reference_type: refType,
            notes: `Transaksi ${ptLbl} — Ref: ${params.refNo}`,
            status: 'posted',
            total_debit: params.amount,
            total_kredit: params.amount,
            created_by: params.userName,
          },
        ])
        .select()
        .single();
      if (!jErr && jRows) {
        await supabase.from('t_journal_items').insert([
          { journal_id: jRows.id, coa_id: mapping.account_receivable_id, debit: params.amount, kredit: 0, description: `Piutang ${ptLbl} — ${params.refNo}` },
          { journal_id: jRows.id, coa_id: mapping.account_kas_id, debit: 0, kredit: params.amount, description: `Kas keluar ${ptLbl} — ${params.refNo}` },
        ]);
        await supabase.from('t_spbu_edc').update({ posting_journal_id: jRows.id }).eq('id', insRows.id);
      }
    }
  } catch {
    // Jurnal gagal bukan alasan untuk membatalkan — data transaksi tetap tersimpan (sama seperti web).
  }

  return insRows as EdcRow;
}
