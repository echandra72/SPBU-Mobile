// Palet & token visual mengikuti tema web existing (Tailwind emerald + slate,
// font Manrope untuk display/heading, Inter untuk body) — lihat pages/spbu/*.html.
export const colors = {
  emerald50: '#ecfdf5',
  emerald100: '#d1fae5',
  emerald300: '#6ee7b7',
  emerald500: '#10b981',
  emerald600: '#059669',
  emerald700: '#047857',
  emerald800: '#065f46',

  amber50: '#fffbeb',
  amber100: '#fef3c7',
  amber300: '#fcd34d',
  amber500: '#f59e0b',
  amber600: '#d97706',
  amber700: '#92400e',

  red50: '#fef2f2',
  red100: '#fecaca',
  red500: '#ef4444',
  red600: '#dc2626',

  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue700: '#1e40af',

  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',

  white: '#ffffff',
};

export const radius = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  pill: 999,
};

export const spacing = (n: number) => n * 4;
