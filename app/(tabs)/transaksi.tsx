import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useSession } from '../../lib/SessionContext';
import { colors, radius } from '../../lib/theme';

// Setara "Transaksi Khusus" di sidebar web — nama ikon sama persis
// (Material Symbols di web, MaterialIcons di sini, glyph identik).
const MODULES: { label: string; sub: string; route: string; icon: keyof typeof MaterialIcons.glyphMap; color: string; bg: string }[] = [
  { label: 'Piutang SPBU', sub: 'Piutang konsumen SPBU', route: '/receivables', icon: 'receipt-long', color: colors.emerald700, bg: colors.emerald50 },
  { label: 'Setoran EDC/QRIS/E-Wallet', sub: 'Transaksi non-tunai', route: '/edc', icon: 'credit-card', color: colors.blue600, bg: colors.blue50 },
  { label: 'E-BBM Polres', sub: 'Voucher BBM instansi', route: '/ebbm', icon: 'local-police', color: colors.emerald700, bg: colors.emerald50 },
  { label: 'Test Nozzle (Tera)', sub: 'Tera / kalibrasi', route: '/testnozzle', icon: 'speed', color: colors.blue600, bg: colors.blue50 },
];

export default function TransaksiScreen() {
  const { session } = useSession();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Transaksi Khusus</Text>
        <Text style={styles.subtitle}>{session?.fullName}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {MODULES.map((m) => (
            <Pressable key={m.route} style={styles.card} onPress={() => router.push(m.route as any)}>
              <View style={[styles.iconBox, { backgroundColor: m.bg }]}>
                <MaterialIcons name={m.icon} size={22} color={m.color} />
              </View>
              <Text style={styles.cardLabel}>{m.label}</Text>
              <Text style={styles.cardSub}>{m.sub}</Text>
            </Pressable>
          ))}
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
  iconBox: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardLabel: { fontSize: 13.5, fontWeight: '700', color: colors.slate800 },
  cardSub: { fontSize: 10.5, color: colors.slate400, marginTop: 2 },
});
