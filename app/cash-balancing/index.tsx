import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { listShifts, ShiftSale } from '../../lib/api';
import { Badge, Card } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

const SHIFT_LABEL: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };

// Daftar shift Posted — pintu masuk ke Laporan Balancing Kas per shift.
// Terpisah dari layar Penjualan Shift (daftar semua status) supaya laporan
// balancing tidak bercampur dengan layar laporan harian penjualan BBM.
export default function CashBalancingListScreen() {
  const { session } = useSession();
  const [shifts, setShifts] = useState<ShiftSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.branchId) { setLoading(false); return; }
    const data = await listShifts(session.branchId);
    setShifts(data.filter((s) => s.status === 'posted'));
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
      <Stack.Screen options={{ headerShown: true, title: 'Laporan Balancing Kas' }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald600} />
        </View>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Belum ada shift Posted untuk cabang ini.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/cash-balancing/${item.id}`)}>
              <Card>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.cardTitle}>
                      {new Date(item.shift_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {'  ·  '}
                      {SHIFT_LABEL[item.shift_type] || item.shift_type}
                    </Text>
                    <Text style={styles.cardMono}>{item.shift_number}</Text>
                  </View>
                  <Badge label={item.cash_denominations ? 'Sudah dihitung' : 'Belum dihitung'} tone={item.cash_denominations ? 'emerald' : 'slate'} />
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.slate800 },
  cardMono: { fontSize: 10.5, color: colors.slate400, marginTop: 3, fontFamily: 'monospace' },
  emptyText: { textAlign: 'center', color: colors.slate400, fontSize: 13 },
});
