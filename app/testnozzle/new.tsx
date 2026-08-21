import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { listNozzleOptions, saveTestNozzle, NozzleOption } from '../../lib/api-testnozzle';
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

export default function TambahTestNozzleScreen() {
  const { session } = useSession();
  const [nozzles, setNozzles] = useState<NozzleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nozzleId, setNozzleId] = useState('');
  const [shiftType, setShiftType] = useState('pagi');
  const [volume, setVolume] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!session?.branchId) return;
    const nz = await listNozzleOptions(session.branchId);
    setNozzles(nz);
    setLoading(false);
  }, [session?.branchId]);

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

  // Kelompokkan nozzle per dispenser, sama seperti visual picker di web.
  const byDispenser = new Map<string, NozzleOption[]>();
  nozzles.forEach((n) => {
    const arr = byDispenser.get(n.dispenser_code) || [];
    arr.push(n);
    byDispenser.set(n.dispenser_code, arr);
  });

  const selected = nozzles.find((n) => n.id === nozzleId);
  const volNum = parseFloat(volume.replace(',', '.')) || 0;

  const onSubmit = async () => {
    if (!nozzleId) {
      Alert.alert('Wajib diisi', 'Pilih nozzle dulu.');
      return;
    }
    if (volNum <= 0) {
      Alert.alert('Wajib diisi', 'Volume test harus lebih dari 0 liter.');
      return;
    }

    setSaving(true);
    try {
      await saveTestNozzle({
        companyId: session.companyId,
        branchId: session.branchId,
        nozzleId,
        testDate: todayStr(),
        shiftType,
        volumeTest: volNum,
        notes: notes.trim() || null,
        createdBy: session.userId,
      });
      Alert.alert('Berhasil', 'Data test nozzle berhasil disimpan.', [{ text: 'OK', onPress: () => router.replace('/testnozzle') }]);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Tambah Test Nozzle' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            BBM dikembalikan ke tangki secara fisik saat uji — cukup catat volume yang dipakai supaya setoran kasir tidak selisih.
          </Text>
        </View>

        <Text style={[styles.label, { marginTop: 16 }]}>Shift</Text>
        <View style={styles.chipRow}>
          {SHIFTS.map((s) => (
            <Pressable key={s.value} onPress={() => setShiftType(s.value)} style={[styles.shiftChip, shiftType === s.value && styles.shiftChipActive]}>
              <Text style={[styles.shiftChipText, shiftType === s.value && styles.shiftChipTextActive]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: 16 }]}>Pilih Nozzle</Text>
        {[...byDispenser.entries()].map(([dispCode, list]) => (
          <View key={dispCode} style={styles.dispGroup}>
            <Text style={styles.dispLabel}>{list[0].dispenser_name} · {dispCode}</Text>
            <View style={styles.chipWrap}>
              {list.map((n) => (
                <Pressable key={n.id} onPress={() => setNozzleId(n.id)} style={[styles.nozzleChip, nozzleId === n.id && styles.nozzleChipActive]}>
                  <View style={[styles.dot, { backgroundColor: n.color_code || colors.slate400 }]} />
                  <Text style={[styles.nozzleChipText, nozzleId === n.id && { color: colors.emerald700, fontWeight: '700' }]}>
                    {n.nozzle_code} / {n.side} · {n.product_name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        {!nozzles.length && <Text style={styles.emptyText}>Tidak ada nozzle di cabang ini.</Text>}

        <Text style={[styles.label, { marginTop: 16 }]}>Volume Test (Liter)</Text>
        <TextInput style={styles.inputBig} keyboardType="decimal-pad" value={volume} onChangeText={setVolume} placeholder="0,000" />

        <Text style={[styles.label, { marginTop: 16 }]}>Keterangan (Opsional)</Text>
        <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Contoh: Kalibrasi pagi, Tera ulang" />
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Simpan Data" onPress={onSubmit} loading={saving} />
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
  chipRow: { flexDirection: 'row', gap: 8 },
  shiftChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white },
  shiftChipActive: { backgroundColor: colors.emerald600, borderColor: colors.emerald600 },
  shiftChipText: { fontSize: 12.5, fontWeight: '600', color: colors.slate600 },
  shiftChipTextActive: { color: '#fff', fontWeight: '700' },
  dispGroup: { marginBottom: 12 },
  dispLabel: { fontSize: 11, fontWeight: '700', color: colors.slate500, marginBottom: 6 },
  chipWrap: { gap: 6 },
  nozzleChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, borderWidth: 2, borderColor: colors.slate200, backgroundColor: colors.white },
  nozzleChipActive: { borderColor: colors.emerald500, backgroundColor: colors.emerald50 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  nozzleChipText: { fontSize: 12.5, color: colors.slate600 },
  emptyText: { fontSize: 12, color: colors.slate400, fontStyle: 'italic' },
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
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: colors.slate200, backgroundColor: colors.white },
});
