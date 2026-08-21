-- ================================================================
-- Fungsi bersama untuk Catat Penggunaan Voucher E-BBM Polres — port
-- dari pages/spbu/ebbm-polres.js: createVoucherRecord() (jalur BARU,
-- bukan edit) + upsertStockAndMove(). Reuse fn_get_last_so_unit_price
-- yang sudah ada (dipakai bersama dengan Post Shift) untuk hitung
-- unit_cost (HPP) dari SO terakhir, fallback OSA.
--
-- Scope: hanya "Catat Voucher" (insert baru). Titipan Masuk dan
-- Penyesuaian Susut/Muai TIDAK diikutkan di versi mobile awal ini —
-- keduanya operasi admin yang lebih jarang & lebih cocok tetap di web.
-- ================================================================
CREATE OR REPLACE FUNCTION fn_confirm_ebbm_voucher(
  p_branch_id uuid,
  p_company_id uuid,
  p_product_id uuid,
  p_voucher_no varchar,
  p_date date,
  p_shift_type varchar,
  p_qty numeric,
  p_unit_price numeric,
  p_pembawa_nama varchar,
  p_no_kendaraan varchar,
  p_jenis_kendaraan varchar,
  p_user_name varchar
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_settings       m_ebbm_settings%ROWTYPE;
  v_product        m_fuel_products%ROWTYPE;
  v_current_stock  numeric := 0;
  v_unit_cost      numeric;
  v_cost_source     text;
  v_total_penjualan numeric;
  v_total_hpp       numeric;
  v_journal_id      uuid;
  v_voucher_id      uuid;
  v_balance_after   numeric;
  v_stock_row_id    uuid;
BEGIN
  IF p_qty <= 0 OR p_unit_price <= 0 THEN
    RAISE EXCEPTION 'Qty dan harga jual harus lebih dari 0.';
  END IF;

  SELECT * INTO v_settings FROM m_ebbm_settings WHERE branch_id = p_branch_id;
  IF NOT FOUND OR v_settings.coa_hutang_titipan_id IS NULL OR v_settings.coa_kas_pengurang_id IS NULL THEN
    RAISE EXCEPTION 'Cabang ini belum ada Pengaturan E-BBM Polres (Akun Hutang Titipan / Kas Pengurang).';
  END IF;

  SELECT * INTO v_product FROM m_fuel_products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produk tidak ditemukan.';
  END IF;
  IF v_product.coa_penjualan IS NULL OR v_product.coa_hpp IS NULL THEN
    RAISE EXCEPTION 'Produk "%" belum punya Akun Penjualan/HPP (menu Data Produk BBM).', v_product.product_name;
  END IF;

  SELECT stock_qty, id INTO v_current_stock, v_stock_row_id
  FROM t_ebbm_stock WHERE branch_id = p_branch_id AND product_id = p_product_id;
  v_current_stock := COALESCE(v_current_stock, 0);

  IF p_qty > v_current_stock THEN
    RAISE EXCEPTION 'Qty melebihi sisa titipan (tersedia % Ltr).', v_current_stock;
  END IF;

  SELECT price, source INTO v_unit_cost, v_cost_source
  FROM fn_get_last_so_unit_price(p_product_id, p_branch_id, p_date);
  v_unit_cost := COALESCE(v_unit_cost, 0);

  v_total_penjualan := p_qty * p_unit_price;
  v_total_hpp := p_qty * v_unit_cost;

  -- ── Jurnal 4-baris: Dr Penjualan-korektif? tidak — ikuti persis pola web:
  --    Dr Penjualan (diakui sbg penjualan) / Cr Kas Pengurang (kas titipan berkurang)
  --    Dr Hutang Titipan (pelunasan) / Cr HPP
  INSERT INTO t_journals (company_id, branch_id, journal_number, journal_date, reference_type, reference_id, notes, total_debit, total_kredit, status, created_by)
  VALUES (
    p_company_id, p_branch_id, 'JV-EBBM-' || upper(substr(md5(random()::text), 1, 6)), p_date,
    'EBBM_VOUCHER', NULL,
    'Voucher BBM Polres ' || p_voucher_no || ' - ' || COALESCE(v_product.short_name, v_product.product_name),
    v_total_penjualan + v_total_hpp, v_total_penjualan + v_total_hpp, 'posted', p_user_name
  )
  RETURNING id INTO v_journal_id;

  INSERT INTO t_journal_items (journal_id, coa_id, debit, kredit, description) VALUES
    (v_journal_id, v_product.coa_penjualan, v_total_penjualan, 0, 'Penjualan Voucher ' || p_voucher_no),
    (v_journal_id, v_settings.coa_kas_pengurang_id, 0, v_total_penjualan, 'Kas Voucher ' || p_voucher_no),
    (v_journal_id, v_settings.coa_hutang_titipan_id, v_total_hpp, 0, 'Pelunasan Hutang Titipan Voucher ' || p_voucher_no),
    (v_journal_id, v_product.coa_hpp, 0, v_total_hpp, 'HPP Voucher ' || p_voucher_no);

  INSERT INTO t_ebbm_voucher_usage (
    company_id, branch_id, product_id, voucher_no, date, shift_type, qty,
    pembawa_nama, no_kendaraan, jenis_kendaraan,
    unit_price, unit_cost, total_penjualan, total_hpp, journal_id, status, created_by
  ) VALUES (
    p_company_id, p_branch_id, p_product_id, p_voucher_no, p_date, p_shift_type, p_qty,
    p_pembawa_nama, p_no_kendaraan, p_jenis_kendaraan,
    p_unit_price, v_unit_cost, v_total_penjualan, v_total_hpp, v_journal_id, 'posted', p_user_name
  )
  RETURNING id INTO v_voucher_id;

  UPDATE t_journals SET reference_id = v_voucher_id WHERE id = v_journal_id;

  v_balance_after := v_current_stock - p_qty;
  IF v_stock_row_id IS NOT NULL THEN
    UPDATE t_ebbm_stock SET stock_qty = v_balance_after, updated_at = now() WHERE id = v_stock_row_id;
  ELSE
    INSERT INTO t_ebbm_stock (company_id, branch_id, product_id, stock_qty) VALUES (p_company_id, p_branch_id, p_product_id, v_balance_after);
  END IF;

  INSERT INTO t_ebbm_stock_moves (company_id, branch_id, product_id, direction, qty, balance_after, ref_type, ref_id, moved_at)
  VALUES (p_company_id, p_branch_id, p_product_id, 'out', p_qty, v_balance_after, 'VOUCHER_USAGE', v_voucher_id, p_date);

  RETURN jsonb_build_object(
    'voucher_id', v_voucher_id,
    'voucher_no', p_voucher_no,
    'journal_id', v_journal_id,
    'total_penjualan', v_total_penjualan,
    'total_hpp', v_total_hpp,
    'stock_after', v_balance_after,
    'cost_source', v_cost_source
  );
END;
$$;
