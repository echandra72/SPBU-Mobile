import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../../../lib/SessionContext';
import { getShift, listNozzles, listFuelProducts, saveNozzleMeter, ShiftDetail, Nozzle, FuelProduct } from '../../../../lib/api';
import { Card, PrimaryButton } from '../../../../components/ui';
import { colors, radius } from '../../../../lib/theme';

export default function InputMeterScreen() {
  const { id, dispenserId } = useLocalSearchParams<{ id: string; dispenserId: string }>();
  const { session } = useSession();
  const [details, setDetails] = useState<ShiftDetail[]>([]);
  const [nozzles, setNozzles] = useState<Nozzle[]>([]);
  const [products, setProducts] = useState<FuelProduct[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
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
    const initInputs: Record<string, string> = {};
    groupDetails.forEach((d) => {
      if (d.meter_end_1 != null) initInputs[d.id] = String(d.meter_end_1);
    });
    setInputs(initInputs);
    setLoading(false);
  }, [id, session, dispenserId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSave = async (detail: ShiftDetail) => {
    const raw = inputs[detail.id];
    const val = parseFloat((raw || '').replace(',', '.'));
    if (isNaN(val)) return;
    setSaving(detail.id);
    try {
      const updated = await saveNozzleMeter(detail, '1', val);
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
          const filled = d.meter_end_1 != null;
          const volume = d.meter_end_1 != null ? Number(d.volume_1 || 0) : null;
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

              <Text style={styles.fieldLabel}>METER AWAL</Text>
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyText}>{Number(d.meter_start_1).toLocaleString('id-ID', { minimumFractionDigits: 1 })}</Text>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>METER AKHIR</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={inputs[d.id] ?? ''}
                onChangeText={(v) => setInputs((prev) => ({ ...prev, [d.id]: v }))}
                onBlur={() => onSave(d)}
                placeholder="0,0"
                placeholderTextColor={colors.slate300}
              />

              <Text style={[styles.volumeText, volume == null && { color: colors.slate400 }]}>
                {saving === d.id ? 'Menyimpan…' : volume != null ? `Volume: ${volume.toFixed(1)} L` : 'Volume: —'}
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
});
