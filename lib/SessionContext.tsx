import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadSession, clearSession, Session } from './session';

type Ctx = {
  session: Session | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionCtx = createContext<Ctx>({ session: null, loading: true, refresh: async () => {}, logout: async () => {} });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const s = await loadSession();
    setSession(s);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await clearSession();
    setSession(null);
  };

  return <SessionCtx.Provider value={{ session, loading, refresh, logout }}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  return useContext(SessionCtx);
}
