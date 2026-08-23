import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../../lib/SessionContext';
import {
  getShift,
  listNozzles,
  listFuelProducts,
  listBankAccounts,
  listExpenseCoa,
  getBranchName,
  addShiftExpenseAdjustment,
  ShiftSale,
  Nozzle,
  FuelProduct,
  BankAccount,
  ExpenseCoa,
} from '../../../lib/api';
import { PrimaryButton } from '../../../components/ui';
import { printShiftReport } from '../../../lib/print';
import { Badge, Card } from '../../../components/ui';
import { colors, radius } from '../../../lib/theme';
import { isThermalPrinterAvailable, printReceipt } from '../../../lib/thermal-printer';
import { buildDailySalesReceipt } from '../../../lib/receipt-format';

const SHIFT_LABEL: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };
const METHOD_LABEL: Record<string, string> = { tunai: 'Tunai', edc: 'EDC', qris: 'QRIS', piutang: 'Piutang' };

function fc(n: number) {
  return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
}
function fmtL(n: number) {
  return `${Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })} L`;
}

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const [shift, setShift] = useState<ShiftSale | null>(null);
  const [nozzles, setNozzles] = useState<Nozzle[]>([]);
  const [products, setProducts] = useState<FuelProduct[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [expenseCoaList, setExpenseCoaList] = useState<ExpenseCoa[]>([]);
  const [branchName, setBranchName] = useState('');
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [printingStruk, setPrintingStruk] = useState(false);
  const [adjExpenseCoaId, setAdjExpenseCoaId] = useState<string | null>(null);
  const [adjCreditCoaId, setAdjCreditCoaId] = useState<string | null>(null);
  const [adjAmountText, setAdjAmountText] = useState('');
  const [adjNotesText, setAdjNotesText] = useState('');
  const [adjSubmitting, setAdjSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id || !session) return;
    setLoading(true);
    const [s, nz, prods, bankAccts, expCoas, bName] = await Promise.all([
      getShift(id),
      listNozzles(session.branchId),
      listFuelProducts(session.companyId),
      listBankAccounts(session.companyId),
      listExpenseCoa(session.companyId),
      getBranchName(session.branchId),
    ]);
    setShift(s);
    setNozzles(nz);
    setProducts(prods);
    setBanks(bankAccts);
    setExpenseCoaList(expCoas);
    setBranchName(bName);
    setAdjCreditCoaId(s.payments.map((p) => p.bank_coa_id).filter(Boolean)[0] as string || null);
    setLoading(false);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onCetak = async () => {
    if (!shift) return;
    setPrinting(true);
    try {
      await printShiftReport(shift, nozzles, products, banks, branchName, expenseCoaList);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal mencetak laporan.');
    } finally {
      setPrinting(false);
    }
  };

  const onCetakStruk = async () => {
    if (!shift) return;
    setPrintingStruk(true);
    try {
      const text = buildDailySalesReceipt(shift, nozzles, products, banks, branchName, expenseCoaList);
      await printReceipt(text);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal mencetak struk.');
    } finally {
      setPrintingStruk(false);
    }
  };

  const onSubmitAdjustment = () => {
    if (!shift || !session) return;
    const amount = parseFloat(adjAmountText.replace(/[^0-9.]/g, ''));
    if (!adjExpenseCoaId) { Alert.alert('Gagal', 'Pilih akun Beban.'); return; }
    if (!adjCreditCoaId) { Alert.alert('Gagal', 'Pilih akun Kas/Bank yang dikoreksi.'); return; }
    if (isNaN(amount) || amount <= 0) { Alert.alert('Gagal', 'Nominal harus lebih dari 0.'); return; }

    const expCoa = expenseCoaList.find((c) => c.id === adjExpenseCoaId);
    const creditCoa = banks.find((c) => c.id === adjCreditCoaId);
    const message = `Simpan pengeluaran susulan ${fc(amount)} ke "${expCoa?.account_name}"?\n\nAkan langsung membuat jurnal koreksi:\nDebit ${expCoa?.account_name}\nKredit ${creditCoa?.account_name}\n\nTindakan ini langsung ter-posting dan tidak bisa dibatalkan.`;

    const run = async () => {
      setAdjSubmitting(true);
      try {
        await addShiftExpenseAdjustment({
          shiftId: shift.id,
          expenseCoaId: adjExpenseCoaId,
          creditCoaId: adjCreditCoaId,
          amount,
          notes: adjNotesText.trim() || null,
          userName: session.fullName,
        });
        setAdjExpenseCoaId(null);
        setAdjAmountText('');
        setAdjNotesText('');
        await load();
        Alert.alert('Berhasil', 'Pengeluaran susulan tersimpan & jurnal koreksi dibuat.');
      } catch (e: any) {
        Alert.alert('Gagal', e?.message || 'Gagal menyimpan pengeluaran susulan.');
      } finally {
        setAdjSubmitting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) run();
      return;
    }
    Alert.alert('Pengeluaran Susulan', message, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ya, Simpan', style: 'destructive', onPress: run },
    ]);
  };

  if (loading || !shift) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.emerald600} />
      </SafeAreaView>
    );
  }

  const totalVolume = shift.details.reduce((a, d) => a + (Number(d.volume) || 0), 0);
  const totalSale = shift.details.reduce((a, d) => a + (Number(d.subtotal) || 0), 0);
  const totalPay = shift.payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const totalExpense = shift.expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0);

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: shift.shift_number,
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              {isThermalPrinterAvailable() && (
                <Pressable onPress={onCetakStruk} disabled={printingStruk} hitSlop={10} style={styles.headerPrintBtn}>
                  <Text style={styles.headerPrintText}>{printingStruk ? '...' : 'Struk'}</Text>
                </Pressable>
              )}
              <Pressable onPress={onCetak} disabled={printing} hitSlop={10} style={styles.headerPrintBtn}>
                <Text style={styles.headerPrintText}>{printing ? '...' : 'Cetak'}</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={{ marginBottom: 14 }}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.shiftNumber}>{shift.shift_number}</Text>
              <Text style={styles.shiftMeta}>
                {SHIFT_LABEL[shift.shift_type] || shift.shift_type} ·{' '}
                {new Date(shift.shift_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
              <Text style={styles.shiftMeta}>Operator: {shift.operator_name}</Text>
            </View>
            <Badge
              label={shift.status === 'posted' ? 'Posted' : shift.status === 'void' ? 'Void' : 'Draft'}
              tone={shift.status === 'posted' ? 'emerald' : shift.status === 'void' ? 'red' : 'slate'}
            />
          </View>
          {shift.status === 'void' && (
            <Text style={styles.voidReason}>Alasan void: {shift.void_reason || '—'}</Text>
          )}

          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>NOZZLE</Text>
              <Text style={styles.summaryValue}>{shift.details.length}</Text>
            </View>
            <View style={[styles.summaryBox, { backgroundColor: colors.emerald50 }]}>
              <Text style={styles.summaryLabel}>VOLUME</Text>
              <Text style={[styles.summaryValue, { color: colors.emerald700 }]}>{fmtL(totalVolume)}</Text>
            </View>
            <View style={[styles.summaryBox, { backgroundColor: colors.blue50 }]}>
              <Text style={styles.summaryLabel}>PENJUALAN</Text>
              <Text style={[styles.summaryValue, { color: colors.blue700 }]}>{fc(totalSale)}</Text>
            </View>
            <View style={[styles.summaryBox, { backgroundColor: colors.amber50 }]}>
              <Text style={styles.summaryLabel}>BAYAR</Text>
              <Text style={[styles.summaryValue, { color: colors.amber600 }]}>{fc(totalPay)}</Text>
            </View>
          </View>
        </Card>

        <Text style={styles.sectionLabel}>RINCIAN METER NOZZLE</Text>
        <View style={{ gap: 8, marginBottom: 16 }}>
          {shift.details.map((d) => {
            const nz = nozzles.find((n) => n.id === d.nozzle_id);
            const prod = products.find((p) => p.id === d.product_id);
            return (
              <Card key={d.id} style={{ padding: 12 }}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.nozzleCode}>{nz?.nozzle_code || '—'}</Text>
                    <Text style={styles.nozzleSub}>{nz?.dispenser_code || ''} · {prod?.product_name || '—'}</Text>
                  </View>
                  <Text style={styles.meterTag}>M{d.selected_meter}</Text>
                </View>
                <View style={[styles.rowBetween, { marginTop: 8 }]}>
                  <Text style={styles.lineText}>{fmtL(d.volume)} × {fc(d.unit_price)}</Text>
                  <Text style={styles.lineAmount}>{fc(d.subtotal)}</Text>
                </View>
              </Card>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>RINCIAN PEMBAYARAN</Text>
        <View style={{ gap: 8 }}>
          {shift.payments.map((p) => {
            const bank = banks.find((b) => b.id === p.bank_coa_id);
            return (
              <Card key={p.id} style={{ padding: 12 }}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.payMethod}>{METHOD_LABEL[p.method] || p.method}</Text>
                    {bank && <Text style={styles.nozzleSub}>{bank.account_name}</Text>}
                  </View>
                  <Text style={styles.lineAmount}>{fc(p.amount)}</Text>
                </View>
              </Card>
            );
          })}
        </View>

        {shift.expenses.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>PENGELUARAN LANGSUNG</Text>
            <View style={{ gap: 8 }}>
              {shift.expenses.map((e) => {
                const coa = expenseCoaList.find((c) => c.id === e.expense_coa_id);
                return (
                  <Card key={e.id} style={{ padding: 12 }}>
                    <View style={styles.rowBetween}>
                      <View>
                        <Text style={styles.payMethod}>{coa ? coa.account_name : '—'}</Text>
                        {e.notes && <Text style={styles.nozzleSub}>{e.notes}</Text>}
                      </View>
                      <Text style={[styles.lineAmount, { color: colors.red600 }]}>{fc(e.amount)}</Text>
                    </View>
                  </Card>
                );
              })}
              <View style={styles.rowBetween}>
                <Text style={styles.lineText}>Total Pengeluaran Langsung</Text>
                <Text style={[styles.lineAmount, { color: colors.red600 }]}>{fc(totalExpense)}</Text>
              </View>
            </View>
          </>
        )}

        {shift.status === 'posted' && (
          <Pressable onPress={() => router.push(`/cash-balancing/${shift.id}`)}>
            <Card style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={styles.adjTitle}>Laporan Balancing Kas</Text>
                <Text style={styles.nozzleSub}>Rekonsiliasi kas tunai & hitung fisik uang</Text>
              </View>
              <Text style={styles.headerPrintText}>Buka ›</Text>
            </Card>
          </Pressable>
        )}

        {shift.status === 'posted' && (session?.level ?? 99) <= 2 && (
          <Card style={{ marginTop: 16, borderColor: colors.amber300 }}>
            <Text style={styles.adjTitle}>Pengeluaran Susulan</Text>
            <Text style={styles.adjHint}>
              Untuk biaya yang baru diketahui setelah shift ini di-Post — langsung membuat jurnal koreksi terpisah
              (Debit Beban, Kredit akun Kas/Bank{adjCreditCoaId ? ` ${banks.find((c) => c.id === adjCreditCoaId)?.account_code ?? ''} — ${banks.find((c) => c.id === adjCreditCoaId)?.account_name ?? ''}` : ''}), tanpa mengubah data shift asli.
            </Text>

            <Text style={styles.fieldLabel}>AKUN BEBAN</Text>
            <View style={styles.pickerBox}>
              <Picker
                selectedValue={adjExpenseCoaId ?? ''}
                onValueChange={(v) => setAdjExpenseCoaId(v || null)}
                style={styles.picker}
              >
                <Picker.Item label="— Pilih Akun Beban —" value="" />
                {expenseCoaList.map((c) => (
                  <Picker.Item key={c.id} label={`${c.account_code} — ${c.account_name}`} value={c.id} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>NOMINAL (RP)</Text>
            <TextInput
              style={styles.adjInput}
              keyboardType="numeric"
              value={adjAmountText}
              onChangeText={setAdjAmountText}
              placeholder="0"
              placeholderTextColor={colors.slate300}
            />

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>CATATAN</Text>
            <TextInput
              style={styles.adjInput}
              value={adjNotesText}
              onChangeText={setAdjNotesText}
              placeholder="mis. Fee sopir truk B 1234"
              placeholderTextColor={colors.slate300}
            />

            <View style={{ marginTop: 12 }}>
              <PrimaryButton label="Simpan Pengeluaran Susulan" onPress={onSubmitAdjustment} loading={adjSubmitting} />
            </View>
          </Card>
        )}

        {shift.journal_id && (
          <Text style={styles.journalRef}>Jurnal: {shift.journal_id.slice(0, 8)}…</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50 },
  content: { padding: 16, paddingBottom: 40 },
  headerPrintBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  headerPrintText: { color: colors.emerald600, fontSize: 13, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shiftNumber: { fontSize: 15, fontWeight: '800', color: colors.slate800, fontFamily: 'monospace' },
  shiftMeta: { fontSize: 12, color: colors.slate500, marginTop: 3 },
  voidReason: { fontSize: 11.5, color: colors.red600, fontWeight: '600', marginTop: 8 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  summaryBox: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.slate50, borderRadius: radius.md, padding: 10, alignItems: 'center' },
  summaryLabel: { fontSize: 9, fontWeight: '700', color: colors.slate400 },
  summaryValue: { fontSize: 14, fontWeight: '800', color: colors.slate800, marginTop: 3, fontFamily: 'monospace' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.slate400, marginBottom: 8, letterSpacing: 0.3 },
  nozzleCode: { fontSize: 13.5, fontWeight: '700', color: colors.slate800, fontFamily: 'monospace' },
  nozzleSub: { fontSize: 11, color: colors.slate400, marginTop: 2 },
  meterTag: { fontSize: 10, fontWeight: '700', color: colors.slate500, backgroundColor: colors.slate100, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  lineText: { fontSize: 12, color: colors.slate600 },
  lineAmount: { fontSize: 13, fontWeight: '700', color: colors.blue700, fontFamily: 'monospace' },
  payMethod: { fontSize: 13, fontWeight: '700', color: colors.slate800 },
  journalRef: { fontSize: 10.5, color: colors.slate400, marginTop: 12, fontFamily: 'monospace', textAlign: 'center' },
  adjTitle: { fontSize: 14, fontWeight: '800', color: colors.slate800, marginBottom: 4 },
  adjHint: { fontSize: 11, color: colors.slate500, lineHeight: 15, marginBottom: 10 },
  fieldLabel: { fontSize: 10.5, fontWeight: '700', color: colors.slate400, marginBottom: 6, letterSpacing: 0.3 },
  pickerBox: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    overflow: 'hidden',
    ...(Platform.OS !== 'web' ? { justifyContent: 'center' } : {}),
  },
  picker: Platform.OS === 'web' ? ({ height: 40, border: 'none', paddingHorizontal: 10, fontSize: 13, color: colors.slate800, backgroundColor: 'transparent' } as any) : {},
  adjInput: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.slate800,
  },
});
