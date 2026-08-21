-- ================================================================
-- Fungsi bersama untuk Konfirmasi Penerimaan LO (alur NORMAL — LO
-- tertaut ke Surat Order asli, BUKAN LO Darurat/pembelian langsung
-- yang punya skema akun berbeda di web dan sengaja tidak diikutkan
-- di versi awal ini). Port dari pages/spbu/fuel-receipt.js:
-- generateLOJournal() (cabang non-darurat), syncSOReceipt(), dan
-- reuse fn_recompute_tank_stock yang sudah ada (dipakai bersama
-- dengan Post Shift).
--
-- Asumsi pemanggilan: t_lo_receipts (status='received') beserta
-- t_lo_receipt_items SUDAH di-insert oleh caller (web/mobile) SEBELUM
-- memanggil fungsi ini — fungsi ini hanya menangani efek samping
-- setelah data mentah tersimpan (jurnal, stok tangki, sinkronisasi SO),
-- sama seperti pembagian tanggung jawab createShift() (client)
-- vs fn_post_shift_sale() (server) untuk modul Shift Penjualan BBM.
-- ================================================================
CREATE OR REPLACE FUNCTION fn_confirm_lo_receipt(p_lo_id uuid, p_user_name text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_lo           t_lo_receipts%ROWTYPE;
  v_so           t_surat_orders%ROWTYPE;
  v_journal_id   uuid;
  v_journal_no   text;
  v_total_debit  numeric := 0;
  v_total_kredit numeric := 0;
  rec            record;
  v_vol          numeric;
  v_price        numeric;
  v_val          numeric;
  v_tank_ids     uuid[];
  v_tank_id      uuid;
  v_all_complete boolean := true;
  v_new_so_status text;
BEGIN
  SELECT * INTO v_lo FROM t_lo_receipts WHERE id = p_lo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LO tidak ditemukan.';
  END IF;
  IF v_lo.status NOT IN ('received', 'verified') THEN
    RAISE EXCEPTION 'LO harus berstatus received/verified sebelum diproses (status saat ini: %).', v_lo.status;
  END IF;
  IF EXISTS (SELECT 1 FROM t_journals WHERE reference_type = 'lo_receipt' AND reference_id = p_lo_id) THEN
    RAISE EXCEPTION 'LO ini sudah pernah diproses jurnalnya sebelumnya.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM t_lo_receipt_items WHERE lo_id = p_lo_id) THEN
    RAISE EXCEPTION 'LO ini belum punya item produk.';
  END IF;

  IF v_lo.so_id IS NOT NULL THEN
    SELECT * INTO v_so FROM t_surat_orders WHERE id = v_lo.so_id;
  END IF;

  -- ── 1) Jurnal: Dr. Persediaan / Cr. Uang Muka BBM per produk ──
  v_journal_no := 'JV-LO-' || upper(substr(md5(random()::text), 1, 6));
  INSERT INTO t_journals (company_id, branch_id, supplier_id, journal_number, journal_date, reference_type, reference_id, notes, total_debit, total_kredit, status, created_by)
  VALUES (v_lo.company_id, v_lo.branch_id, v_so.supplier_id, v_journal_no, v_lo.receive_date, 'lo_receipt', p_lo_id,
          'Penerimaan LO ' || v_lo.lo_number || COALESCE(' (SO ' || v_so.so_number || ')', ''), 0, 0, 'posted', p_user_name)
  RETURNING id INTO v_journal_id;

  FOR rec IN
    SELECT it.product_id, p.product_name, p.coa_persediaan, p.coa_uang_muka, p.current_price,
           it.vol_received, it.vol_lo,
           soi.unit_price AS so_unit_price, soi.margin_per_liter AS so_margin
    FROM t_lo_receipt_items it
    JOIN m_fuel_products p ON p.id = it.product_id
    LEFT JOIN t_surat_order_items soi ON soi.so_id = v_lo.so_id AND soi.product_id = it.product_id
    WHERE it.lo_id = p_lo_id
  LOOP
    v_vol := COALESCE(rec.vol_received, rec.vol_lo, 0);
    v_price := COALESCE(rec.so_unit_price, rec.current_price, 0) + COALESCE(rec.so_margin, 0);
    v_val := v_vol * v_price;
    IF v_val > 0 AND rec.coa_persediaan IS NOT NULL AND rec.coa_uang_muka IS NOT NULL THEN
      INSERT INTO t_journal_items (journal_id, coa_id, debit, kredit, description)
      VALUES (v_journal_id, rec.coa_persediaan, v_val, 0, 'Persediaan ' || rec.product_name || ' - LO ' || v_lo.lo_number);
      INSERT INTO t_journal_items (journal_id, coa_id, debit, kredit, description)
      VALUES (v_journal_id, rec.coa_uang_muka, 0, v_val, 'Realisasi Uang Muka ' || rec.product_name || ' - LO ' || v_lo.lo_number);
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(kredit), 0) INTO v_total_debit, v_total_kredit
  FROM t_journal_items WHERE journal_id = v_journal_id;

  IF v_total_debit <= 0 THEN
    RAISE EXCEPTION 'Jurnal LO gagal dibuat: akun COA Persediaan/Uang Muka produk belum lengkap atau harga 0.';
  END IF;

  UPDATE t_journals SET total_debit = v_total_debit, total_kredit = v_total_kredit, updated_at = now()
  WHERE id = v_journal_id;

  -- ── 2) Recompute stok tangki yang tersentuh ──
  SELECT array_agg(DISTINCT tank_id) INTO v_tank_ids FROM t_lo_receipt_items WHERE lo_id = p_lo_id AND tank_id IS NOT NULL;
  IF v_tank_ids IS NOT NULL THEN
    FOREACH v_tank_id IN ARRAY v_tank_ids LOOP
      PERFORM fn_recompute_tank_stock(v_tank_id);
    END LOOP;
  END IF;

  -- ── 3) Sinkronisasi penyelesaian SO (kalau LO tertaut ke SO) ──
  IF v_lo.so_id IS NOT NULL THEN
    FOR rec IN
      SELECT soi.id, soi.product_id, soi.vol_order,
             COALESCE((
               SELECT SUM(it2.vol_lo)
               FROM t_lo_receipts lo2
               JOIN t_lo_receipt_items it2 ON it2.lo_id = lo2.id
               WHERE lo2.so_id = v_lo.so_id AND lo2.status IN ('received', 'verified') AND it2.product_id = soi.product_id
             ), 0) AS sent
      FROM t_surat_order_items soi
      WHERE soi.so_id = v_lo.so_id
    LOOP
      UPDATE t_surat_order_items SET vol_received_total = rec.sent WHERE id = rec.id;
      IF rec.sent < COALESCE(rec.vol_order, 0) - 0.5 THEN
        v_all_complete := false;
      END IF;
    END LOOP;

    v_new_so_status := CASE WHEN v_all_complete THEN 'received' ELSE 'approved' END;
    UPDATE t_surat_orders
    SET status = v_new_so_status, lo_number = v_lo.lo_number, lo_date = v_lo.receive_date, updated_at = now()
    WHERE id = v_lo.so_id;
  END IF;

  RETURN jsonb_build_object(
    'lo_id', p_lo_id,
    'lo_number', v_lo.lo_number,
    'journal_id', v_journal_id,
    'total_debit', v_total_debit,
    'total_kredit', v_total_kredit,
    'so_status', v_new_so_status
  );
END;
$$;
