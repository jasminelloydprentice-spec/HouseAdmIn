import { serviceClient } from './auth.ts';

/**
 * Fixed-window rate limiting backed by the rate_limits table (RLS-enabled,
 * no client policies — only server code touches it via the service role).
 *
 * The increment happens in a single atomic `bump_rate_limit` RPC
 * (insert … on conflict do update … returning count), so concurrent
 * requests cannot all read the same count and slip past the cap.
 */
export async function checkRateLimit(userId: string, action: string, limitPerHour: number): Promise<boolean> {
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0);

  const { data, error } = await serviceClient().rpc('bump_rate_limit', {
    p_user_id: userId,
    p_action: action,
    p_window: windowStart.toISOString(),
  });

  // Fail closed: if the limiter itself errors, treat the request as blocked
  // rather than granting unlimited access to a costly endpoint.
  if (error || typeof data !== 'number') {
    console.error('Rate limiter error', error?.message ?? 'unexpected response');
    return false;
  }
  return data <= limitPerHour;
}
