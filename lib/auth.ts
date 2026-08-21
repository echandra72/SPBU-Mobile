import { supabase } from './supabase';
import { saveSession, Session } from './session';

// Replikasi persis logika js/auth.js (web): password dibandingkan sebagai
// plaintext lewat filter PostgREST — bukan keputusan desain baru, hanya
// menyamakan perilaku login dengan yang sudah berjalan di web.
export async function login(username: string, password: string): Promise<Session> {
  const { data, error } = await supabase
    .from('m_users')
    .select('*, m_roles(role_name, level, allowed_menus), m_employee_profiles(full_name, department_id, company_id, branch_id)')
    .eq('username', username)
    .eq('password', password);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('Username atau password salah.');

  const user = data[0] as any;
  if (!user.is_active) throw new Error('Akun Anda dinonaktifkan. Hubungi Administrator.');

  const roleData = user.m_roles || {};
  const level = roleData.level || 3;
  const empProfile = user.m_employee_profiles || {};
  const fullName = empProfile.full_name || user.username;
  const companyId = user.company_id || empProfile.company_id || '';
  const branchId = user.branch_id || empProfile.branch_id || '';

  let allowedMenus: string[] = [];
  if (roleData.allowed_menus) {
    try {
      const permissions =
        typeof roleData.allowed_menus === 'string' ? JSON.parse(roleData.allowed_menus) : roleData.allowed_menus;
      allowedMenus = Object.keys(permissions);
    } catch {
      // abaikan, allowedMenus tetap []
    }
  }

  const sessionToken = Date.now().toString(36) + Math.random().toString(36).slice(2);

  try {
    await supabase.from('m_users').update({ session_token: sessionToken }).eq('id', user.id);
  } catch {
    // gagal update session_token bukan alasan untuk membatalkan login (sama seperti web)
  }

  const session: Session = {
    userId: user.id,
    username: user.username,
    fullName,
    role: roleData.role_name || 'User',
    level,
    isGodMode: level === 1,
    companyId,
    branchId: level === 1 || level === 2 ? '' : branchId,
    departmentId: empProfile.department_id || '',
    allowedMenus,
    sessionToken,
    loginTime: Date.now(),
  };

  await saveSession(session);
  return session;
}
