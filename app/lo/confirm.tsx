import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { listFuelProducts, getBranchCode, FuelProduct } from '../../lib/api';
import { listPendingSO, listTanks, createLoReceipt, confirmLoReceipt, SuratOrder, Tank, LoReceiptItem } from '../../lib/api-lo';
import { Card, PrimaryButton } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function KonfirmasiLOScreen() {
  const { soId } = useLocalSearchParams<{ soId: string }>();
  const { session } = useSession();
  const [so, setSo] = useState<SuratOrder | null>(null);
  const [products, setProducts] = useState<FuelProduct[]>([]);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [truckNo, setTruckNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [volInputs, setVolInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session?.branchId || !soId) return;
    setLoading(true);
    const [soList, prods, tankList] = await Promise.all([
      listPendingSO(session.branchId),
      listFuelProducts(session.companyId),
      listTanks(session.branchId),
    ]);
    const found = soList.find((s) => s.id === soId) || null;
    setSo(found);
    setProducts(prods);
    setTanks(tankList);
    setLoading(false);
  }, [session, soId]);

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

  if (!so) {
    return (
      <SafeAreaView style={styles.center}>
        <Stack.Screen options={{ headerShown: true, title: 'Konfirmasi Penerimaan LO' }} />
        <Text style={styles.emptyText}>Surat Order tidak ditemukan atau sudah tidak menunggu penerimaan.</Text>
      </SafeAreaView>
    );
  }

  const onSubmit = async () => {
    if (!truckNo.trim()) {
      Alert.alert('Wajib diisi', 'No. Truk wajib diisi.');
      return;
    }
    const missing = so.items.find((it) => !volInputs[it.id] || isNaN(parseFloat(volInputs[it.id])));
    if (missing) {
      Alert.alert('Belum lengkap', 'Semua produk wajib diisi volume diterima.');
      return;
    }

    setSaving(true);
    try {
      const items: LoReceiptItem[] = so.items.map((it) => {
        const tank = tanks.find((t) => t.product_id === it.product_id);
        return {
          product_id: it.product_id,
          tank_id: tank?.id || null,
          vol_lo: it.vol_order,
          vol_received: parseFloat(volInputs[it.id]),
        };
      });

      const branchCode = await getBranchCode(session.branchId);
      const lo = await createLoReceipt({
        companyId: session.companyId,
        branchId: session.branchId,
        branchCode,
        soId: so.id,
        receiveDate: todayStr(),
        truckNo: truckNo.trim(),
        driverName: driverName.trim() || null,
        items,
      });

      const result = await confirmLoReceipt(lo.id, session.fullName);
      Alert.alert('Berhasil', `LO ${result.lo_number} diterima. Stok tangki & status SO diperbarui.`, [
        { text: 'OK', onPress: () => router.replace('/lo') },
      ]);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Konfirmasi Penerimaan LO' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.soNumber}>No. SO: {so.so_number}</Text>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>No. Truk</Text>
            <TextInput style={styles.input} value={truckNo} onChangeText={setTruckNo} placeholder="BA 8812 EL" />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Nama Sopir</Text>
            <TextInput style={styles.input} value={driverName} onChangeText={setDriverName} placeholder="Opsional" />
          </View>
        </View>

        <Text style={styles.sectionLabel}>VOLUME DITERIMA PER PRODUK</Text>
        {so.items.map((it) => {
          const p = products.find((x) => x.id === it.product_id);
          const tank = tanks.find((t) => t.product_id === it.product_id);
          return (
            <Card key={it.id} style={{ marginBottom: 10 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.productName}>{p?.product_name || '-'}</Text>
                <Text style={styles.orderVol}>Order: {Number(it.vol_order).toLocaleString('id-ID')} L</Text>
              </View>
              <Text style={styles.tankLabel}>Tangki tujuan: {tank ? `${tank.tank_code}${tank.tank_name ? ' — ' + tank.tank_name : ''}` : 'Tidak ditemukan'}</Text>
              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Volume Diterima (L)</Text>
              <TextInput
                style={styles.volInput}
                keyboardType="decimal-pad"
                value={volInputs[it.id] ?? String(it.vol_order)}
                onChangeText={(v) => setVolInputs((prev) => ({ ...prev, [it.id]: v }))}
              />
            </Card>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Konfirmasi Penerimaan" onPress={onSubmit} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20 },
  emptyText: { textAlign: 'center', color: colors.slate400, fontSize: 13 },
  soNumber: { fontSize: 12, color: colors.slate400, fontFamily: 'monospace', marginBottom: 16 },
  row: { flexDirection: 'row', marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '600', color: colors.slate600, marginBottom: 6 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.slate400, marginBottom: 8, letterSpacing: 0.3 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  productName: { fontSize: 13, fontWeight: '700', color: colors.slate800 },
  orderVol: { fontSize: 11, color: colors.slate400 },
  tankLabel: { fontSize: 11.5, color: colors.slate500, marginTop: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: colors.slate400, marginBottom: 4 },
  volInput: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.emerald500,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: 'monospace',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: colors.slate200, backgroundColor: colors.white },
});
