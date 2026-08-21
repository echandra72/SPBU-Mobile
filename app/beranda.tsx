import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../lib/SessionContext';
import { listShifts } from '../lib/api';
import { listTanksForBranch } from '../lib/api-tanks';
import { listPendingSO } from '../lib/api-lo';
import { listReceivables } from '../lib/api-receivables';
import { colors, radius } from '../lib/theme';

type Attention = {
  key: string;
  title: string;
  subtitle: string;
  tone: 'red' | 'amber' | 'slate';
  onPress: () => void;
};

export default function BerandaScreen() {
  const { session } = useSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [draftShiftCount, setDraftShiftCount] = useState(0);
  const [criticalTankCount, setCriticalTankCount] = useState(0);
  const [pendingSoCount, setPendingSoCount] = useState(0);
  const [activeReceivableCount, setActiveReceivableCount] = useState(0);
  const [attentions, setAttentions] = useState<Attention[]>([]);

  const load = useCallback(async () => {
    if (!session?.branchId) return;
    const [shifts, tanks, pendingSO, receivables] = await Promise.all([
      listShifts(session.branchId),
      listTanksForBranch(session.branchId),
      listPendingSO(session.branchId),
      listReceivables(session.branchId),
    ]);

    const draftShifts = shifts.filter((s) => s.status === 'draft');
    const criticalTanks = tanks.filter((t) => t.capacity > 0 && t.current_stock / t.capacity < 0.15);
    const lowTanks = tanks.filter((t) => t.capacity > 0 && t.current_stock / t.capacity < 0.3 && t.current_stock / t.capacity >= 0.15);
    const activeReceivables = receivables.filter((r) => r.status === 'posted');

    setDraftShiftCount(draftShifts.length);
    setCriticalTankCount(criticalTanks.length);
    setPendingSoCount(pendingSO.length);
    setActiveReceivableCount(activeReceivables.length);

    const items: Attention[] = [];
    criticalTanks.forEach((t) => {
      const pct = Math.round((t.current_stock / t.capacity) * 100);
      items.push({
        key: `tank-${t.id}`,
        title: `Tangki ${t.tank_code} stok kritis`,
        subtitle: `Sisa ${pct}% dari kapasitas`,
        tone: 'red',
        onPress: () => router.push(`/tanks/${t.id}`),
      });
    });
    lowTanks.forEach((t) => {
      const pct = Math.round((t.current_stock / t.capacity) * 100);
      items.push({
        key: `tank-${t.id}`,
        title: `Tangki ${t.tank_code} stok rendah`,
        subtitle: `Sisa ${pct}% dari kapasitas`,
        tone: 'amber',
        onPress: () => router.push(`/tanks/${t.id}`),
      });
    });
    pendingSO.slice(0, 3).forEach((so) => {
      items.push({
        key: `so-${so.id}`,
        title: `SO ${so.so_number} menunggu penerimaan`,
        subtitle: so.status === 'approved' ? 'Sudah disetujui, siap ditebus' : 'Menunggu persetujuan',
        tone: 'amber',
        onPress: () => router.push('/lo'),
      });
    });
    draftShifts.slice(0, 3).forEach((s) => {
      items.push({
        key: `shift-${s.id}`,
        title: `Shift ${s.shift_number} belum di-post`,
        subtitle: new Date(s.shift_date).toLocaleDateString('id-ID'),
        tone: 'slate',
        onPress: () => router.push(`/shift/${s.id}/dispensers`),
      });
    });

    setAttentions(items);
    setLoading(false);
    setRefreshing(false);
  }, [session?.branchId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading && !session) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.emerald600} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: true, title: 'Beranda' }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald600} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          <Text style={styles.greeting}>{session?.fullName}</Text>

          <View style={styles.statGrid}>
            <Pressable style={styles.statCard} onPress={() => router.push('/')}>
              <Text style={styles.statValue}>{draftShiftCount}</Text>
              <Text style={styles.statLabel}>Shift Draft</Text>
            </Pressable>
            <Pressable style={styles.statCard} onPress={() => router.push('/tanks')}>
              <Text style={[styles.statValue, criticalTankCount > 0 && { color: colors.red600 }]}>{criticalTankCount}</Text>
              <Text style={styles.statLabel}>Tangki Kritis</Text>
            </Pressable>
            <Pressable style={styles.statCard} onPress={() => router.push('/lo')}>
              <Text style={styles.statValue}>{pendingSoCount}</Text>
              <Text style={styles.statLabel}>SO Menunggu</Text>
            </Pressable>
            <Pressable style={styles.statCard} onPress={() => router.push('/receivables')}>
              <Text style={styles.statValue}>{activeReceivableCount}</Text>
              <Text style={styles.statLabel}>Piutang Aktif</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>PERLU PERHATIAN</Text>
          {attentions.length === 0 ? (
            <Text style={styles.emptyText}>Tidak ada yang perlu diperhatikan saat ini.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {attentions.map((a) => (
                <Pressable key={a.key} onPress={a.onPress} style={styles.attentionRow}>
                  <View style={[styles.attentionDot, { backgroundColor: toneColor(a.tone) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attentionTitle}>{a.title}</Text>
                    <Text style={styles.attentionSubtitle}>{a.subtitle}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function toneColor(tone: 'red' | 'amber' | 'slate') {
  if (tone === 'red') return colors.red500;
  if (tone === 'amber') return colors.amber500;
  return colors.slate400;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { fontSize: 19, fontWeight: '800', color: colors.slate900, marginBottom: 16 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { width: '47%', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.xl, padding: 14 },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.slate800, fontFamily: 'monospace' },
  statLabel: { fontSize: 11, color: colors.slate500, marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.slate400, marginBottom: 10, letterSpacing: 0.3 },
  emptyText: { fontSize: 13, color: colors.slate400, textAlign: 'center', paddingVertical: 20 },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    padding: 12,
  },
  attentionDot: { width: 8, height: 8, borderRadius: 4 },
  attentionTitle: { fontSize: 12.5, fontWeight: '700', color: colors.slate800 },
  attentionSubtitle: { fontSize: 11, color: colors.slate400, marginTop: 2 },
  chevron: { fontSize: 18, color: colors.slate300 },
});
