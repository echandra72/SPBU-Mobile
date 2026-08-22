import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { listPendingSO, listRecentLoReceipts, SuratOrder, LoReceipt } from '../../lib/api-lo';
import { useRealtimeRefresh } from '../../lib/realtime';
import { Badge, Card } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

function fmtL(n: number) {
  return `${Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })} L`;
}

export default function SuratOrderLOScreen() {
  const { session } = useSession();
  const [tab, setTab] = useState<'so' | 'lo'>('so');
  const [pendingSO, setPendingSO] = useState<SuratOrder[]>([]);
  const [recentLO, setRecentLO] = useState<LoReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.branchId) return;
    const [so, lo] = await Promise.all([listPendingSO(session.branchId), listRecentLoReceipts(session.branchId)]);
    setPendingSO(so);
    setRecentLO(lo);
    setLoading(false);
    setRefreshing(false);
  }, [session?.branchId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useRealtimeRefresh(['t_surat_orders', 't_lo_receipts'], session?.branchId, load);

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Penerimaan LO' }} />
      <View style={styles.tabRow}>
        <Pressable style={[styles.tabChip, tab === 'so' && styles.tabChipActive]} onPress={() => setTab('so')}>
          <Text style={[styles.tabChipText, tab === 'so' && styles.tabChipTextActive]}>Outstanding SO</Text>
        </Pressable>
        <Pressable style={[styles.tabChip, tab === 'lo' && styles.tabChipActive]} onPress={() => setTab('lo')}>
          <Text style={[styles.tabChipText, tab === 'lo' && styles.tabChipTextActive]}>Riwayat LO</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald600} />
        </View>
      ) : tab === 'so' ? (
        <FlatList
          data={pendingSO}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Tidak ada Surat Order yang menunggu penerimaan.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.soNumber}>{item.so_number}</Text>
                <Badge label={item.status === 'approved' ? 'Approved' : 'Submitted'} tone={item.status === 'approved' ? 'blue' : 'amber'} />
              </View>
              <Text style={styles.soDetail}>
                {new Date(item.order_date).toLocaleDateString('id-ID')} · {item.items.map((it) => fmtL(it.vol_order)).join(', ')}
              </Text>
              <Pressable style={styles.confirmBtn} onPress={() => router.push(`/lo/confirm?soId=${item.id}`)}>
                <Text style={styles.confirmBtnText}>Konfirmasi Penerimaan</Text>
              </Pressable>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={recentLO}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Belum ada riwayat penerimaan LO.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.soNumber}>{item.lo_number}</Text>
                <Badge label={item.status === 'received' ? 'Diterima' : item.status} tone={item.status === 'received' ? 'emerald' : 'slate'} />
              </View>
              <Text style={styles.soDetail}>
                {new Date(item.receive_date).toLocaleDateString('id-ID')} · Truk {item.truck_no}
              </Text>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  tabChipActive: { backgroundColor: colors.slate200 },
  tabChipText: { fontSize: 12, fontWeight: '600', color: colors.slate400 },
  tabChipTextActive: { color: colors.slate700, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: colors.slate400, fontSize: 13 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  soNumber: { fontSize: 13, fontWeight: '700', color: colors.slate800, fontFamily: 'monospace' },
  soDetail: { fontSize: 12, color: colors.slate500, marginBottom: 10 },
  confirmBtn: { backgroundColor: colors.emerald600, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
