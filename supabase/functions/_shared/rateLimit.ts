import { serviceClient } from './auth.ts';

/**
 * Simple fixed-window rate limiting backed by the rate_limits table (which
 * has RLS enabled and no client policies — only this server code touches it).
 */
export async function checkRateLimit(userId: string, action: string, limitPerHour: number): Promise<boolean> {
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0);
  const supabase = serviceClient();

  const { data } = await supabase
    .from('rate_limits')
    .select('id, count')
    .eq('user_id', userId)
    .eq('action', action)
    .eq('window_start', windowStart.toISOString())
    .maybeSingle();

  if (!data) {
    await supabase.from('rate_limits').insert({
      user_id: userId,
      action,
      window_start: windowStart.toISOString(),
      count: 1,
    });
    return true;
  }
  if (data.count >= limitPerHour) return false;
  await supabase
    .from('rate_limits')
    .update({ count: data.count + 1 })
    .eq('id', data.id);
  return true;
}
