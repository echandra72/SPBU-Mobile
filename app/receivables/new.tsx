import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { listCustomers, resolveShiftCashAccount, saveReceivable, Customer, CoaAccount } from '../../lib/api-receivables';
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

export default function CatatPiutangScreen() {
  const { session } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [shiftType, setShiftType] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [voucherNo, setVoucherNo] = useState('');
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [coaCr, setCoaCr] = useState<CoaAccount | null>(null);
  const [resolvingCoaCr, setResolvingCoaCr] = useState(false);
  const [coaCrError, setCoaCrError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.companyId) return;
    const custs = await listCustomers(session.companyId);
    setCustomers(custs);
    setLoading(false);
  }, [session?.companyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!session?.branchId || !shiftType) {
      setCoaCr(null);
      setCoaCrError(null);
      return;
    }
    let cancelled = false;
    setResolvingCoaCr(true);
    setCoaCrError(null);
    resolveShiftCashAccount(session.branchId, todayStr(), shiftType)
      .then((coa) => {
        if (cancelled) return;
        setCoaCr(coa);
        if (!coa) setCoaCrError('Shift Posted untuk kombinasi ini tidak ditemukan — cek Shift yang dipilih.');
      })
      .catch((e: any) => {
        if (cancelled) return;
        setCoaCr(null);
        setCoaCrError(e?.message || 'Gagal mencari shift.');
      })
      .finally(() => {
        if (!cancelled) setResolvingCoaCr(false);
      });
    return () => { cancelled = true; };
  }, [session?.branchId, shiftType]);

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
    if (!shiftType) {
      Alert.alert('Wajib diisi', 'Pilih shift dulu.');
      return;
    }
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
    if (!coaCr) {
      Alert.alert('Belum bisa disimpan', coaCrError || 'Akun Kas/Bank pengurang belum ditemukan — cek Shift yang dipilih.');
      return;
    }

    setSaving(true);
    try {
      await saveReceivable({
        companyId: session.companyId,
        branchId: session.branchId,
        date: todayStr(),
        shiftType,
        voucherNo: voucherNo.trim(),
        customerId: customer.id,
        coaDrId: customer.coa_ar_control,
        coaCrId: coaCr.id,
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
        <Text style={styles.label}>Shift</Text>
        <View style={styles.chipWrap}>
          {SHIFTS.map((s) => (
            <Pressable key={s.value} onPress={() => setShiftType(s.value)} style={[styles.chip, shiftType === s.value && styles.chipActive]}>
              <Text style={[styles.chipText, shiftType === s.value && styles.chipTextActive]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: 16 }]}>Konsumen / Perusahaan</Text>
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
        <View style={styles.coaCrBox}>
          {resolvingCoaCr ? (
            <ActivityIndicator color={colors.emerald600} size="small" />
          ) : coaCr ? (
            <Text style={styles.coaCrText}>{coaCr.account_code} — {coaCr.account_name}</Text>
          ) : (
            <Text style={styles.coaCrHint}>{shiftType ? (coaCrError || 'Mencari...') : 'Pilih Shift dulu'}</Text>
          )}
        </View>
        <Text style={styles.coaCrNote}>Otomatis ikut akun kas tunai di shift Shift {SHIFTS.find((s) => s.value === shiftType)?.label || ''} hari ini — bukan dipilih manual.</Text>
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
  coaCrBox: {
    backgroundColor: colors.emerald50,
    borderWidth: 1,
    borderColor: colors.emerald300,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  coaCrText: { fontSize: 13.5, fontWeight: '700', color: colors.emerald700 },
  coaCrHint: { fontSize: 12.5, color: colors.amber600 },
  coaCrNote: { fontSize: 10.5, color: colors.slate400, marginTop: 6, lineHeight: 15 },
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
