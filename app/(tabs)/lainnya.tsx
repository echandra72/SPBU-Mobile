import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useSession } from '../../lib/SessionContext';
import { colors, radius } from '../../lib/theme';

// Modul yang tidak punya tab sendiri — Beranda/Shift/Transaksi/Laporan
// sekarang jadi tab di bawah (app/(tabs)/_layout.tsx), sisanya di sini.
// Nama ikon sama persis dengan sidebar web (Material Symbols).
const MODULES: { label: string; sub: string; route: string; icon: keyof typeof MaterialIcons.glyphMap; color: string; bg: string }[] = [
  { label: 'Penerimaan LO', sub: 'Penerimaan BBM dari Pertamina', route: '/lo', icon: 'local-shipping', color: colors.amber600, bg: colors.amber50 },
  { label: 'Pengaturan Printer', sub: 'Sambungkan printer struk 80mm', route: '/printer-settings', icon: 'print', color: colors.slate600, bg: colors.slate100 },
];

export default function LainnyaScreen() {
  const { session, logout } = useSession();
  const showGantiCabang = !!session && session.level <= 2;

  const doLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const onLogout = () => {
    // Alert.alert dgn banyak tombol tidak reliable di web (react-native-web) —
    // callback tombol sering tidak terpanggil. Pakai window.confirm di web.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Yakin ingin keluar dari akun ini?')) {
        doLogout();
      }
      return;
    }
    Alert.alert('Keluar', 'Yakin ingin keluar dari akun ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: doLogout },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Lainnya</Text>
        <Text style={styles.subtitle}>{session?.fullName}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {showGantiCabang && (
            <Pressable style={[styles.card, styles.gantiCabangCard]} onPress={() => router.push('/pilih-cabang?mode=ganti')}>
              <View style={[styles.iconBox, { backgroundColor: colors.slate100 }]}>
                <MaterialIcons name="swap-horiz" size={22} color={colors.slate600} />
              </View>
              <Text style={styles.cardLabel}>Ganti Cabang</Text>
              <Text style={styles.cardSub}>Cabang aktif saat ini</Text>
            </Pressable>
          )}
          {MODULES.map((m) => (
            <Pressable key={m.route} style={styles.card} onPress={() => router.push(m.route as any)}>
              <View style={[styles.iconBox, { backgroundColor: m.bg }]}>
                <MaterialIcons name={m.icon} size={22} color={m.color} />
              </View>
              <Text style={styles.cardLabel}>{m.label}</Text>
              <Text style={styles.cardSub}>{m.sub}</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.card, styles.logoutCard]} onPress={onLogout}>
            <View style={[styles.iconBox, { backgroundColor: colors.red50 }]}>
              <MaterialIcons name="logout" size={22} color={colors.red600} />
            </View>
            <Text style={[styles.cardLabel, { color: colors.red600 }]}>Keluar</Text>
            <Text style={styles.cardSub}>Logout dari akun ini</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  title: { fontSize: 21, fontWeight: '800', color: colors.slate900 },
  subtitle: { fontSize: 12, color: colors.slate400, marginTop: 2 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  card: {
    width: '47%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.xl,
    padding: 16,
  },
  gantiCabangCard: { borderStyle: 'dashed', borderColor: colors.slate300 },
  logoutCard: { width: '100%', borderColor: colors.red100 },
  iconBox: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardLabel: { fontSize: 13.5, fontWeight: '700', color: colors.slate800 },
  cardSub: { fontSize: 10.5, color: colors.slate400, marginTop: 2 },
});
