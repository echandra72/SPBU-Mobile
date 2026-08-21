import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import { listTestNozzle, listNozzleOptions, TestNozzleRow, NozzleOption } from '../../lib/api-testnozzle';
import { Card } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

const SHIFT_LABEL: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };

export default function TestNozzleListScreen() {
  const { session } = useSession();
  const [rows, setRows] = useState<TestNozzleRow[]>([]);
  const [nozzles, setNozzles] = useState<NozzleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.branchId) return;
    const [data, nz] = await Promise.all([listTestNozzle(session.branchId), listNozzleOptions(session.branchId)]);
    setRows(data);
    setNozzles(nz);
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
      <Stack.Screen options={{ headerShown: true, title: 'Uji Nozzle (Tera/Kalibrasi)' }} />
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
              <Text style={styles.emptyText}>Belum ada data uji nozzle.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const nz = nozzles.find((n) => n.id === item.nozzle_id);
            return (
              <Card>
                <View style={styles.rowBetween}>
                  <Text style={styles.nozzleTitle}>
                    {nz?.dispenser_code || '-'} · Nozzle {nz?.nozzle_code || '-'}
                  </Text>
                  <Text style={styles.date}>{new Date(item.test_date).toLocaleDateString('id-ID')}</Text>
                </View>
                <Text style={styles.detailText}>
                  {nz?.product_name || '-'} · Shift {SHIFT_LABEL[item.shift_type || ''] || '-'}
                </Text>
                <Text style={styles.volume}>{Number(item.volume_test).toLocaleString('id-ID', { minimumFractionDigits: 3 })} L</Text>
                {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
              </Card>
            );
          }}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/testnozzle/new')}>
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
  nozzleTitle: { fontSize: 13.5, fontWeight: '700', color: colors.slate800 },
  date: { fontSize: 11, color: colors.slate400 },
  detailText: { fontSize: 12, color: colors.slate500, marginBottom: 4 },
  volume: { fontSize: 14, fontWeight: '800', color: colors.emerald700, fontFamily: 'monospace' },
  notes: { fontSize: 11, color: colors.slate400, marginTop: 4, fontStyle: 'italic' },
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
