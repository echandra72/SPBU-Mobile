import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../../lib/SessionContext';
import {
  getShift,
  listFuelProducts,
  listBankAccounts,
  addPayment,
  updatePayment,
  deletePayment,
  deleteDraftShift,
  markPrinted,
  postShiftSale,
  ShiftSale,
  FuelProduct,
  BankAccount,
} from '../../../lib/api';
import { router } from 'expo-router';
import { Card, PrimaryButton } from '../../../components/ui';
import { colors, radius } from '../../../lib/theme';

const METHODS = [
  { value: 'tunai', label: 'Tunai' },
  { value: 'edc', label: 'EDC' },
  { value: 'qris', label: 'QRIS' },
  { value: 'piutang', label: 'Piutang' },
];

function fc(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

export default function PembayaranScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const [shift, setShift] = useState<ShiftSale | null>(null);
  const [products, setProducts] = useState<FuelProduct[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id || !session) return;
    setLoading(true);
    const [s, prods, bankAccts] = await Promise.all([
      getShift(id),
      listFuelProducts(session.companyId),
      listBankAccounts(session.companyId),
    ]);
    setShift(s);
    setProducts(prods);
    setBanks(bankAccts);
    setLoading(false);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !shift) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.emerald600} />
      </SafeAreaView>
    );
  }

  const perProduct = new Map<string, { name: string; volume: number; subtotal: number }>();
  shift.details.forEach((d) => {
    if (!d.subtotal) return;
    const p = products.find((x) => x.id === d.product_id);
    const name = p?.product_name || 'Produk';
    const cur = perProduct.get(d.product_id) || { name, volume: 0, subtotal: 0 };
    cur.volume += Number(d.volume) || 0;
    cur.subtotal += Number(d.subtotal) || 0;
    perProduct.set(d.product_id, cur);
  });
  const totalSale = [...perProduct.values()].reduce((a, p) => a + p.subtotal, 0);
  const totalPay = shift.payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const diff = totalPay - totalSale;

  const onAddMethod = async (method: string) => {
    setBusy(true);
    try {
      await addPayment(shift.id, method);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onChangeAmount = async (paymentId: string, text: string) => {
    const val = parseFloat(text.replace(/[^0-9.]/g, ''));
    if (isNaN(val)) return;
    await updatePayment(paymentId, { amount: val });
  };

  const onPickBank = async (paymentId: string, bankId: string) => {
    await updatePayment(paymentId, { bank_coa_id: bankId });
    await load();
  };

  const onRemove = async (paymentId: string) => {
    await deletePayment(paymentId);
    await load();
  };

  const onMarkPrinted = async () => {
    setBusy(true);
    try {
      await markPrinted(shift.id);
      await load();
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal menandai laporan.');
    } finally {
      setBusy(false);
    }
  };

  const onDeleteDraft = () => {
    const message = `Hapus shift draft ${shift.shift_number}? Tindakan ini tidak bisa dibatalkan.`;
    const run = async () => {
      setBusy(true);
      try {
        await deleteDraftShift(shift.id);
        router.replace('/');
      } catch (e: any) {
        Alert.alert('Gagal', e?.message || 'Gagal menghapus draft.');
      } finally {
        setBusy(false);
      }
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) run();
      return;
    }
    Alert.alert('Hapus Draft', message, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ya, Hapus', style: 'destructive', onPress: run },
    ]);
  };

  const onPostShift = () => {
    if (!session) return;
    Alert.alert('Post Shift', `Post shift ${shift.shift_number} sekarang? Tindakan ini tidak bisa dibatalkan.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Ya, Post Shift',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const result = await postShiftSale(shift.id, session.fullName);
            Alert.alert('Berhasil', `Shift ${result.shift_number} berhasil di-Post. Jurnal telah dibuat.`, [
              { text: 'OK', onPress: () => router.replace('/') },
            ]);
          } catch (e: any) {
            Alert.alert('Gagal Post Shift', e?.message || 'Terjadi kesalahan.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Pembayaran & Post Shift' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.sectionLabel}>RINGKASAN PENJUALAN</Text>
          {[...perProduct.values()].map((p) => (
            <View key={p.name} style={styles.rowBetween}>
              <Text style={styles.lineText}>
                {p.name} · {p.volume.toFixed(1)} L
              </Text>
              <Text style={styles.lineAmount}>{fc(p.subtotal)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.totalLabel}>Total Penjualan</Text>
            <Text style={styles.totalAmount}>{fc(totalSale)}</Text>
          </View>
        </Card>

        <Text style={styles.sectionLabel}>METODE PEMBAYARAN</Text>
        <View style={styles.methodRow}>
          {METHODS.map((m) => (
            <Pressable key={m.value} onPress={() => onAddMethod(m.value)} style={styles.methodChip} disabled={busy}>
              <Text style={styles.methodChipText}>+ {m.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 8, marginTop: 10 }}>
          {shift.payments.map((p) => (
            <Card key={p.id} style={{ padding: 12 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.payMethod}>{METHODS.find((m) => m.value === p.method)?.label || p.method}</Text>
                <Pressable onPress={() => onRemove(p.id)}>
                  <Text style={styles.removeText}>Hapus</Text>
                </Pressable>
              </View>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                defaultValue={String(p.amount)}
                onEndEditing={(e) => onChangeAmount(p.id, e.nativeEvent.text)}
              />
              <View style={styles.bankRow}>
                {banks.slice(0, 4).map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => onPickBank(p.id, b.id)}
                    style={[styles.bankChip, p.bank_coa_id === b.id && styles.bankChipActive]}
                  >
                    <Text style={[styles.bankChipText, p.bank_coa_id === b.id && { color: '#fff' }]} numberOfLines={1}>
                      {b.account_name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          ))}
        </View>

        <View style={{ marginTop: 16 }}>
          <Pressable
            onPress={onMarkPrinted}
            disabled={busy || !!shift.printed_at}
            style={[styles.printBox, shift.printed_at && styles.printBoxDone]}
          >
            <Text style={[styles.printBoxText, shift.printed_at && { color: colors.emerald700 }]}>
              {shift.printed_at
                ? `✓ Laporan ditandai sudah dicetak (${new Date(shift.printed_at).toLocaleTimeString('id-ID')})`
                : 'Tandai Laporan Harian Totalisator Sudah Dicetak'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.rowBetween}>
          <Text style={styles.diffLabel}>Total Bayar</Text>
          <Text style={[styles.diffAmount, Math.abs(diff) > 1 && { color: colors.amber600 }]}>
            {fc(totalPay)} {Math.abs(diff) > 1 ? `(selisih ${fc(diff)})` : ''}
          </Text>
        </View>
        <View style={{ height: 10 }} />
        <PrimaryButton
          label="Post Shift"
          onPress={onPostShift}
          loading={busy}
          disabled={!shift.printed_at || Math.abs(diff) > 1 || totalSale <= 0}
        />
        <Pressable onPress={onDeleteDraft} disabled={busy} style={styles.deleteDraftBtn}>
          <Text style={styles.deleteDraftText}>Hapus Draft</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.slate400, marginBottom: 8, letterSpacing: 0.3 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  lineText: { fontSize: 13, color: colors.slate700 },
  lineAmount: { fontSize: 13, fontWeight: '700', color: colors.slate800, fontFamily: 'monospace' },
  divider: { height: 1, backgroundColor: colors.slate200, marginVertical: 8 },
  totalLabel: { fontSize: 13, fontWeight: '700', color: colors.slate800 },
  totalAmount: { fontSize: 16, fontWeight: '800', color: colors.emerald700, fontFamily: 'monospace' },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.emerald500,
    backgroundColor: colors.emerald50,
  },
  methodChipText: { fontSize: 12, fontWeight: '700', color: colors.emerald700 },
  payMethod: { fontSize: 13, fontWeight: '700', color: colors.slate800 },
  removeText: { fontSize: 11, color: colors.red600, fontWeight: '600' },
  amountInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
  },
  bankRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  bankChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.slate200, maxWidth: 140 },
  bankChipActive: { backgroundColor: colors.emerald600, borderColor: colors.emerald600 },
  bankChipText: { fontSize: 10.5, color: colors.slate600 },
  printBox: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.slate300,
    borderRadius: radius.lg,
    padding: 14,
    alignItems: 'center',
  },
  printBoxDone: { backgroundColor: colors.emerald50, borderColor: colors.emerald300, borderStyle: 'solid' },
  printBoxText: { fontSize: 12, fontWeight: '600', color: colors.slate600, textAlign: 'center' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.slate200, backgroundColor: colors.white },
  deleteDraftBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  deleteDraftText: { fontSize: 12.5, fontWeight: '700', color: colors.red600 },
  diffLabel: { fontSize: 12, color: colors.slate500 },
  diffAmount: { fontSize: 13, fontWeight: '700', color: colors.slate800, fontFamily: 'monospace' },
});
