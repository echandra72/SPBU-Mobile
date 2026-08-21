import AsyncStorage from '@react-native-async-storage/async-storage';

// Mengikuti persis skema localStorage yang dipakai web (js/auth.js), supaya
// konsep sesi & hak akses tetap identik antara mobile dan web.
export type Session = {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  level: number;
  isGodMode: boolean;
  companyId: string;
  branchId: string;
  departmentId: string;
  allowedMenus: string[];
  sessionToken: string;
  loginTime: number;
};

const KEYS = {
  sessionToken: 'ge-session-token',
  loginTime: 'ge-login-time',
  userId: 'ge-user-id',
  userName: 'ge-user-name',
  userUsername: 'ge-user-username',
  userRole: 'ge-user-role',
  userLevel: 'ge-user-level',
  isGodMode: 'ge-is-godmode',
  companyId: 'ge-company-id',
  branchId: 'ge-branch-id',
  departmentId: 'ge-department-id',
  allowedMenus: 'ge-allowed-menus',
} as const;

const SESSION_MAX_AGE_MS = 60 * 60 * 1000; // 1 jam, sama seperti auto-logout web

export async function saveSession(s: Session) {
  await AsyncStorage.multiSet([
    [KEYS.sessionToken, s.sessionToken],
    [KEYS.loginTime, String(s.loginTime)],
    [KEYS.userId, s.userId],
    [KEYS.userName, s.fullName],
    [KEYS.userUsername, s.username],
    [KEYS.userRole, s.role],
    [KEYS.userLevel, String(s.level)],
    [KEYS.isGodMode, String(s.isGodMode)],
    [KEYS.companyId, s.companyId],
    [KEYS.branchId, s.branchId],
    [KEYS.departmentId, s.departmentId],
    [KEYS.allowedMenus, JSON.stringify(s.allowedMenus)],
  ]);
}

export async function loadSession(): Promise<Session | null> {
  const entries = await AsyncStorage.multiGet(Object.values(KEYS));
  const map = Object.fromEntries(entries) as Record<string, string | null>;

  const userId = map[KEYS.userId];
  const loginTime = Number(map[KEYS.loginTime]) || 0;
  if (!userId || !loginTime) return null;
  if (Date.now() - loginTime > SESSION_MAX_AGE_MS) return null;

  return {
    userId,
    username: map[KEYS.userUsername] || '',
    fullName: map[KEYS.userName] || '',
    role: map[KEYS.userRole] || 'User',
    level: Number(map[KEYS.userLevel]) || 3,
    isGodMode: map[KEYS.isGodMode] === 'true',
    companyId: map[KEYS.companyId] || '',
    branchId: map[KEYS.branchId] || '',
    departmentId: map[KEYS.departmentId] || '',
    allowedMenus: safeParseArray(map[KEYS.allowedMenus]),
    sessionToken: map[KEYS.sessionToken] || '',
    loginTime,
  };
}

export async function clearSession() {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}

function safeParseArray(v: string | null): string[] {
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
