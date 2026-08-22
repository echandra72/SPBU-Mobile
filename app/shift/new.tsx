import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { createShift, findDuplicateShift, getBranchCode } from '../../lib/api';
import { PrimaryButton } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

const SHIFT_TYPES = [
  { value: 'pagi', label: 'Pagi' },
  { value: 'siang', label: 'Siang' },
  { value: 'malam', label: 'Malam' },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function BuatShiftScreen() {
  const { session } = useSession();
  const [date] = useState(todayStr());
  const [shiftType, setShiftType] = useState('siang');
  const [operatorName, setOperatorName] = useState(session?.fullName || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!session?.branchId) return;
    if (!operatorName.trim()) {
      setError('Nama operator wajib diisi.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const dup = await findDuplicateShift(session.branchId, date, shiftType);
      if (dup) {
        setError(`Shift ini sudah ada (${dup.shift_number}). Tidak boleh duplikat.`);
        setLoading(false);
        return;
      }
      const branchCode = await getBranchCode(session.branchId);
      const shift = await createShift({
        branchId: session.branchId,
        branchCode,
        shiftDate: date,
        shiftType,
        operatorName: operatorName.trim(),
        notes: notes.trim() || null,
        createdBy: session.fullName,
      });
      router.replace(`/shift/${shift.id}/dispensers`);
    } catch (e: any) {
      setError(e?.message || 'Gagal membuat shift.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Buat Penjualan Shift' }} />
      <View style={styles.content}>
        <Text style={styles.label}>Tanggal Shift</Text>
        <View style={styles.readonlyBox}>
          <Text style={styles.readonlyText}>{new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
        </View>

        <View style={{ height: 18 }} />
        <Text style={styles.label}>Shift Ke</Text>
        <View style={styles.chipRow}>
          {SHIFT_TYPES.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => setShiftType(t.value)}
              style={[styles.chip, shiftType === t.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, shiftType === t.value && styles.chipTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 18 }} />
        <Text style={styles.label}>Nama Operator</Text>
        <TextInput style={styles.input} value={operatorName} onChangeText={setOperatorName} placeholder="Nama operator" />

        <View style={{ height: 18 }} />
        <Text style={styles.label}>Catatan (Opsional)</Text>
        <TextInput
          style={[styles.input, { minHeight: 64, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Catatan tambahan..."
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.footer}>
        <PrimaryButton label="Buat & Lanjutkan" onPress={onSubmit} loading={loading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  content: { flex: 1, padding: 20 },
  label: { fontSize: 12, fontWeight: '600', color: colors.slate600, marginBottom: 6 },
  readonlyBox: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  readonlyText: { fontSize: 14, fontWeight: '600', color: colors.slate800 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.emerald600, borderColor: colors.emerald600 },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.slate600 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 14,
    color: colors.slate800,
  },
  error: { color: colors.red600, fontSize: 12, marginTop: 14, textAlign: 'center' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: colors.slate200, backgroundColor: colors.white },
});
