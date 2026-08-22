import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { listCustomers, listCashCoaAccounts, saveReceivable, Customer, CoaAccount } from '../../lib/api-receivables';
import { PrimaryButton } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CatatPiutangScreen() {
  const { session } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [voucherNo, setVoucherNo] = useState('');
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [coaCrId, setCoaCrId] = useState('');

  const load = useCallback(async () => {
    if (!session?.companyId) return;
    const [custs, cash] = await Promise.all([listCustomers(session.companyId), listCashCoaAccounts(session.companyId)]);
    setCustomers(custs);
    setCashAccounts(cash);
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

  const customer = customers.find((c) => c.id === customerId);
  const qtyNum = parseFloat(qty.replace(',', '.')) || 0;
  const priceNum = parseFloat(unitPrice.replace(',', '.')) || 0;
  const total = qtyNum * priceNum;

  const onSubmit = async () => {
    if (!customer) {
      Alert.alert('Wajib diisi', 'Pilih konsumen/perusahaan dulu.');
      return;
    }
    if (!customer.coa_ar_control) {
      Alert.alert('Belum lengkap', 'Konsumen ini belum disetup Akun Piutangnya di Master. Hubungi admin.');
      return;
    }
    if (!voucherNo.trim() || total <= 0) {
      Alert.alert('Belum lengkap', 'No. Kupon/Voucher dan nilai transaksi wajib diisi.');
      return;
    }
    if (!coaCrId) {
      Alert.alert('Wajib diisi', 'Pilih akun Kas/Bank pengurang.');
      return;
    }

    setSaving(true);
    try {
      await saveReceivable({
        companyId: session.companyId,
        branchId: session.branchId,
        date: todayStr(),
        voucherNo: voucherNo.trim(),
        customerId: customer.id,
        coaDrId: customer.coa_ar_control,
        coaCrId,
        description: description.trim() || null,
        qty: qtyNum,
        unitPrice: priceNum,
        vehicleNo: vehicleNo.trim() || null,
        driverName: driverName.trim() || null,
        customerName: customer.name,
        userName: session.fullName,
      });
      Alert.alert('Berhasil', 'Piutang berhasil dicatat dan diposting.', [{ text: 'OK', onPress: () => router.replace('/receivables') }]);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Catat Piutang SPBU' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Konsumen / Perusahaan</Text>
        <View style={styles.chipWrap}>
          {customers.map((c) => (
            <Pressable key={c.id} onPress={() => setCustomerId(c.id)} style={[styles.chip, customerId === c.id && styles.chipActive]}>
              <Text style={[styles.chipText, customerId === c.id && styles.chipTextActive]} numberOfLines={1}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
        {customer && !customer.coa_ar_control ? (
          <Text style={styles.warnText}>⚠ Konsumen ini belum punya Akun Piutang di Master.</Text>
        ) : null}

        <Text style={[styles.label, { marginTop: 16 }]}>No. Kupon / Voucher</Text>
        <TextInput style={styles.input} value={voucherNo} onChangeText={setVoucherNo} placeholder="mis. KV-00123" />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Volume (L)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={qty} onChangeText={setQty} placeholder="0" />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Harga Satuan (Rp)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={unitPrice} onChangeText={setUnitPrice} placeholder="0" />
          </View>
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Nominal Piutang</Text>
          <Text style={styles.totalValue}>Rp {Math.round(total).toLocaleString('id-ID')}</Text>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>No. Kendaraan (Opsional)</Text>
            <TextInput style={styles.input} value={vehicleNo} onChangeText={setVehicleNo} placeholder="B 1234 XX" />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Nama Sopir (Opsional)</Text>
            <TextInput style={styles.input} value={driverName} onChangeText={setDriverName} placeholder="Opsional" />
          </View>
        </View>

        <Text style={[styles.label, { marginTop: 16 }]}>Keterangan (Opsional)</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Keterangan produk/transaksi" />

        <Text style={[styles.label, { marginTop: 16 }]}>Akun Kas/Bank Pengurang</Text>
        <View style={styles.chipWrap}>
          {cashAccounts.slice(0, 12).map((a) => (
            <Pressable key={a.id} onPress={() => setCoaCrId(a.id)} style={[styles.chip, coaCrId === a.id && styles.chipActive]}>
              <Text style={[styles.chipText, coaCrId === a.id && styles.chipTextActive]} numberOfLines={1}>
                {a.account_name}
              </Text>
            </Pressable>
          ))}
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
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.slate800,
  },
  row: { flexDirection: 'row', marginTop: 16 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, maxWidth: 170 },
  chipActive: { backgroundColor: colors.emerald600, borderColor: colors.emerald600 },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.slate600 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  warnText: { fontSize: 11.5, color: colors.amber600, marginTop: 8 },
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
