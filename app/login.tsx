import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { login } from '../lib/auth';
import { useSession } from '../lib/SessionContext';
import { PrimaryButton } from '../components/ui';
import { colors, radius } from '../lib/theme';

// Setara ikon "local_gas_station" di sidebar web (menu Operasional SPBU).
function GasStationIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="4" y="3" width="10" height="18" rx="1" />
      <Line x1="4" y1="9" x2="14" y2="9" />
      <Line x1="7" y1="13" x2="11" y2="13" />
      <Path d="M14 8h3a2 2 0 0 1 2 2v7a1.5 1.5 0 0 1-3 0v-4a1 1 0 0 0-1-1h-1" />
    </Svg>
  );
}

export default function LoginScreen() {
  const { refresh } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Harap isi username dan password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password.trim());
      await refresh();
      router.replace('/');
    } catch (e: any) {
      setError(e?.message || 'Gagal login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.content}>
          <View style={styles.logoBox}>
            <GasStationIcon />
          </View>
          <Text style={styles.title}>SPBU Mobile</Text>
          <Text style={styles.subtitle}>Operasional SPBU</Text>

          <View style={{ height: 32 }} />

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="username"
            placeholderTextColor={colors.slate400}
          />

          <View style={{ height: 14 }} />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.slate400}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ height: 20 }} />
          <PrimaryButton label="Masuk" onPress={onSubmit} loading={loading} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.slate50 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.emerald600,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { textAlign: 'center', fontSize: 22, fontWeight: '800', color: colors.slate900 },
  subtitle: { textAlign: 'center', fontSize: 13, color: colors.slate400, marginTop: 4 },
  label: { fontSize: 12, fontWeight: '600', color: colors.slate600, marginBottom: 6 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 14,
    color: colors.slate800,
  },
  error: { color: colors.red600, fontSize: 12, marginTop: 12, textAlign: 'center' },
});
