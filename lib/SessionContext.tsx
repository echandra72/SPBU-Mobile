import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadSession, clearSession, loadActiveBranch, saveActiveBranch, Session } from './session';

type Ctx = {
  session: Session | null;
  // Level 1/2 (tidak terikat 1 cabang secara auth) belum pilih cabang aktif —
  // gunakan ini untuk mengarahkan ke layar Pilih Cabang.
  needsBranchSelection: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setActiveBranch: (branchId: string) => Promise<void>;
};

const SessionCtx = createContext<Ctx>({
  session: null,
  needsBranchSelection: false,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
  setActiveBranch: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [rawSession, setRawSession] = useState<Session | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [s, activeBranch] = await Promise.all([loadSession(), loadActiveBranch()]);
    setRawSession(s);
    setActiveBranchId(activeBranch);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const logout = useCallback(async () => {
    await clearSession();
    setRawSession(null);
    setActiveBranchId(null);
  }, []);

  const setActiveBranch = useCallback(async (branchId: string) => {
    await saveActiveBranch(branchId);
    setActiveBranchId(branchId);
  }, []);

  // Level 3 (cabang) selalu pakai branchId dari auth apa adanya. Level 1/2
  // (branchId auth sengaja kosong, sama seperti web) memakai cabang aktif
  // yang dipilih manual — layar lain (Shift, Tangki, LO, dll) tetap cukup
  // baca session.branchId tanpa perlu tahu perbedaan ini.
  //
  // Di-memo supaya identitas objek `session` stabil antar render — tanpa ini,
  // layar yang punya `useEffect(..., [session])` (bukan `[session?.branchId]`,
  // mis. app/index.tsx) akan menembak ulang efeknya (termasuk router.replace)
  // di SETIAP render SessionProvider, bukan cuma saat datanya benar-benar
  // berubah — berisiko jadi loop redirect yang terlihat seperti layar "muter".
  const session: Session | null = useMemo(() => {
    if (rawSession && rawSession.level <= 2) {
      return { ...rawSession, branchId: activeBranchId || '' };
    }
    return rawSession;
  }, [rawSession, activeBranchId]);

  const needsBranchSelection = !!rawSession && rawSession.level <= 2 && !activeBranchId;

  const value = useMemo(
    () => ({ session, needsBranchSelection, loading, refresh, logout, setActiveBranch }),
    [session, needsBranchSelection, loading, refresh, logout, setActiveBranch]
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  return useContext(SessionCtx);
}
