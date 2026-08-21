import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { login } from '../lib/auth';
import { useSession } from '../lib/SessionContext';
import { PrimaryButton } from '../components/ui';
import { colors, radius } from '../lib/theme';

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
            <Text style={styles.logoIcon}>⛽</Text>
          </View>
          <Text style={styles.title}>SPBU Mobile</Text>
          <Text style={styles.subtitle}>Shift Penjualan BBM</Text>

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
  logoIcon: { fontSize: 30 },
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
