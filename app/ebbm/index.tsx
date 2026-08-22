import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { hasEbbmSettings, listVoucherUsage, VoucherUsage } from '../../lib/api-ebbm';
import { listFuelProducts, FuelProduct } from '../../lib/api';
import { useRealtimeRefresh } from '../../lib/realtime';
import { Card } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

function fc(n: number) {
  return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
}

export default function EbbmListScreen() {
  const { session } = useSession();
  const [rows, setRows] = useState<VoucherUsage[]>([]);
  const [products, setProducts] = useState<FuelProduct[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.branchId) return;
    const [ok, data, prods] = await Promise.all([
      hasEbbmSettings(session.branchId),
      listVoucherUsage(session.branchId),
      listFuelProducts(session.companyId),
    ]);
    setConfigured(ok);
    setRows(data);
    setProducts(prods);
    setLoading(false);
    setRefreshing(false);
  }, [session?.branchId, session?.companyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useRealtimeRefresh(['t_ebbm_voucher_usage'], session?.branchId, load);

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'E-BBM Polres' }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald600} />
        </View>
      ) : !configured ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Cabang ini belum ada Pengaturan E-BBM Polres. Hubungi admin untuk mengaktifkan modul ini.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Belum ada voucher dicatat.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const product = products.find((p) => p.id === item.product_id);
            return (
              <Card>
                <View style={styles.rowBetween}>
                  <Text style={styles.voucherNo}>{item.voucher_no}</Text>
                  <Text style={styles.date}>{new Date(item.date).toLocaleDateString('id-ID')}</Text>
                </View>
                <Text style={styles.productText}>{product?.product_name || '-'} · {Number(item.qty).toLocaleString('id-ID')} L</Text>
                <Text style={styles.amount}>{fc(item.total_penjualan)}</Text>
              </Card>
            );
          }}
        />
      )}

      {configured && (
        <Pressable style={styles.fab} onPress={() => router.push('/ebbm/new')}>
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { textAlign: 'center', color: colors.slate400, fontSize: 13 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  voucherNo: { fontSize: 13, fontWeight: '700', color: colors.slate800, fontFamily: 'monospace' },
  date: { fontSize: 11, color: colors.slate400 },
  productText: { fontSize: 12.5, color: colors.slate600, marginBottom: 4 },
  amount: { fontSize: 14, fontWeight: '800', color: colors.emerald700, fontFamily: 'monospace' },
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
