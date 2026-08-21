import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../../lib/SessionContext';
import { getShift, listNozzles, listFuelProducts, Nozzle, ShiftSale, FuelProduct } from '../../../lib/api';
import { Badge, PrimaryButton } from '../../../components/ui';
import { colors, radius } from '../../../lib/theme';

type DispenserGroup = {
  dispenserId: string;
  dispenserCode: string;
  nozzles: Nozzle[];
  status: 'complete' | 'partial' | 'empty';
  totalVolume: number;
  productIds: string[];
};

function isDetailComplete(d: any, nz?: Nozzle) {
  const useDual = nz?.meter_mode === 'DUAL' || d.meter_start_2 != null;
  if (useDual) return d.meter_end_1 != null && d.meter_end_2 != null;
  return d.meter_end_1 != null;
}
function isDetailPartial(d: any) {
  return d.meter_end_1 != null || d.meter_end_2 != null;
}

export default function PilihDispenserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const [shift, setShift] = useState<ShiftSale | null>(null);
  const [nozzles, setNozzles] = useState<Nozzle[]>([]);
  const [products, setProducts] = useState<FuelProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !session) return;
    setLoading(true);
    const [s, nz, prods] = await Promise.all([
      getShift(id),
      listNozzles(session.branchId),
      listFuelProducts(session.companyId),
    ]);
    setShift(s);
    setNozzles(nz);
    setProducts(prods);
    setLoading(false);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !shift) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.emerald600} />
      </SafeAreaView>
    );
  }

  const groups: DispenserGroup[] = [];
  const byDispenser = new Map<string, Nozzle[]>();
  nozzles.forEach((n) => {
    const arr = byDispenser.get(n.dispenser_id) || [];
    arr.push(n);
    byDispenser.set(n.dispenser_id, arr);
  });

  byDispenser.forEach((groupNozzles, dispenserId) => {
    const details = shift.details.filter((d) => groupNozzles.some((n) => n.id === d.nozzle_id));
    if (!details.length) return;
    const allComplete = details.every((d) => isDetailComplete(d, groupNozzles.find((n) => n.id === d.nozzle_id)));
    const someFilled = details.some((d) => isDetailPartial(d));
    const status: DispenserGroup['status'] = allComplete ? 'complete' : someFilled ? 'partial' : 'empty';
    const totalVolume = details.reduce((a, d) => a + (Number(d.volume) || 0), 0);
    groups.push({
      dispenserId,
      dispenserCode: groupNozzles[0]?.dispenser_code || '-',
      nozzles: groupNozzles,
      status,
      totalVolume,
      productIds: [...new Set(groupNozzles.map((n) => n.product_id))],
    });
  });
  groups.sort((a, b) => a.dispenserCode.localeCompare(b.dispenserCode));

  const completeCount = groups.filter((g) => g.status === 'complete').length;
  const pct = groups.length ? Math.round((completeCount / groups.length) * 100) : 0;

  const statusStyle = (status: DispenserGroup['status']) => {
    if (status === 'complete') return { bg: colors.emerald50, border: colors.emerald300 };
    if (status === 'partial') return { bg: colors.amber50, border: colors.amber300 };
    return { bg: colors.white, border: colors.slate200 };
  };

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Pilih Dispenser' }} />
      <View style={styles.subHeader}>
        <Text style={styles.subHeaderText}>
          Shift {shift.shift_number} — {new Date(shift.shift_date).toLocaleDateString('id-ID')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {groups.map((g) => {
          const st = statusStyle(g.status);
          const prodNames = g.productIds.map((pid) => products.find((p) => p.id === pid)?.product_name).filter(Boolean);
          return (
            <Pressable
              key={g.dispenserId}
              style={[styles.card, { backgroundColor: st.bg, borderColor: st.border }]}
              onPress={() => router.push(`/shift/${id}/dispenser/${g.dispenserId}`)}
            >
              <View style={styles.rowBetween}>
                <View style={{ flexDirection: 'row', gap: -4 }}>
                  {g.productIds.slice(0, 1).map((pid) => (
                    <View key={pid} style={styles.dot} />
                  ))}
                </View>
                <Badge
                  label={g.status === 'complete' ? 'Lengkap' : g.status === 'partial' ? 'Sebagian' : 'Belum'}
                  tone={g.status === 'complete' ? 'emerald' : g.status === 'partial' ? 'amber' : 'slate'}
                />
              </View>
              <Text style={styles.dispCode}>{g.dispenserCode}</Text>
              <Text style={styles.dispSub}>
                {g.nozzles.length} nozzle · {prodNames.join(', ')}
              </Text>
              <Text style={styles.volLabel}>VOLUME</Text>
              <Text style={[styles.volValue, g.status === 'empty' && { color: colors.slate400 }]}>
                {g.totalVolume > 0 ? `${g.totalVolume.toFixed(1)} L` : '—'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.rowBetween}>
          <Text style={styles.progressText}>
            {completeCount} dari {groups.length} dispenser lengkap
          </Text>
          <Text style={styles.progressPct}>{pct}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <View style={{ height: 12 }} />
        <PrimaryButton
          label="Lanjut ke Pembayaran"
          onPress={() => router.push(`/shift/${id}/payment`)}
          disabled={completeCount === 0}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subHeader: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  subHeaderText: { fontSize: 11, color: colors.slate400 },
  grid: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 24 },
  card: { width: '47%', borderWidth: 2, borderRadius: radius.xl, padding: 13 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.emerald500, borderWidth: 2, borderColor: '#fff' },
  dispCode: { fontSize: 15, fontWeight: '800', color: colors.slate800 },
  dispSub: { fontSize: 10.5, color: colors.slate500, marginTop: 2 },
  volLabel: { fontSize: 9, color: colors.slate400, fontWeight: '600', marginTop: 8 },
  volValue: { fontSize: 12.5, fontWeight: '700', color: colors.emerald700, fontFamily: 'monospace' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.slate200, backgroundColor: colors.white },
  progressText: { fontSize: 11, color: colors.slate500, fontWeight: '600' },
  progressPct: { fontSize: 11, color: colors.emerald600, fontWeight: '700' },
  progressTrack: { height: 6, backgroundColor: colors.slate200, borderRadius: radius.pill, overflow: 'hidden', marginTop: 8 },
  progressFill: { height: '100%', backgroundColor: colors.emerald500, borderRadius: radius.pill },
});
