import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { listFuelProducts, getBranchCode, FuelProduct } from '../../lib/api';
import { listSuppliers, createSoDraft, Supplier } from '../../lib/api-so';
import { PrimaryButton } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function BuatSOScreen() {
  const { session } = useSession();
  const [products, setProducts] = useState<FuelProduct[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [volOrder, setVolOrder] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const needDate = addDays(3);

  const load = useCallback(async () => {
    if (!session?.companyId) return;
    const [prods, sups] = await Promise.all([listFuelProducts(session.companyId), listSuppliers(session.companyId)]);
    setProducts(prods);
    setSuppliers(sups);
    if (sups.length === 1) setSupplierId(sups[0].id);
    setLoading(false);
  }, [session?.companyId]);

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

  const vol = parseFloat(volOrder.replace(',', '.')) || 0;
  const price = parseFloat(unitPrice.replace(',', '.')) || 0;

  const onSubmit = async () => {
    if (!productId) {
      Alert.alert('Wajib diisi', 'Pilih produk dulu.');
      return;
    }
    if (!supplierId) {
      Alert.alert('Wajib diisi', 'Pilih supplier dulu.');
      return;
    }
    if (vol <= 0) {
      Alert.alert('Wajib diisi', 'Volume order harus lebih dari 0.');
      return;
    }

    setSaving(true);
    try {
      const branchCode = await getBranchCode(session.branchId);
      const result = await createSoDraft({
        companyId: session.companyId,
        branchId: session.branchId,
        branchCode,
        supplierId,
        productId,
        volOrder: vol,
        unitPrice: price,
        orderDate: todayStr(),
        needDate,
        notes: notes.trim() || null,
        submittedBy: session.fullName,
      });
      Alert.alert(
        'Draft SO Tersimpan',
        `${result.so_number} tersimpan sebagai draft. Admin/back-office perlu meninjau & mengajukan (submit) dari web sebelum bisa ditebus.`,
        [{ text: 'OK', onPress: () => router.replace('/') }]
      );
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Penebusan SO' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            SO dibuat sebagai <Text style={{ fontWeight: '800' }}>Draft</Text> — perlu ditinjau & diajukan dari web oleh admin sebelum bisa ditebus ke Pertamina.
          </Text>
        </View>

        <Text style={[styles.label, { marginTop: 16 }]}>Produk</Text>
        <View style={styles.chipWrap}>
          {products.map((p) => (
            <Pressable key={p.id} onPress={() => setProductId(p.id)} style={[styles.chip, productId === p.id && styles.chipActive]}>
              <Text style={[styles.chipText, productId === p.id && styles.chipTextActive]}>{p.product_name}</Text>
            </Pressable>
          ))}
        </View>

        {suppliers.length > 1 && (
          <>
            <Text style={[styles.label, { marginTop: 16 }]}>Supplier</Text>
            <View style={styles.chipWrap}>
              {suppliers.map((s) => (
                <Pressable key={s.id} onPress={() => setSupplierId(s.id)} style={[styles.chip, supplierId === s.id && styles.chipActive]}>
                  <Text style={[styles.chipText, supplierId === s.id && styles.chipTextActive]}>{s.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Volume Order (Liter)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={volOrder} onChangeText={setVolOrder} placeholder="8000" />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Harga Satuan (Rp, Opsional)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={unitPrice} onChangeText={setUnitPrice} placeholder="0" />
          </View>
        </View>

        <Text style={[styles.label, { marginTop: 16 }]}>Perkiraan Tanggal Kirim</Text>
        <View style={styles.readonlyBox}>
          <Text style={styles.readonlyText}>{new Date(needDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
        </View>

        <Text style={[styles.label, { marginTop: 16 }]}>Catatan (Opsional)</Text>
        <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Catatan untuk admin" />
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Simpan sebagai Draft" onPress={onSubmit} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20 },
  infoBox: { backgroundColor: colors.blue50, borderRadius: radius.lg, padding: 12 },
  infoText: { fontSize: 11.5, color: colors.blue700, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '600', color: colors.slate600, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.emerald600, borderColor: colors.emerald600 },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.slate600 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', marginTop: 16 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  readonlyBox: { backgroundColor: colors.slate100, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12 },
  readonlyText: { fontSize: 14, fontWeight: '600', color: colors.slate600 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: colors.slate200, backgroundColor: colors.white },
});
