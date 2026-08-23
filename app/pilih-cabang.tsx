import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../lib/SessionContext';
import { listAccessibleBranches, BranchOption } from '../lib/api';
import { colors, radius } from '../lib/theme';

export default function PilihCabangScreen() {
  const { session, setActiveBranch } = useSession();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const data = await listAccessibleBranches(session.isGodMode, session.companyId);
    setBranches(data);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSelect = async (branchId: string) => {
    setSelecting(branchId);
    await setActiveBranch(branchId);
    router.replace('/beranda');
  };

  if (loading || !session) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.emerald600} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: mode === 'ganti', title: 'Pilih Cabang' }} />
      <View style={styles.header}>
        <Text style={styles.title}>Pilih Cabang</Text>
        <Text style={styles.subtitle}>
          Akun {session.role} bisa mengakses beberapa cabang — pilih salah satu untuk melanjutkan.
        </Text>
      </View>
      <FlatList
        data={branches}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>Tidak ada cabang yang bisa diakses.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onSelect(item.id)} disabled={!!selecting}>
            <View>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardCode}>{item.branch_code}</Text>
            </View>
            {selecting === item.id ? (
              <ActivityIndicator color={colors.emerald600} />
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: colors.slate900 },
  subtitle: { fontSize: 12, color: colors.slate500, marginTop: 4, lineHeight: 17 },
  emptyText: { textAlign: 'center', color: colors.slate400, fontSize: 13 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.xl,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardName: { fontSize: 14, fontWeight: '700', color: colors.slate800 },
  cardCode: { fontSize: 11, color: colors.slate400, marginTop: 2, fontFamily: 'monospace' },
  chevron: { fontSize: 20, color: colors.slate300 },
});
