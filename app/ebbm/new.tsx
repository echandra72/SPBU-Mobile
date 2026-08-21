import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { listFuelProducts, FuelProduct } from '../../lib/api';
import { listEbbmStock, confirmEbbmVoucher, EbbmStock } from '../../lib/api-ebbm';
import { PrimaryButton } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

const SHIFTS = [
  { value: 'pagi', label: 'Pagi' },
  { value: 'siang', label: 'Siang' },
  { value: 'malam', label: 'Malam' },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CatatVoucherScreen() {
  const { session } = useSession();
  const [products, setProducts] = useState<FuelProduct[]>([]);
  const [stock, setStock] = useState<EbbmStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [productId, setProductId] = useState('');
  const [shiftType, setShiftType] = useState('siang');
  const [voucherNo, setVoucherNo] = useState('');
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [pembawaNama, setPembawaNama] = useState('');
  const [noKendaraan, setNoKendaraan] = useState('');

  const load = useCallback(async () => {
    if (!session?.branchId) return;
    const [prods, stk] = await Promise.all([listFuelProducts(session.companyId), listEbbmStock(session.branchId)]);
    setProducts(prods);
    setStock(stk);
    setLoading(false);
  }, [session?.branchId, session?.companyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !session) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.emerald600} />
      </SafeAreaView>
    );
  }

  const availableStock = stock.find((s) => s.product_id === productId)?.stock_qty ?? null;
  const qtyNum = parseFloat(qty.replace(',', '.')) || 0;
  const priceNum = parseFloat(unitPrice.replace(',', '.')) || 0;
  const total = qtyNum * priceNum;

  const onSubmit = async () => {
    if (!productId) {
      Alert.alert('Wajib diisi', 'Pilih produk dulu.');
      return;
    }
    if (!voucherNo.trim() || qtyNum <= 0 || priceNum <= 0) {
      Alert.alert('Belum lengkap', 'No. Voucher, qty, dan harga jual wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const result = await confirmEbbmVoucher({
        branchId: session.branchId,
        companyId: session.companyId,
        productId,
        voucherNo: voucherNo.trim(),
        date: todayStr(),
        shiftType,
        qty: qtyNum,
        unitPrice: priceNum,
        pembawaNama: pembawaNama.trim() || null,
        noKendaraan: noKendaraan.trim() || null,
        userName: session.fullName,
      });
      Alert.alert('Berhasil', `Voucher ${result.voucher_no} berhasil dicatat dan diposting.`, [
        { text: 'OK', onPress: () => router.replace('/ebbm') },
      ]);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Catat Voucher' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Produk</Text>
        <View style={styles.chipWrap}>
          {products.map((p) => (
            <Pressable key={p.id} onPress={() => setProductId(p.id)} style={[styles.chip, productId === p.id && styles.chipActive]}>
              <Text style={[styles.chipText, productId === p.id && styles.chipTextActive]}>{p.product_name}</Text>
            </Pressable>
          ))}
        </View>
        {productId && (
          <Text style={styles.stockText}>Sisa titipan: {(availableStock ?? 0).toLocaleString('id-ID')} L</Text>
        )}

        <Text style={[styles.label, { marginTop: 16 }]}>Shift</Text>
        <View style={styles.chipRow}>
          {SHIFTS.map((s) => (
            <Pressable key={s.value} onPress={() => setShiftType(s.value)} style={[styles.shiftChip, shiftType === s.value && styles.shiftChipActive]}>
              <Text style={[styles.shiftChipText, shiftType === s.value && styles.shiftChipTextActive]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: 16 }]}>No. Voucher</Text>
        <TextInput style={styles.input} value={voucherNo} onChangeText={setVoucherNo} placeholder="mis. 22794" />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Qty (Liter)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={qty} onChangeText={setQty} placeholder="0" />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Harga Jual/Liter (Rp)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={unitPrice} onChangeText={setUnitPrice} placeholder="0" />
          </View>
        </View>

        {total > 0 && (
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total Penjualan</Text>
            <Text style={styles.totalValue}>Rp {Math.round(total).toLocaleString('id-ID')}</Text>
          </View>
        )}

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Nama Pembawa (Opsional)</Text>
            <TextInput style={styles.input} value={pembawaNama} onChangeText={setPembawaNama} placeholder="AIPTU John Doe" />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>No. Kendaraan (Opsional)</Text>
            <TextInput style={styles.input} value={noKendaraan} onChangeText={setNoKendaraan} placeholder="DB 1234 XY" />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Simpan & Posting" onPress={onSubmit} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20 },
  label: { fontSize: 12, fontWeight: '600', color: colors.slate600, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.emerald600, borderColor: colors.emerald600 },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.slate600 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  stockText: { fontSize: 11.5, color: colors.slate500, marginTop: 6 },
  chipRow: { flexDirection: 'row', gap: 8 },
  shiftChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white },
  shiftChipActive: { backgroundColor: colors.emerald600, borderColor: colors.emerald600 },
  shiftChipText: { fontSize: 12.5, fontWeight: '600', color: colors.slate600 },
  shiftChipTextActive: { color: '#fff', fontWeight: '700' },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  row: { flexDirection: 'row', marginTop: 16 },
  totalBox: {
    marginTop: 16,
    backgroundColor: colors.emerald50,
    borderWidth: 1,
    borderColor: colors.emerald300,
    borderRadius: radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: { fontSize: 12.5, fontWeight: '700', color: colors.emerald700 },
  totalValue: { fontSize: 16, fontWeight: '800', color: colors.emerald700, fontFamily: 'monospace' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: colors.slate200, backgroundColor: colors.white },
});
