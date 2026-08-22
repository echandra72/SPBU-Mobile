-- ================================================================
-- Fungsi bersama untuk Post Shift Penjualan BBM — dipanggil dari web
-- (menggantikan logika di pages/spbu/fuel-sales.js: postShift(),
-- generateShiftJournal(), appendHPPToShiftJournal(), getLastSOUnitPrice(),
-- reduceTankStock()/recomputeTankStock() di js/tank-common.js) MAUPUN
-- dari aplikasi mobile (SPBU-Mobile), supaya hanya ada SATU sumber
-- kebenaran untuk perhitungan jurnal & stok tangki saat posting shift.
--
-- v2: tambah dukungan t_shift_expenses (Pengeluaran Langsung Shift —
-- fee sopir, uang makan, dll yang dipotong operator dari setoran sebelum
-- disetor). Validasi & jurnal disesuaikan supaya pengeluaran itu di-debit
-- ke akun Beban masing-masing, bukan hilang jadi "selisih" tak tercatat.
-- ================================================================

-- ----------------------------------------------------------------
-- 1) Hitung ulang current_stock 1 tangki (port persis dari
--    js/tank-common.js:recomputeTankStock) — TIDAK BERUBAH dari v1.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_recompute_tank_stock(p_tank_id uuid)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_tank        m_tanks%ROWTYPE;
  v_open_vol    numeric;
  v_cutoff      date;
  v_lo_in       numeric := 0;
  v_sales_out   numeric := 0;
  v_new_stock   numeric;
BEGIN
  SELECT * INTO v_tank FROM m_tanks WHERE id = p_tank_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT volume, balance_date INTO v_open_vol, v_cutoff
  FROM t_tank_initial_balances
  WHERE tank_id = p_tank_id AND status = 'locked'
  ORDER BY balance_date DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(it.vol_received), 0) INTO v_lo_in
  FROM t_lo_receipts lo
  JOIN t_lo_receipt_items it ON it.lo_id = lo.id
  WHERE lo.branch_id = v_tank.branch_id
    AND lo.status IN ('received', 'verified')
    AND lo.receive_date >= v_cutoff
    AND (
      (it.tank_id IS NOT NULL AND it.tank_id = p_tank_id)
      OR (it.tank_id IS NULL AND it.product_id = v_tank.product_id)
    );

  SELECT COALESCE(SUM(d.volume), 0) INTO v_sales_out
  FROM t_shift_sales s
  JOIN t_shift_sale_details d ON d.shift_sale_id = s.id
  JOIN m_nozzles n ON n.id = d.nozzle_id
  WHERE n.tank_id = p_tank_id
    AND s.branch_id = v_tank.branch_id
    AND s.status = 'posted'
    AND s.shift_date >= v_cutoff;

  v_new_stock := GREATEST(0, v_open_vol + v_lo_in - v_sales_out);
  UPDATE m_tanks SET current_stock = v_new_stock, updated_at = now() WHERE id = p_tank_id;
  RETURN v_new_stock;
END;
$$;

-- ----------------------------------------------------------------
-- 2) Cari harga efektif (HPP per liter) — TIDAK BERUBAH dari v1.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_last_so_unit_price(p_product_id uuid, p_branch_id uuid, p_shift_date date)
RETURNS TABLE(price numeric, source text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_unit_price numeric;
  v_margin     numeric;
  v_vol        numeric;
  v_ppn        numeric;
  v_pbbkb      numeric;
  v_pph        numeric;
  v_hpp        numeric;
  v_osa_bbm    numeric;
  v_osa_vol    numeric;
BEGIN
  SELECT soi.unit_price, soi.margin_per_liter, soi.vol_order, soi.ppn_amount, soi.pbbkb_amount, soi.pph22_amount
  INTO v_unit_price, v_margin, v_vol, v_ppn, v_pbbkb, v_pph
  FROM t_surat_order_items soi
  JOIN t_surat_orders so ON so.id = soi.so_id
  WHERE soi.product_id = p_product_id
    AND so.branch_id = p_branch_id
    AND so.order_date <= p_shift_date
    AND so.status IN ('approved', 'received', 'submitted')
  ORDER BY so.order_date DESC
  LIMIT 1;

  IF FOUND THEN
    v_vol := COALESCE(NULLIF(v_vol, 0), 1);
    v_hpp := COALESCE(v_unit_price, 0) + ((COALESCE(v_ppn, 0) + COALESCE(v_pbbkb, 0) + COALESCE(v_pph, 0)) / v_vol);
    IF v_hpp > 0 THEN
      RETURN QUERY SELECT v_hpp, 'SO'::text;
      RETURN;
    END IF;
  END IF;

  SELECT tib.total_biaya_bbm, tib.volume INTO v_osa_bbm, v_osa_vol
  FROM t_tank_initial_balances tib
  JOIN m_tanks t ON t.id = tib.tank_id
  WHERE t.product_id = p_product_id
    AND tib.branch_id = p_branch_id
    AND tib.balance_date <= p_shift_date
    AND tib.status = 'locked'
  ORDER BY tib.balance_date DESC
  LIMIT 1;

  IF FOUND AND COALESCE(v_osa_vol, 0) > 0 THEN
    RETURN QUERY SELECT (v_osa_bbm / v_osa_vol), 'OSA'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT 0::numeric, 'NONE'::text;
END;
$$;

-- ----------------------------------------------------------------
-- 3) Post Shift — validasi + posting compound (Dr Kas/Bank, Dr Beban
--    Pengeluaran Langsung, Cr Penjualan, Cr PPN, Dr HPP, Cr Persediaan)
--    + update totalizer nozzle + recompute stok tangki, satu transaksi
--    atomik. Return: jsonb {shift_id, shift_number, journal_id, total_amount}
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_post_shift_sale(p_shift_id uuid, p_user_name text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_shift        t_shift_sales%ROWTYPE;
  v_with_ppn     boolean;
  v_total_vol    numeric := 0;
  v_total_sale   numeric := 0;
  v_expected_pay numeric := 0;
  v_pay_count    integer := 0;
  v_total_pay    numeric := 0;
  v_total_expense numeric := 0;
  v_missing      text[];
  v_journal_id   uuid;
  v_journal_no   text;
  v_total_debit  numeric := 0;
  v_total_kredit numeric := 0;
  v_tank_ids     uuid[];
  v_tank_id      uuid;
  rec            record;
  v_price        numeric;
  v_source       text;
  v_line_hpp     numeric;
  v_prod_vol     numeric;
  v_coa_hpp      uuid;
  v_coa_persediaan uuid;
BEGIN
  SELECT * INTO v_shift FROM t_shift_sales WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift tidak ditemukan.';
  END IF;
  IF v_shift.status <> 'draft' THEN
    RAISE EXCEPTION 'Shift ini sudah berstatus "%", tidak bisa di-Post lagi.', v_shift.status;
  END IF;

  -- Validasi 1: SINGLE wajib meter_end_1, DUAL wajib meter_end_1 & meter_end_2
  IF EXISTS (
    SELECT 1 FROM t_shift_sale_details d
    JOIN m_nozzles n ON n.id = d.nozzle_id
    WHERE d.shift_sale_id = p_shift_id
      AND (
        ((n.meter_mode = 'DUAL' OR d.meter_start_2 IS NOT NULL) AND (d.meter_end_1 IS NULL OR d.meter_end_2 IS NULL))
        OR
        ((n.meter_mode <> 'DUAL' AND d.meter_start_2 IS NULL) AND d.meter_end_1 IS NULL)
      )
  ) THEN
    RAISE EXCEPTION 'Ada nozzle yang meter akhirnya belum lengkap diisi.';
  END IF;

  SELECT COALESCE(SUM(volume), 0), COALESCE(SUM(subtotal), 0)
  INTO v_total_vol, v_total_sale
  FROM t_shift_sale_details WHERE shift_sale_id = p_shift_id;

  IF v_total_sale <= 0 THEN
    RAISE EXCEPTION 'Belum ada penjualan. Input meter akhir dulu.';
  END IF;

  v_with_ppn := COALESCE(v_shift.with_ppn, false);

  SELECT COALESCE(SUM(d.subtotal * (1 + (CASE WHEN v_with_ppn THEN COALESCE(p.tarif_ppn, 0) ELSE 0 END) / 100.0)), 0)
  INTO v_expected_pay
  FROM t_shift_sale_details d
  JOIN m_fuel_products p ON p.id = d.product_id
  WHERE d.shift_sale_id = p_shift_id;

  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_pay_count, v_total_pay
  FROM t_shift_payments WHERE shift_sale_id = p_shift_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_expense
  FROM t_shift_expenses WHERE shift_sale_id = p_shift_id;

  IF v_pay_count = 0 THEN
    RAISE EXCEPTION 'Tambah minimal 1 metode pembayaran.';
  END IF;
  IF ABS((v_total_pay + v_total_expense) - v_expected_pay) > 1 THEN
    RAISE EXCEPTION 'Selisih pembayaran: %. Total seharusnya: %.', ((v_total_pay + v_total_expense) - v_expected_pay), v_expected_pay;
  END IF;
  IF EXISTS (SELECT 1 FROM t_shift_payments WHERE shift_sale_id = p_shift_id AND bank_coa_id IS NULL) THEN
    RAISE EXCEPTION 'Pilih akun Bank/Kas untuk setiap pembayaran.';
  END IF;
  IF EXISTS (SELECT 1 FROM t_shift_expenses WHERE shift_sale_id = p_shift_id AND (expense_coa_id IS NULL OR amount <= 0)) THEN
    RAISE EXCEPTION 'Lengkapi akun Beban & nominal untuk setiap pengeluaran langsung (atau hapus baris kosong).';
  END IF;

  IF v_shift.printed_at IS NULL THEN
    RAISE EXCEPTION 'Tandai Laporan Harian Totalisator sudah dicetak dulu sebelum Post Shift.';
  END IF;

  SELECT array_agg(DISTINCT p.product_name) INTO v_missing
  FROM t_shift_sale_details d
  JOIN m_fuel_products p ON p.id = d.product_id
  WHERE d.shift_sale_id = p_shift_id
    AND (
      p.coa_penjualan IS NULL OR p.coa_hpp IS NULL OR p.coa_persediaan IS NULL
      OR (v_with_ppn AND COALESCE(p.tarif_ppn, 0) > 0 AND p.coa_ppn IS NULL)
    );
  IF v_missing IS NOT NULL AND array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'Akun COA belum lengkap untuk produk: %', array_to_string(v_missing, ', ');
  END IF;

  -- ── 1) Update header (compare-and-swap pada status='draft') ──
  UPDATE t_shift_sales
  SET status = 'posted',
      total_volume = v_total_vol,
      total_amount = v_total_sale,
      total_payment = v_total_pay,
      selisih = v_total_sale - (v_total_pay + v_total_expense),
      posted_at = now(),
      posted_by = p_user_name,
      updated_at = now()
  WHERE id = p_shift_id AND status = 'draft';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift sudah di-Post duluan oleh proses lain.';
  END IF;

  -- ── 2) Update last_totalizer nozzle ──
  UPDATE m_nozzles n
  SET last_totalizer = COALESCE(d.meter_end_1, n.last_totalizer),
      last_totalizer_2 = COALESCE(d.meter_end_2, n.last_totalizer_2),
      updated_at = now()
  FROM t_shift_sale_details d
  WHERE d.nozzle_id = n.id AND d.shift_sale_id = p_shift_id;

  -- ── 3) Recompute stok tangki yang tersentuh ──
  SELECT array_agg(DISTINCT n.tank_id) INTO v_tank_ids
  FROM t_shift_sale_details d
  JOIN m_nozzles n ON n.id = d.nozzle_id
  WHERE d.shift_sale_id = p_shift_id;

  IF v_tank_ids IS NOT NULL THEN
    FOREACH v_tank_id IN ARRAY v_tank_ids LOOP
      PERFORM fn_recompute_tank_stock(v_tank_id);
    END LOOP;
  END IF;

  -- ── 4) Jurnal compound: header dulu (total di-update belakangan) ──
  v_journal_no := 'JV-SHIFT-' || upper(substr(md5(random()::text), 1, 6));
  INSERT INTO t_journals (company_id, branch_id, journal_number, journal_date, reference_type, reference_id, notes, total_debit, total_kredit, status, created_by)
  VALUES (v_shift.company_id, v_shift.branch_id, v_journal_no, v_shift.shift_date, 'shift_sale', p_shift_id,
          'Penjualan shift ' || v_shift.shift_number, 0, 0, 'posted', p_user_name)
  RETURNING id INTO v_journal_id;

  -- Dr. Kas/Bank per metode pembayaran
  FOR rec IN
    SELECT bank_coa_id, SUM(amount) AS amt
    FROM t_shift_payments
    WHERE shift_sale_id = p_shift_id AND amount > 0
    GROUP BY bank_coa_id
  LOOP
    INSERT INTO t_journal_items (journal_id, coa_id, debit, kredit, description)
    VALUES (v_journal_id, rec.bank_coa_id, rec.amt, 0, 'Penjualan shift ' || v_shift.shift_number);
  END LOOP;

  -- Dr. Beban per akun (Pengeluaran Langsung — fee sopir, uang makan, dll)
  FOR rec IN
    SELECT expense_coa_id, SUM(amount) AS amt
    FROM t_shift_expenses
    WHERE shift_sale_id = p_shift_id AND amount > 0
    GROUP BY expense_coa_id
  LOOP
    INSERT INTO t_journal_items (journal_id, coa_id, debit, kredit, description)
    VALUES (v_journal_id, rec.expense_coa_id, rec.amt, 0, 'Pengeluaran langsung shift ' || v_shift.shift_number);
  END LOOP;

  -- Cr. Penjualan BBM (+ Cr. PPN Keluaran kalau with_ppn) per produk
  FOR rec IN
    SELECT p.id AS product_id, p.product_name, p.coa_penjualan, p.coa_ppn,
           SUM(d.subtotal) AS dpp,
           SUM(d.subtotal * (CASE WHEN v_with_ppn THEN COALESCE(p.tarif_ppn, 0) ELSE 0 END) / 100.0) AS ppn
    FROM t_shift_sale_details d
    JOIN m_fuel_products p ON p.id = d.product_id
    WHERE d.shift_sale_id = p_shift_id AND d.subtotal > 0
    GROUP BY p.id, p.product_name, p.coa_penjualan, p.coa_ppn
  LOOP
    IF rec.coa_penjualan IS NOT NULL THEN
      INSERT INTO t_journal_items (journal_id, coa_id, debit, kredit, description)
      VALUES (v_journal_id, rec.coa_penjualan, 0, rec.dpp, 'Penjualan ' || rec.product_name || ' shift ' || v_shift.shift_number);
    END IF;
    IF rec.ppn > 0 AND rec.coa_ppn IS NOT NULL THEN
      INSERT INTO t_journal_items (journal_id, coa_id, debit, kredit, description)
      VALUES (v_journal_id, rec.coa_ppn, 0, rec.ppn, 'PPN Keluaran ' || rec.product_name || ' shift ' || v_shift.shift_number);
    END IF;

    -- Dr. HPP / Cr. Persediaan per produk (harga dari SO terakhir, fallback OSA)
    SELECT price, source INTO v_price, v_source
    FROM fn_get_last_so_unit_price(rec.product_id, v_shift.branch_id, v_shift.shift_date);

    SELECT SUM(d2.volume) INTO v_prod_vol
    FROM t_shift_sale_details d2
    WHERE d2.shift_sale_id = p_shift_id AND d2.product_id = rec.product_id;

    IF v_source = 'NONE' THEN
      SELECT COALESCE(SUM(d3.subtotal), 0) INTO v_line_hpp
      FROM t_shift_sale_details d3
      WHERE d3.shift_sale_id = p_shift_id AND d3.product_id = rec.product_id;
    ELSE
      v_line_hpp := COALESCE(v_prod_vol, 0) * v_price;
    END IF;

    IF v_line_hpp > 0 THEN
      SELECT coa_hpp, coa_persediaan INTO v_coa_hpp, v_coa_persediaan
      FROM m_fuel_products WHERE id = rec.product_id;

      IF v_coa_hpp IS NOT NULL THEN
        INSERT INTO t_journal_items (journal_id, coa_id, debit, kredit, description)
        VALUES (v_journal_id, v_coa_hpp, v_line_hpp, 0, 'HPP ' || rec.product_name || ' shift ' || v_shift.shift_number);
      END IF;
      IF v_coa_persediaan IS NOT NULL THEN
        INSERT INTO t_journal_items (journal_id, coa_id, debit, kredit, description)
        VALUES (v_journal_id, v_coa_persediaan, 0, v_line_hpp, 'Persediaan keluar ' || rec.product_name || ' shift ' || v_shift.shift_number);
      END IF;
    END IF;
  END LOOP;

  -- ── 5) Update total jurnal dari SUM baris yang sudah diinsert ──
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(kredit), 0) INTO v_total_debit, v_total_kredit
  FROM t_journal_items WHERE journal_id = v_journal_id;

  UPDATE t_journals SET total_debit = v_total_debit, total_kredit = v_total_kredit, updated_at = now()
  WHERE id = v_journal_id;

  UPDATE t_shift_sales SET journal_id = v_journal_id, hpp_journal_id = v_journal_id WHERE id = p_shift_id;

  RETURN jsonb_build_object(
    'shift_id', p_shift_id,
    'shift_number', v_shift.shift_number,
    'journal_id', v_journal_id,
    'total_amount', v_total_sale,
    'total_debit', v_total_debit,
    'total_kredit', v_total_kredit
  );
END;
$$;
