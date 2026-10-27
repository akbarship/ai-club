import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Session } from './types';

type Ctx = {
  session: Session | null;
  error: string | null;
  refresh: () => Promise<Session | null>;
  checkSubscription: () => Promise<boolean>;
  setWaitlist: (w: string[]) => void;
};

const SessionContext = createContext<Ctx>(null!);
export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api.post<Session>('/session');
      setSession(s);
      setError(null);
      return s;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  const checkSubscription = useCallback(async () => {
    const { subscribed } = await api.post<{ subscribed: boolean }>('/subscription/check');
    setSession((s) => (s ? { ...s, subscribed } : s));
    return subscribed;
  }, []);

  const setWaitlist = useCallback((waitlist: string[]) => setSession((s) => (s ? { ...s, waitlist } : s)), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ session, error, refresh, checkSubscription, setWaitlist }}>
      {children}
    </SessionContext.Provider>
  );
}
