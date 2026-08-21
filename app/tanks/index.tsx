import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { listTanksForBranch, TankRow } from '../../lib/api-tanks';
import { colors, radius } from '../../lib/theme';

function statusFor(pct: number) {
  if (pct < 15) return { label: 'Kritis', tone: colors.red600, bg: colors.red50, bar: colors.red500, border: colors.red100 };
  if (pct < 30) return { label: 'Rendah', tone: colors.amber600, bg: colors.amber50, bar: colors.amber500, border: colors.amber300 };
  return { label: 'Normal', tone: colors.emerald700, bg: colors.emerald50, bar: colors.emerald500, border: colors.emerald300 };
}

export default function TangkiListScreen() {
  const { session } = useSession();
  const [tanks, setTanks] = useState<TankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.branchId) return;
    const rows = await listTanksForBranch(session.branchId);
    setTanks(rows);
    setLoading(false);
    setRefreshing(false);
  }, [session?.branchId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Kartu Stok Tangki' }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald600} />
        </View>
      ) : (
        <FlatList
          data={tanks}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Tidak ada tangki di cabang ini.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const pct = item.capacity > 0 ? Math.min(100, Math.round((item.current_stock / item.capacity) * 100)) : 0;
            const st = statusFor(pct);
            return (
              <Pressable onPress={() => router.push(`/tanks/${item.id}`)}>
                <View style={[styles.card, { borderColor: st.border }]}>
                  <View style={styles.rowBetween}>
                    <View style={styles.rowCenter}>
                      <View style={styles.dot} />
                      <Text style={styles.tankTitle}>
                        {item.tank_code} · {item.product_name}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.tone }]}>{st.label}</Text>
                    </View>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${pct}%`, backgroundColor: st.bar }]} />
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.stockText}>{item.current_stock.toLocaleString('id-ID')} L</Text>
                    <Text style={styles.capText}>
                      dari {item.capacity.toLocaleString('id-ID')} L · {pct}%
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { textAlign: 'center', color: colors.slate400, fontSize: 13 },
  card: { backgroundColor: colors.white, borderWidth: 2, borderRadius: radius.xl, padding: 15 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.emerald500 },
  tankTitle: { fontSize: 14, fontWeight: '800', color: colors.slate800 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 10, fontWeight: '700' },
  track: { height: 10, backgroundColor: colors.slate100, borderRadius: radius.pill, overflow: 'hidden', marginBottom: 8 },
  fill: { height: '100%', borderRadius: radius.pill },
  stockText: { fontSize: 13, fontWeight: '700', color: colors.slate800, fontFamily: 'monospace' },
  capText: { fontSize: 11, color: colors.slate400 },
});
