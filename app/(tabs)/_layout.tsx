import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSession } from '../../lib/SessionContext';
import { colors } from '../../lib/theme';

// Bottom tab bar — landing page setelah login (lib/login.tsx me-redirect ke
// /beranda, tab lain tetap diakses lewat bar ini). Nama ikon sengaja sama
// persis dengan yang dipakai sidebar web (Material Symbols) supaya identik,
// bukan cuma senada — MaterialIcons di @expo/vector-icons pakai glyph yang
// sama, cuma beda konvensi penamaan (snake_case web -> kebab-case sini).
export default function TabsLayout() {
  const { session, needsBranchSelection, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/login'); return; }
    if (needsBranchSelection) router.replace('/pilih-cabang');
  }, [loading, session, needsBranchSelection]);

  if (loading || !session || needsBranchSelection) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50 }}>
        <ActivityIndicator color={colors.emerald600} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.emerald600,
        tabBarInactiveTintColor: colors.slate400,
        tabBarStyle: { borderTopColor: colors.slate200, height: 58, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="beranda"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Shift',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="local-gas-station" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="transaksi"
        options={{
          title: 'Transaksi',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="receipt-long" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="laporan"
        options={{
          title: 'Laporan',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="assessment" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="lainnya"
        options={{
          title: 'Lainnya',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="apps" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
