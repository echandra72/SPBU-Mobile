import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { listReceivables, Receivable } from '../../lib/api-receivables';
import { Badge, Card } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

function fc(n: number) {
  return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
}

export default function ReceivablesListScreen() {
  const { session } = useSession();
  const [rows, setRows] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.branchId) return;
    const data = await listReceivables(session.branchId);
    setRows(data);
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
      <Stack.Screen options={{ headerShown: true, title: 'Piutang / Kupon Konsumen' }} />
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
              <Text style={styles.emptyText}>Belum ada piutang dicatat.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.voucherNo}>{item.voucher_no || '-'}</Text>
                <Badge label="Posted" tone="emerald" />
              </View>
              <Text style={styles.custName}>{item.customer_name}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.detailText}>
                  {new Date(item.date).toLocaleDateString('id-ID')} · {Number(item.qty).toLocaleString('id-ID')} L
                </Text>
                <Text style={styles.amount}>{fc(item.total_amount)}</Text>
              </View>
              {item.vehicle_no ? <Text style={styles.vehicleText}>{item.vehicle_no} · {item.driver_name || '-'}</Text> : null}
            </Card>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/receivables/new')}>
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
  voucherNo: { fontSize: 13, fontWeight: '700', color: colors.emerald700, fontFamily: 'monospace' },
  custName: { fontSize: 13.5, fontWeight: '700', color: colors.slate800, marginBottom: 4 },
  detailText: { fontSize: 11.5, color: colors.slate500 },
  amount: { fontSize: 13, fontWeight: '800', color: colors.slate800, fontFamily: 'monospace' },
  vehicleText: { fontSize: 10.5, color: colors.slate400, marginTop: 4, textTransform: 'uppercase' },
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
