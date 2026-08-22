import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { saveEdcTransaction } from '../../lib/api-edc';
import { PrimaryButton } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

const TYPES = [
  { value: 'edc', label: 'EDC', desc: 'Kartu Debit/Kredit' },
  { value: 'qris', label: 'QRIS', desc: 'QR Code' },
  { value: 'linkaja', label: 'LinkAja', desc: 'Dompet Digital' },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CatatEdcScreen() {
  const { session } = useSession();
  const [paymentType, setPaymentType] = useState<'edc' | 'qris' | 'linkaja'>('qris');
  const [amount, setAmount] = useState('');
  const [cardNo, setCardNo] = useState('');
  const [refNo, setRefNo] = useState('');
  const [operatorName, setOperatorName] = useState(session?.fullName || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!session) return null;

  const onSubmit = async () => {
    const amt = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (!amt || amt <= 0 || !cardNo.trim() || !refNo.trim()) {
      Alert.alert('Belum lengkap', 'Nilai transaksi, No. Kartu/ID, dan No. Referensi wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      await saveEdcTransaction({
        companyId: session.companyId,
        branchId: session.branchId,
        paymentType,
        date: todayStr(),
        amount: amt,
        cardNo: cardNo.trim(),
        refNo: refNo.trim(),
        operatorName: operatorName.trim() || null,
        notes: notes.trim() || null,
        userName: session.fullName,
      });
      Alert.alert('Berhasil', 'Transaksi berhasil dicatat.', [{ text: 'OK', onPress: () => router.replace('/edc') }]);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Catat Setoran EDC/QRIS/E-Wallet' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Jenis Transaksi</Text>
        <View style={styles.typeRow}>
          {TYPES.map((t) => (
            <Pressable key={t.value} onPress={() => setPaymentType(t.value as any)} style={[styles.typeCard, paymentType === t.value && styles.typeCardActive]}>
              <Text style={[styles.typeLabel, paymentType === t.value && { color: colors.emerald700 }]}>{t.label}</Text>
              <Text style={styles.typeDesc}>{t.desc}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: 18 }]}>Nilai Transaksi (Rp)</Text>
        <TextInput style={styles.inputBig} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="0" />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>No. Kartu / ID QRIS</Text>
            <TextInput style={styles.input} value={cardNo} onChangeText={setCardNo} placeholder="Nomor kartu/merchant" />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>No. Referensi</Text>
            <TextInput style={styles.input} value={refNo} onChangeText={setRefNo} placeholder="123456" />
          </View>
        </View>

        <Text style={[styles.label, { marginTop: 16 }]}>Nama Operator (Opsional)</Text>
        <TextInput style={styles.input} value={operatorName} onChangeText={setOperatorName} />

        <Text style={[styles.label, { marginTop: 16 }]}>Catatan (Opsional)</Text>
        <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Catatan tambahan" />
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Simpan Transaksi" onPress={onSubmit} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  content: { padding: 20 },
  label: { fontSize: 12, fontWeight: '600', color: colors.slate600, marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeCard: { flex: 1, borderWidth: 2, borderColor: colors.slate200, borderRadius: radius.lg, padding: 12, backgroundColor: colors.white },
  typeCardActive: { borderColor: colors.emerald500, backgroundColor: colors.emerald50 },
  typeLabel: { fontSize: 13, fontWeight: '800', color: colors.slate700 },
  typeDesc: { fontSize: 10, color: colors.slate400, marginTop: 2 },
  inputBig: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.emerald500,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: colors.slate800,
  },
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
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: colors.slate200, backgroundColor: colors.white },
});
