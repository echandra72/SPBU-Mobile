import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../../../lib/SessionContext';
import { getShift, listNozzles, listFuelProducts, saveNozzleMeter, selectMeter, ShiftDetail, Nozzle, FuelProduct } from '../../../../lib/api';
import { Card, PrimaryButton } from '../../../../components/ui';
import { colors, radius } from '../../../../lib/theme';

export default function InputMeterScreen() {
  const { id, dispenserId } = useLocalSearchParams<{ id: string; dispenserId: string }>();
  const { session } = useSession();
  const [details, setDetails] = useState<ShiftDetail[]>([]);
  const [nozzles, setNozzles] = useState<Nozzle[]>([]);
  const [products, setProducts] = useState<FuelProduct[]>([]);
  const [inputs1, setInputs1] = useState<Record<string, string>>({});
  const [inputs2, setInputs2] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispenserCode, setDispenserCode] = useState('');

  const load = useCallback(async () => {
    if (!id || !session || !dispenserId) return;
    setLoading(true);
    const [shift, nz, prods] = await Promise.all([
      getShift(id),
      listNozzles(session.branchId),
      listFuelProducts(session.companyId),
    ]);
    const groupNozzles = nz.filter((n) => n.dispenser_id === dispenserId);
    const nozzleIds = new Set(groupNozzles.map((n) => n.id));
    const groupDetails = shift.details.filter((d) => nozzleIds.has(d.nozzle_id));
    setNozzles(groupNozzles);
    setDetails(groupDetails);
    setProducts(prods);
    setDispenserCode(groupNozzles[0]?.dispenser_code || '-');
    const init1: Record<string, string> = {};
    const init2: Record<string, string> = {};
    groupDetails.forEach((d) => {
      if (d.meter_end_1 != null) init1[d.id] = String(d.meter_end_1);
      if (d.meter_end_2 != null) init2[d.id] = String(d.meter_end_2);
    });
    setInputs1(init1);
    setInputs2(init2);
    setLoading(false);
  }, [id, session, dispenserId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSave = async (detail: ShiftDetail, meterNum: '1' | '2') => {
    const raw = meterNum === '1' ? inputs1[detail.id] : inputs2[detail.id];
    const val = parseFloat((raw || '').replace(',', '.'));
    if (isNaN(val)) return;
    setSaving(`${detail.id}-${meterNum}`);
    try {
      const updated = await saveNozzleMeter(detail, meterNum, val);
      setDetails((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } finally {
      setSaving(null);
    }
  };

  const onSelectMeter = async (detail: ShiftDetail, meter: '1' | '2') => {
    if (detail.selected_meter === meter) return;
    setSaving(`${detail.id}-select`);
    try {
      const updated = await selectMeter(detail, meter);
      setDetails((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.emerald600} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: `Dispenser ${dispenserCode}` }} />
      <ScrollView contentContainerStyle={styles.content}>
        {details.map((d) => {
          const nz = nozzles.find((n) => n.id === d.nozzle_id);
          const product = products.find((p) => p.id === d.product_id);
          const isDual = nz?.meter_mode === 'DUAL';
          const selected = d.selected_meter === '2' ? '2' : '1';
          const filled = isDual ? d.meter_end_1 != null || d.meter_end_2 != null : d.meter_end_1 != null;
          const volume = d.volume != null && (d.meter_end_1 != null || d.meter_end_2 != null) ? Number(d.volume) : null;

          return (
            <Card key={d.id} style={{ marginBottom: 14 }}>
              <View style={styles.rowBetween}>
                <View style={styles.rowCenter}>
                  <View style={styles.dot} />
                  <Text style={styles.nozzleLabel}>
                    Nozzle {nz?.nozzle_code || '-'} · {product?.product_name || '-'}
                  </Text>
                </View>
                <View style={[styles.statusPill, filled ? styles.statusFilled : styles.statusEmpty]}>
                  <Text style={[styles.statusPillText, filled ? { color: colors.emerald800 } : { color: colors.slate400 }]}>
                    {filled ? 'Terisi' : 'Kosong'}
                  </Text>
                </View>
              </View>

              {!isDual ? (
                <>
                  <Text style={styles.fieldLabel}>METER AWAL</Text>
                  <View style={styles.readonlyBox}>
                    <Text style={styles.readonlyText}>{Number(d.meter_start_1).toLocaleString('id-ID', { minimumFractionDigits: 1 })}</Text>
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>METER AKHIR</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={inputs1[d.id] ?? ''}
                    onChangeText={(v) => setInputs1((prev) => ({ ...prev, [d.id]: v }))}
                    onBlur={() => onSave(d, '1')}
                    placeholder="0,0"
                    placeholderTextColor={colors.slate300}
                  />
                </>
              ) : (
                <>
                  <View style={styles.meterBlock}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.meterBlockTitle}>METER 1</Text>
                      <Pressable
                        onPress={() => onSelectMeter(d, '1')}
                        disabled={saving === `${d.id}-select`}
                        style={[styles.useChip, selected === '1' && styles.useChipActive]}
                      >
                        <Text style={[styles.useChipText, selected === '1' && styles.useChipTextActive]}>
                          {selected === '1' ? '✓ Dipakai' : 'Pakai M1'}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.meterRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>AWAL</Text>
                        <View style={styles.readonlyBox}>
                          <Text style={styles.readonlyText}>{Number(d.meter_start_1).toLocaleString('id-ID', { minimumFractionDigits: 1 })}</Text>
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>AKHIR</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="decimal-pad"
                          value={inputs1[d.id] ?? ''}
                          onChangeText={(v) => setInputs1((prev) => ({ ...prev, [d.id]: v }))}
                          onBlur={() => onSave(d, '1')}
                          placeholder="0,0"
                          placeholderTextColor={colors.slate300}
                        />
                      </View>
                    </View>
                    {d.volume_1 != null && <Text style={styles.miniVolume}>Volume M1: {Number(d.volume_1).toFixed(1)} L</Text>}
                  </View>

                  <View style={[styles.meterBlock, { marginTop: 12 }]}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.meterBlockTitle}>METER 2</Text>
                      <Pressable
                        onPress={() => onSelectMeter(d, '2')}
                        disabled={saving === `${d.id}-select`}
                        style={[styles.useChip, selected === '2' && styles.useChipActive]}
                      >
                        <Text style={[styles.useChipText, selected === '2' && styles.useChipTextActive]}>
                          {selected === '2' ? '✓ Dipakai' : 'Pakai M2'}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.meterRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>AWAL</Text>
                        <View style={styles.readonlyBox}>
                          <Text style={styles.readonlyText}>
                            {d.meter_start_2 != null ? Number(d.meter_start_2).toLocaleString('id-ID', { minimumFractionDigits: 1 }) : '—'}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>AKHIR</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="decimal-pad"
                          value={inputs2[d.id] ?? ''}
                          onChangeText={(v) => setInputs2((prev) => ({ ...prev, [d.id]: v }))}
                          onBlur={() => onSave(d, '2')}
                          placeholder="0,0"
                          placeholderTextColor={colors.slate300}
                        />
                      </View>
                    </View>
                    {d.volume_2 != null && <Text style={styles.miniVolume}>Volume M2: {Number(d.volume_2).toFixed(1)} L</Text>}
                  </View>
                </>
              )}

              <Text style={[styles.volumeText, volume == null && { color: colors.slate400 }]}>
                {saving?.startsWith(d.id)
                  ? 'Menyimpan…'
                  : volume != null
                  ? `Volume dipakai (M${selected}): ${volume.toFixed(1)} L`
                  : 'Volume: —'}
              </Text>
            </Card>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Kembali ke Daftar Dispenser" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue500 },
  nozzleLabel: { fontSize: 13, fontWeight: '700', color: colors.slate800 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  statusFilled: { backgroundColor: colors.emerald100 },
  statusEmpty: { backgroundColor: colors.slate100 },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: colors.slate400, marginBottom: 4 },
  readonlyBox: { backgroundColor: colors.slate100, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 10 },
  readonlyText: { fontFamily: 'monospace', fontSize: 14, color: colors.slate500 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.emerald500,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate800,
  },
  volumeText: { marginTop: 10, fontSize: 12, fontWeight: '700', color: colors.emerald700 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: colors.slate200, backgroundColor: colors.white },
  meterBlock: { backgroundColor: colors.slate50, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.slate200 },
  meterBlockTitle: { fontSize: 10.5, fontWeight: '800', color: colors.slate600, letterSpacing: 0.3, marginBottom: 0 },
  meterRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  useChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.slate200 },
  useChipActive: { backgroundColor: colors.emerald600 },
  useChipText: { fontSize: 10, fontWeight: '700', color: colors.slate500 },
  useChipTextActive: { color: '#fff' },
  miniVolume: { marginTop: 8, fontSize: 11, fontWeight: '700', color: colors.slate500 },
});
