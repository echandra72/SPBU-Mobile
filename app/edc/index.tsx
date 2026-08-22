import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { listEdcTransactions, EdcRow } from '../../lib/api-edc';
import { useRealtimeRefresh } from '../../lib/realtime';
import { Badge, Card } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

const PT_LABEL: Record<string, string> = { edc: 'EDC', qris: 'QRIS', linkaja: 'LinkAja' };

function fc(n: number) {
  return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
}

export default function EdcListScreen() {
  const { session } = useSession();
  const [rows, setRows] = useState<EdcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.branchId) return;
    const data = await listEdcTransactions(session.branchId);
    setRows(data);
    setLoading(false);
    setRefreshing(false);
  }, [session?.branchId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useRealtimeRefresh(['t_spbu_edc'], session?.branchId, load);

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Setoran EDC/QRIS/E-Wallet' }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald600} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Belum ada transaksi non-tunai dicatat.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card>
              <View style={styles.rowBetween}>
                <View style={styles.rowCenter}>
                  <Badge label={PT_LABEL[item.payment_type] || item.payment_type} tone="blue" />
                  <Text style={styles.refNo}>{item.ref_no}</Text>
                </View>
                <Badge label={item.status === 'settled' ? 'Settled' : 'Belum Settle'} tone={item.status === 'settled' ? 'emerald' : 'slate'} />
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.detailText}>
                  {new Date(item.date).toLocaleDateString('id-ID')} · {item.card_no}
                </Text>
                <Text style={styles.amount}>{fc(item.amount)}</Text>
              </View>
            </Card>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/edc/new')}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { textAlign: 'center', color: colors.slate400, fontSize: 13 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refNo: { fontSize: 12.5, fontWeight: '700', color: colors.slate700, fontFamily: 'monospace' },
  detailText: { fontSize: 11.5, color: colors.slate500 },
  amount: { fontSize: 13, fontWeight: '800', color: colors.slate800, fontFamily: 'monospace' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.emerald600,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.emerald600,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '400', marginTop: -2 },
});
