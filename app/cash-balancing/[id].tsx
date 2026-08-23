import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/SessionContext';
import {
  getShift,
  listNozzles,
  listFuelProducts,
  listFuelPrices,
  listExpenseCoa,
  getBranchName,
  ShiftSale,
  Nozzle,
  FuelProduct,
  FuelPrice,
  ExpenseCoa,
} from '../../lib/api';
import {
  DENOMS,
  fetchRelatedShiftData,
  calcCashBalancing,
  saveCashDenominations,
  RelatedShiftData,
  BalancingResult,
} from '../../lib/api-cash-balancing';
import { printCashBalancingReport } from '../../lib/print';
import { PrimaryButton } from '../../components/ui';
import { Card } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

function fc(n: number) {
  return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
}

// Laporan Balancing Kas — TERPISAH dari layar detail Penjualan Shift
// (app/shift/[id]/detail.tsx), yang isinya laporan harian penjualan BBM/
// setoran operator. Diakses lewat menu tersendiri > Laporan Balancing Kas.
export default function CashBalancingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const [shift, setShift] = useState<ShiftSale | null>(null);
  const [nozzles, setNozzles] = useState<Nozzle[]>([]);
  const [products, setProducts] = useState<FuelProduct[]>([]);
  const [fuelPrices, setFuelPrices] = useState<FuelPrice[]>([]);
  const [expenseCoaList, setExpenseCoaList] = useState<ExpenseCoa[]>([]);
  const [branchName, setBranchName] = useState('');
  const [related, setRelated] = useState<RelatedShiftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [denomText, setDenomText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    if (!id || !session) return;
    setLoading(true);
    const [s, nz, prods, fPrices, expCoas, bName] = await Promise.all([
      getShift(id),
      listNozzles(session.branchId),
      listFuelProducts(session.companyId),
      listFuelPrices(session.branchId),
      listExpenseCoa(session.companyId),
      getBranchName(session.branchId),
    ]);
    setShift(s);
    setNozzles(nz);
    setProducts(prods);
    setFuelPrices(fPrices);
    setExpenseCoaList(expCoas);
    setBranchName(bName);

    const rel = await fetchRelatedShiftData(s.branch_id, s.shift_date, s.shift_type);
    setRelated(rel);

    const saved = s.cash_denominations || {};
    const dt: Record<string, string> = {};
    DENOMS.forEach((d) => { if (saved[d.key]) dt[d.key] = String(saved[d.key]); });
    setDenomText(dt);

    setLoading(false);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const balancing: BalancingResult | null =
    shift && related ? calcCashBalancing(shift, nozzles, products, fuelPrices, expenseCoaList, related) : null;

  const onSave = async () => {
    if (!shift) return;
    setSaving(true);
    try {
      const denoms: Record<string, number> = {};
      DENOMS.forEach((d) => {
        const n = parseFloat(denomText[d.key]);
        if (n > 0) denoms[d.key] = n;
      });
      await saveCashDenominations(shift.id, denoms);
      setShift({ ...shift, cash_denominations: denoms });
      Alert.alert('Berhasil', 'Hitungan kas tersimpan.');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal menyimpan hitungan kas.');
    } finally {
      setSaving(false);
    }
  };

  const onCetak = async () => {
    if (!shift || !balancing) return;
    setPrinting(true);
    try {
      await printCashBalancingReport(shift, branchName, balancing);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal mencetak laporan.');
    } finally {
      setPrinting(false);
    }
  };

  if (loading || !shift || !balancing) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.emerald600} />
      </SafeAreaView>
    );
  }

  const totalHitung = DENOMS.reduce((a, d) => a + (parseFloat(denomText[d.key]) || 0) * d.value, 0);
  const selisih = totalHitung - balancing.netSetoran;

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: shift.shift_number,
          headerRight: () => (
            <Pressable onPress={onCetak} disabled={printing} hitSlop={10} style={styles.headerPrintBtn}>
              <Text style={styles.headerPrintText}>{printing ? '...' : 'Cetak'}</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.shiftMeta}>
            {branchName} · {new Date(shift.shift_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} · Shift {shift.shift_type}
          </Text>

          {[...balancing.debitRows.map((r) => ({ ...r, isDebit: true })), ...balancing.kreditRows.map((r) => ({ ...r, isDebit: false }))].map(
            (r, i) => (
              <View key={i} style={[styles.rowBetween, { marginTop: 6 }]}>
                <Text style={styles.lineText} numberOfLines={1}>{r.label}</Text>
                <Text style={[styles.lineAmount, { color: r.isDebit ? colors.blue700 : colors.red600 }]}>{fc(r.amount)}</Text>
              </View>
            )
          )}

          <View style={styles.netSetoranBox}>
            <Text style={styles.netSetoranLabel}>Net Setoran (Kas Tunai Seharusnya)</Text>
            <Text style={styles.netSetoranValue}>{fc(balancing.netSetoran)}</Text>
          </View>
        </Card>

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>RINCIAN UANG TUNAI (HITUNG FISIK)</Text>
        <Card>
          {DENOMS.map((d) => (
            <View key={d.key} style={styles.denomRow}>
              <Text style={styles.denomLabel}>{d.label}</Text>
              <TextInput
                style={styles.denomInput}
                keyboardType="numeric"
                value={denomText[d.key] || ''}
                onChangeText={(v) => setDenomText((prev) => ({ ...prev, [d.key]: v }))}
                placeholder="0"
                placeholderTextColor={colors.slate300}
              />
              <Text style={styles.denomSub}>{fc((parseFloat(denomText[d.key]) || 0) * d.value)}</Text>
            </View>
          ))}

          <View style={[styles.rowBetween, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.slate200 }]}>
            <Text style={styles.payMethod}>Total Hitungan Fisik</Text>
            <Text style={styles.lineAmount}>{fc(totalHitung)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.payMethod}>Selisih (Lebih/Kurang Uang Teller)</Text>
            <Text style={[styles.lineAmount, { color: selisih === 0 ? colors.emerald600 : selisih > 0 ? colors.blue700 : colors.red600 }]}>
              {fc(selisih)}
            </Text>
          </View>

          <View style={{ marginTop: 12 }}>
            <PrimaryButton label="Simpan Hitungan Kas" onPress={onSave} loading={saving} />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50 },
  content: { padding: 16, paddingBottom: 40, gap: 8 },
  headerPrintBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  headerPrintText: { color: colors.emerald600, fontSize: 13, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shiftMeta: { fontSize: 12, color: colors.slate500, marginBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.slate400, marginBottom: 4, letterSpacing: 0.3 },
  lineText: { fontSize: 12, color: colors.slate600, flex: 1, marginRight: 8 },
  lineAmount: { fontSize: 13, fontWeight: '700', color: colors.blue700, fontFamily: 'monospace' },
  payMethod: { fontSize: 13, fontWeight: '700', color: colors.slate800 },
  netSetoranBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.emerald50,
    borderWidth: 1,
    borderColor: colors.emerald300,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  netSetoranLabel: { fontSize: 12.5, fontWeight: '700', color: colors.emerald700 },
  netSetoranValue: { fontSize: 15, fontWeight: '800', color: colors.emerald700, fontFamily: 'monospace' },
  denomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  denomLabel: { fontSize: 11.5, color: colors.slate600, flex: 1.3 },
  denomInput: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    width: 70,
    textAlign: 'right',
    color: colors.slate800,
  },
  denomSub: { fontSize: 11, fontFamily: 'monospace', color: colors.slate500, flex: 1, textAlign: 'right' },
});
