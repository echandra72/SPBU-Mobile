import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../lib/SessionContext';
import { listShifts, ShiftSale } from '../lib/api';
import { useRealtimeRefresh } from '../lib/realtime';
import { Badge, Card } from '../components/ui';
import { colors, radius } from '../lib/theme';

const SHIFT_LABEL: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };

export default function DaftarShiftScreen() {
  const { session, needsBranchSelection, loading: sessionLoading } = useSession();
  const [shifts, setShifts] = useState<ShiftSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) { router.replace('/login'); return; }
    if (needsBranchSelection) router.replace('/pilih-cabang');
  }, [sessionLoading, session, needsBranchSelection]);

  const load = useCallback(async () => {
    if (!session?.branchId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await listShifts(session.branchId);
      setShifts(data);
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat data shift.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.branchId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useRealtimeRefresh(['t_shift_sales'], session?.branchId, load);

  if (sessionLoading || !session || needsBranchSelection) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.emerald600} />
      </SafeAreaView>
    );
  }

  if (!session.branchId) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            Akun Anda belum terhubung ke cabang tertentu. Modul Penjualan Shift memerlukan akun level cabang (SPBU).
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={[styles.header, styles.headerRow]}>
        <View>
          <Text style={styles.title}>Penjualan Shift</Text>
          <Text style={styles.subtitle}>{session.fullName}</Text>
        </View>
        <Pressable style={styles.menuBtn} onPress={() => router.push('/menu')}>
          <View style={styles.menuDot} />
          <View style={styles.menuDot} />
          <View style={styles.menuDot} />
          <View style={styles.menuDot} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald600} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Belum ada shift. Ketuk tombol + untuk membuat shift baru.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                if (item.status === 'draft') router.push(`/shift/${item.id}/dispensers`);
                else router.push(`/shift/${item.id}/detail`);
              }}
            >
              <Card
                style={
                  item.status === 'draft'
                    ? { borderWidth: 2, borderColor: colors.emerald500 }
                    : undefined
                }
              >
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.cardTitle}>
                      {new Date(item.shift_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {'  ·  '}
                      {SHIFT_LABEL[item.shift_type] || item.shift_type}
                    </Text>
                    <Text style={styles.cardMono}>{item.shift_number}</Text>
                  </View>
                  <Badge label={item.status === 'posted' ? 'Posted' : item.status === 'void' ? 'Void' : 'Draft'} tone={item.status === 'posted' ? 'emerald' : item.status === 'void' ? 'red' : 'slate'} />
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/shift/new')}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    padding: 9,
  },
  menuDot: { width: 5, height: 5, borderRadius: 2, backgroundColor: colors.emerald600 },
  title: { fontSize: 21, fontWeight: '800', color: colors.slate900 },
  subtitle: { fontSize: 12, color: colors.slate400, marginTop: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.slate800 },
  cardMono: { fontSize: 10.5, color: colors.slate400, marginTop: 3, fontFamily: 'monospace' },
  emptyText: { textAlign: 'center', color: colors.slate400, fontSize: 13 },
  errorText: { textAlign: 'center', color: colors.red600, fontSize: 13 },
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
