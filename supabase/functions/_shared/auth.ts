import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

/**
 * Server-side auth helpers. Every function verifies the caller's JWT and
 * membership before touching data — ownership is never taken from the
 * request body.
 */

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** A client bound to the caller's JWT — RLS applies to everything it does. */
export function callerClient(req: Request): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) throw new Error('Missing SUPABASE_URL / SUPABASE_ANON_KEY');
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
}

export interface VerifiedUser {
  userId: string;
  email: string | null;
}

/** Verify the JWT with the auth server. Returns null when invalid/absent. */
export async function verifyUser(req: Request): Promise<VerifiedUser | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length);
  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, email: data.user.email ?? null };
}

/** Server-side membership check via the service role (not client-supplied). */
export async function isHouseholdMember(userId: string, householdId: string): Promise<boolean> {
  const { data, error } = await serviceClient()
    .from('household_members')
    .select('id')
    .eq('user_id', userId)
    .eq('household_id', householdId)
    .limit(1)
    .maybeSingle();
  return !error && !!data;
}
