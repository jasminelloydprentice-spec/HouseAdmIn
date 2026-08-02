import { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface AuthState {
  session: Session | null;
  /** True until the persisted session has been restored. */
  initialising: boolean;
  householdId: string | null;
  /** True while the household lookup is in flight (after sign-in). */
  householdLoading: boolean;
  signOut: () => Promise<void>;
  refreshHousehold: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function fetchHouseholdId(userId: string): Promise<string | null> {
  // The signup trigger provisions a household + membership; RLS scopes this
  // query to the caller's own memberships.
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.household_id ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialising, setInitialising] = useState(true);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdLoading, setHouseholdLoading] = useState(false);
  const currentUserId = useRef<string | null>(null);

  const syncHousehold = useCallback(async (userId: string | null) => {
    currentUserId.current = userId;
    if (!userId) {
      setHouseholdId(null);
      return;
    }
    setHouseholdLoading(true);
    const id = await fetchHouseholdId(userId);
    // Ignore stale responses if the user changed mid-flight.
    if (currentUserId.current === userId) {
      setHouseholdId(id);
      setHouseholdLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitialising(false);
      void syncHousehold(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      const nextUserId = next?.user.id ?? null;
      if (nextUserId !== currentUserId.current) {
        void syncHousehold(nextUserId);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [syncHousehold]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshHousehold = useCallback(async () => {
    await syncHousehold(currentUserId.current);
  }, [syncHousehold]);

  const value = useMemo(
    () => ({ session, initialising, householdId, householdLoading, signOut, refreshHousehold }),
    [session, initialising, householdId, householdLoading, signOut, refreshHousehold],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Convenience: current household id or throws (use inside the (app) group only). */
export function useHouseholdId(): string {
  const { householdId } = useAuth();
  if (!householdId) throw new Error('No household in context');
  return householdId;
}
