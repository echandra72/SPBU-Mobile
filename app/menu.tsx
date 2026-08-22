import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';
import { useSession } from '../lib/SessionContext';
import { colors, radius } from '../lib/theme';
import { PrimaryButton } from '../components/ui';

function Icon({ name, color }: { name: string; color: string }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':
      return (
        <Svg {...common}>
          <Path d="M3 9l9-7 9 7" />
          <Path d="M9 22V12h6v10" />
        </Svg>
      );
    case 'fuel':
      return (
        <Svg {...common}>
          <Rect x="1" y="3" width="15" height="13" rx="2" />
          <Path d="M16 8h4l3 3v5h-7" />
          <Circle cx="5.5" cy="18.5" r="2.5" />
          <Circle cx="18.5" cy="18.5" r="2.5" />
        </Svg>
      );
    case 'tank':
      return (
        <Svg {...common}>
          <Rect x="3" y="3" width="18" height="18" rx="2" />
          <Line x1="3" y1="9" x2="21" y2="9" />
        </Svg>
      );
    case 'receipt':
      return (
        <Svg {...common}>
          <Path d="M4 3h16v18l-3-2-2 2-3-2-3 2-2-2-3 2V3z" />
          <Line x1="8" y1="8" x2="16" y2="8" />
          <Line x1="8" y1="12" x2="16" y2="12" />
        </Svg>
      );
    case 'card':
      return (
        <Svg {...common}>
          <Rect x="1" y="4" width="22" height="16" rx="2" />
          <Line x1="1" y1="10" x2="23" y2="10" />
        </Svg>
      );
    case 'edit':
      return (
        <Svg {...common}>
          <Path d="M12 20h9" />
          <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </Svg>
      );
    case 'shield':
      return (
        <Svg {...common}>
          <Path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
        </Svg>
      );
    case 'gauge':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 12l4-3" />
        </Svg>
      );
    case 'logout':
      return (
        <Svg {...common}>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <Path d="M16 17l5-5-5-5" />
          <Line x1="21" y1="12" x2="9" y2="12" />
        </Svg>
      );
    default:
      return null;
  }
}

const MODULES: { label: string; sub: string; route: string; icon: string; color: string; bg: string }[] = [
  { label: 'Beranda', sub: 'Ringkasan & perhatian', route: '/beranda', icon: 'home', color: colors.emerald700, bg: colors.emerald50 },
  { label: 'Penerimaan LO', sub: 'Penerimaan BBM dari Pertamina', route: '/lo', icon: 'fuel', color: colors.amber600, bg: colors.amber50 },
  { label: 'Kartu Stok Tangki', sub: 'Stok & mutasi tangki', route: '/tanks', icon: 'tank', color: colors.blue600, bg: colors.blue50 },
  { label: 'Piutang SPBU', sub: 'Piutang konsumen SPBU', route: '/receivables', icon: 'receipt', color: colors.emerald700, bg: colors.emerald50 },
  { label: 'Setoran EDC/QRIS/E-Wallet', sub: 'Transaksi non-tunai', route: '/edc', icon: 'card', color: colors.blue600, bg: colors.blue50 },
  { label: 'Penebusan SO', sub: 'Surat Order (Penebusan) baru', route: '/so/new', icon: 'edit', color: colors.amber600, bg: colors.amber50 },
  { label: 'E-BBM Polres', sub: 'Voucher BBM instansi', route: '/ebbm', icon: 'shield', color: colors.emerald700, bg: colors.emerald50 },
  { label: 'Test Nozzle (Tera)', sub: 'Tera / kalibrasi', route: '/testnozzle', icon: 'gauge', color: colors.blue600, bg: colors.blue50 },
];

export default function MenuScreen() {
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
    <SafeAreaView style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Menu Lainnya',
          headerRight: () => (
            <Pressable onPress={onLogout} hitSlop={10} style={styles.headerLogoutBtn}>
              <Icon name="logout" color={colors.red600} />
              <Text style={styles.headerLogoutText}>Keluar</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {showGantiCabang && (
            <Pressable style={[styles.card, styles.gantiCabangCard]} onPress={() => router.push('/pilih-cabang?mode=ganti')}>
              <View style={[styles.iconBox, { backgroundColor: colors.slate100 }]}>
                <Icon name="tank" color={colors.slate600} />
              </View>
              <Text style={styles.cardLabel}>Ganti Cabang</Text>
              <Text style={styles.cardSub}>Cabang aktif saat ini</Text>
            </Pressable>
          )}
          {MODULES.map((m) => (
            <Pressable key={m.route} style={styles.card} onPress={() => router.push(m.route as any)}>
              <View style={[styles.iconBox, { backgroundColor: m.bg }]}>
                <Icon name={m.icon} color={m.color} />
              </View>
              <Text style={styles.cardLabel}>{m.label}</Text>
              <Text style={styles.cardSub}>{m.sub}</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.card, styles.logoutCard]} onPress={onLogout}>
            <View style={[styles.iconBox, { backgroundColor: colors.red50 }]}>
              <Icon name="logout" color={colors.red600} />
            </View>
            <Text style={[styles.cardLabel, { color: colors.red600 }]}>Keluar</Text>
            <Text style={styles.cardSub}>Logout dari akun ini</Text>
          </Pressable>
        </View>
        <View style={styles.backWrap}>
          <PrimaryButton label="Kembali ke Penjualan Shift" onPress={() => router.push('/')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
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
  backWrap: { paddingHorizontal: 16, paddingTop: 4 },
  headerLogoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6 },
  headerLogoutText: { color: colors.red600, fontSize: 13, fontWeight: '700' },
  iconBox: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardLabel: { fontSize: 13.5, fontWeight: '700', color: colors.slate800 },
  cardSub: { fontSize: 10.5, color: colors.slate400, marginTop: 2 },
});
