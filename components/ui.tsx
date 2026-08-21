import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius } from '../lib/theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primaryBtn,
        (disabled || loading) && styles.btnDisabled,
        pressed && !disabled && !loading && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{label}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.secondaryBtn, disabled && { opacity: 0.5 }, pressed && { backgroundColor: colors.slate100 }]}
    >
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone }: { label: string; tone: 'emerald' | 'amber' | 'slate' | 'red' | 'blue' }) {
  const map: Record<string, { bg: string; fg: string }> = {
    emerald: { bg: colors.emerald600, fg: '#fff' },
    amber: { bg: colors.amber500, fg: '#fff' },
    slate: { bg: colors.slate200, fg: colors.slate600 },
    red: { bg: colors.red50, fg: colors.red600 },
    blue: { bg: colors.blue100, fg: colors.blue700 },
  };
  const t = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.xl,
    padding: 16,
  },
  primaryBtn: {
    backgroundColor: colors.emerald600,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.emerald600,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.slate600, fontSize: 14, fontWeight: '600' },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
