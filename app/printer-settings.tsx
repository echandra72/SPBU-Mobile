import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isThermalPrinterAvailable, listPairedPrinters, connectPrinter, getSavedPrinterMac, PairedPrinter } from '../lib/thermal-printer';
import { Card, PrimaryButton } from '../components/ui';
import { colors, radius } from '../lib/theme';

// Printer Bluetooth Classic (SPP) harus SUDAH di-pairing lewat menu Bluetooth
// bawaan Android dulu — layar ini cuma bisa daftar & pilih dari perangkat
// yang sudah ter-pairing, tidak bisa scan perangkat baru dari dalam app.
export default function PrinterSettingsScreen() {
  const [devices, setDevices] = useState<PairedPrinter[]>([]);
  const [savedMac, setSavedMac] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const available = isThermalPrinterAvailable();

  const load = useCallback(async () => {
    if (!available) { setLoading(false); return; }
    setLoading(true);
    try {
      const [list, mac] = await Promise.all([listPairedPrinters(), getSavedPrinterMac()]);
      setDevices(list);
      setSavedMac(mac);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal memuat daftar printer.');
    } finally {
      setLoading(false);
    }
  }, [available]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSelect = async (device: PairedPrinter) => {
    setConnecting(device.inner_mac_address);
    try {
      await connectPrinter(device.inner_mac_address);
      setSavedMac(device.inner_mac_address);
      Alert.alert('Berhasil', `Printer "${device.device_name}" tersambung & disimpan sebagai printer struk.`);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal menyambung ke printer.');
    } finally {
      setConnecting(null);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Pengaturan Printer' }} />

      {!available ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {Platform.OS === 'web'
              ? 'Cetak struk Bluetooth belum didukung dari browser web — gunakan aplikasi mobile.'
              : 'Cetak struk Bluetooth belum didukung di iOS — gunakan perangkat Android.'}
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald600} />
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.inner_mac_address}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={
            <Text style={styles.hint}>
              Pilih printer struk 80mm yang sudah di-pairing lewat Pengaturan Bluetooth HP. Belum kelihatan di
              daftar? Pairing dulu lewat Pengaturan Bluetooth Android, lalu kembali ke sini.
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Belum ada printer Bluetooth yang ter-pairing.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSaved = savedMac === item.inner_mac_address;
            return (
              <Pressable onPress={() => onSelect(item)} disabled={!!connecting}>
                <Card style={isSaved ? { borderWidth: 2, borderColor: colors.emerald500 } : undefined}>
                  <View style={styles.rowBetween}>
                    <View>
                      <Text style={styles.deviceName}>{item.device_name || 'Printer tanpa nama'}</Text>
                      <Text style={styles.deviceMac}>{item.inner_mac_address}</Text>
                    </View>
                    {connecting === item.inner_mac_address ? (
                      <ActivityIndicator color={colors.emerald600} />
                    ) : isSaved ? (
                      <Text style={styles.savedTag}>Aktif</Text>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      )}

      {available && !loading && (
        <View style={styles.footer}>
          <PrimaryButton label="Muat Ulang Daftar" onPress={load} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { fontSize: 12, color: colors.slate500, lineHeight: 17, marginBottom: 4 },
  emptyText: { textAlign: 'center', color: colors.slate400, fontSize: 13 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deviceName: { fontSize: 14, fontWeight: '700', color: colors.slate800 },
  deviceMac: { fontSize: 10.5, color: colors.slate400, marginTop: 3, fontFamily: 'monospace' },
  savedTag: { fontSize: 11, fontWeight: '700', color: colors.emerald600 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.slate200, backgroundColor: colors.white },
});
