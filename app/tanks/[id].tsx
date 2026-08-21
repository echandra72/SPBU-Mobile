import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { listTanksForBranch, buildLedgerEvents, TankRow, LedgerEvent } from '../../lib/api-tanks';
import { colors, radius } from '../../lib/theme';

function fc(n: number) {
  return Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function firstDayOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function KartuStokDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const [tank, setTank] = useState<TankRow | null>(null);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const periodStart = firstDayOfMonth();

  const load = useCallback(async () => {
    if (!session?.branchId || !id) return;
    setLoading(true);
    const tanks = await listTanksForBranch(session.branchId);
    const found = tanks.find((t) => t.id === id) || null;
    setTank(found);
    if (found) {
      const ev = await buildLedgerEvents(found);
      setEvents(ev);
    }
    setLoading(false);
  }, [session?.branchId, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !tank) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.emerald600} />
      </SafeAreaView>
    );
  }

  let startBal = 0;
  events.forEach((e) => {
    if (e.mutation_date < periodStart) startBal = e.balance;
  });
  const periodEvents = events.filter((e) => e.mutation_date >= periodStart).reverse();

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: `Kartu Stok ${tank.tank_code}` }} />
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          {tank.product_name} · Bulan ini (sejak {new Date(periodStart).toLocaleDateString('id-ID')})
        </Text>
      </View>

      <View style={styles.openRow}>
        <Text style={styles.openLabel}>Saldo Awal Periode</Text>
        <Text style={styles.openValue}>{fc(startBal)} L</Text>
      </View>

      <FlatList
        data={periodEvents}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>Tidak ada pergerakan stok bulan ini.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowNotes}>{item.notes}</Text>
              <Text style={styles.rowDate}>{new Date(item.mutation_date).toLocaleDateString('id-ID')}</Text>
            </View>
            <Text style={[styles.rowQty, item.qty_in > 0 ? { color: colors.emerald600 } : { color: colors.red500 }]}>
              {item.qty_in > 0 ? `+ ${fc(item.qty_in)}` : `- ${fc(item.qty_out)}`}
            </Text>
            <Text style={styles.rowBalance}>{fc(item.balance)}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { textAlign: 'center', color: colors.slate400, fontSize: 13 },
  infoBox: { paddingHorizontal: 16, paddingTop: 12 },
  infoText: { fontSize: 12, color: colors.slate400 },
  openRow: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: colors.blue50,
    borderRadius: radius.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  openLabel: { fontSize: 12, fontWeight: '700', color: colors.blue700 },
  openValue: { fontSize: 14, fontWeight: '800', color: colors.blue700, fontFamily: 'monospace' },
  row: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowNotes: { fontSize: 12.5, fontWeight: '600', color: colors.slate800 },
  rowDate: { fontSize: 10.5, color: colors.slate400, marginTop: 2 },
  rowQty: { fontSize: 12.5, fontWeight: '700', fontFamily: 'monospace', minWidth: 90, textAlign: 'right' },
  rowBalance: { fontSize: 12.5, fontWeight: '700', color: colors.slate800, fontFamily: 'monospace', minWidth: 80, textAlign: 'right' },
});
