import { z } from 'npm:zod@3.24.1';
import { serviceClient, verifyUser } from '../_shared/auth.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';

/**
 * Complete account deletion. Removes, for every household the caller owns
 * solely (MVP: their one household): all storage objects, all rows (via FK
 * cascade from households), then the auth user. Explicit confirmation
 * string is required so a stray API call can't wipe an account.
 */

const bodySchema = z.object({ confirm: z.literal('DELETE') }).strict();

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  const user = await verifyUser(req);
  if (!user) return errorResponse('Not authenticated', 401);

  try {
    bodySchema.parse(await req.json());
  } catch {
    return errorResponse('Invalid request', 400);
  }

  const db = serviceClient();

  // Households where this user is a member.
  const { data: memberships, error: membershipError } = await db
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.userId);
  if (membershipError) return errorResponse('Deletion failed', 500, membershipError.message);

  for (const membership of memberships ?? []) {
    const householdId = membership.household_id as string;

    // MVP safety: only delete households with no other members.
    const { count } = await db
      .from('household_members')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .neq('user_id', user.userId);
    if ((count ?? 0) > 0) continue;

    // 1. Storage objects under the household prefix. Recurse into folders
    //    and page through each level (list() caps at ~1000 per call), and
    //    surface failures so we never drop the DB rows while objects remain.
    const pageSize = 1000;
    const removeAll = async (prefix: string): Promise<boolean> => {
      let offset = 0;
      for (;;) {
        const { data: entries, error: listError } = await db.storage
          .from('documents')
          .list(prefix, { limit: pageSize, offset });
        if (listError) return false;
        if (!entries || entries.length === 0) break;
        for (const entry of entries) {
          const path = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.id === null) {
            if (!(await removeAll(path))) return false; // folder
          } else {
            const { error: removeError } = await db.storage.from('documents').remove([path]);
            if (removeError) return false;
          }
        }
        if (entries.length < pageSize) break;
        offset += entries.length;
      }
      return true;
    };
    const storageCleared = await removeAll(householdId);
    if (!storageCleared) {
      // Abort before touching the DB: better to leave a recoverable, fully
      // referenced account than orphaned files with no rows to find them by.
      return errorResponse('Account deletion could not remove all stored files — nothing was deleted. Please try again.', 500, `storage cleanup failed for household ${householdId}`);
    }

    // 2. Household row — FK cascade removes documents, files metadata,
    //    pages, fields, tags, reminders, jobs, conversations, messages.
    const { error: deleteError } = await db.from('households').delete().eq('id', householdId);
    if (deleteError) return errorResponse('Deletion failed', 500, deleteError.message);
  }

  // 3. Auth user (cascades profile + memberships + rate limits).
  const { error: authError } = await db.auth.admin.deleteUser(user.userId);
  if (authError) return errorResponse('Account deletion failed at the last step — contact support', 500, authError.message);

  return jsonResponse({ deleted: true });
});
