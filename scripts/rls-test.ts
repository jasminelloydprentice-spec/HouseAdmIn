/**
 * RLS isolation tests. Run against a LOCAL or dedicated test Supabase stack:
 *
 *   npx supabase start
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npm run test:rls
 *
 * Proves that:
 *  1. User B cannot read User A's documents (direct select + by id).
 *  2. User B cannot update or delete User A's rows.
 *  3. User B cannot insert rows with a forged household_id.
 *  4. User B cannot create a signed URL (or download) A's storage object.
 *  5. The anon role sees nothing.
 *  6. Related tables (fields, pages, reminders, conversations) are isolated.
 *
 * Never run against a production project: it creates and deletes test users.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!anonKey || !serviceKey) {
  console.error(
    'SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required (from `npx supabase status`).\nSkipping is NOT a pass — these tests must run before trusting the policies.',
  );
  process.exit(2);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ✔ ${name}`);
  } else {
    failures++;
    console.error(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function createUser(email: string): Promise<{ client: SupabaseClient; userId: string; householdId: string }> {
  const password = `Rls-test-${randomUUID()}`;
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) throw new Error(`createUser failed: ${error?.message}`);
  const client = createClient(url, anonKey!, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`);
  const { data: membership } = await client.from('household_members').select('household_id').limit(1).maybeSingle();
  if (!membership) throw new Error('signup trigger did not provision a household');
  return { client, userId: created.user.id, householdId: membership.household_id };
}

async function main() {
  const run = randomUUID().slice(0, 8);
  console.log(`RLS isolation tests (run ${run}) against ${url}\n`);

  const a = await createUser(`rls-a-${run}@test.local`);
  const b = await createUser(`rls-b-${run}@test.local`);
  const anon = createClient(url, anonKey!, { auth: { persistSession: false } });

  try {
    // A creates a document + related rows.
    const { data: doc, error: docError } = await a.client
      .from('documents')
      .insert({ household_id: a.householdId, created_by: a.userId, title: 'RLS secret doc', status: 'ready' })
      .select('*')
      .single();
    if (docError || !doc) throw new Error(`setup insert failed: ${docError?.message}`);

    await a.client.from('document_fields').insert({
      document_id: doc.id, household_id: a.householdId, key: 'policy_number', label: 'Policy number',
      value_text: 'SECRET-123', source: 'manual',
    });
    await a.client.from('document_pages').insert({
      document_id: doc.id, household_id: a.householdId, page_number: 1, text: 'SECRET page text',
    });
    await a.client.from('reminders').insert({
      household_id: a.householdId, document_id: doc.id, title: 'secret reminder', due_date: '2030-01-01', created_by: a.userId,
    });

    // A uploads a storage object.
    const path = `${a.householdId}/${doc.id}/original/page-1.jpg`;
    const { error: uploadError } = await a.client.storage
      .from('documents')
      .upload(path, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])]), { contentType: 'image/jpeg' });
    check('A can upload to own household path', !uploadError, uploadError?.message);

    console.log('\nCross-user reads:');
    const { data: bDocs } = await b.client.from('documents').select('*');
    check("B's document list excludes A's documents", (bDocs ?? []).every((d) => d.id !== doc.id));
    const { data: bById } = await b.client.from('documents').select('*').eq('id', doc.id).maybeSingle();
    check("B cannot fetch A's document by id", bById === null);
    const { data: bFields } = await b.client.from('document_fields').select('*').eq('document_id', doc.id);
    check("B cannot read A's fields", (bFields ?? []).length === 0);
    const { data: bPages } = await b.client.from('document_pages').select('*').eq('document_id', doc.id);
    check("B cannot read A's pages", (bPages ?? []).length === 0);
    const { data: bRem } = await b.client.from('reminders').select('*').eq('household_id', a.householdId);
    check("B cannot read A's reminders", (bRem ?? []).length === 0);
    const { data: anonDocs } = await anon.from('documents').select('*');
    check('anon sees no documents', (anonDocs ?? []).length === 0);

    console.log('\nCross-user writes:');
    await b.client.from('documents').update({ title: 'HACKED' }).eq('id', doc.id);
    const { data: afterUpdate } = await a.client.from('documents').select('title').eq('id', doc.id).single();
    check("B's update of A's document has no effect", afterUpdate?.title === 'RLS secret doc');
    await b.client.from('documents').delete().eq('id', doc.id);
    const { data: afterDelete } = await a.client.from('documents').select('id').eq('id', doc.id).maybeSingle();
    check("B's delete of A's document has no effect", afterDelete !== null);

    console.log('\nForged household id:');
    const { error: forgeError } = await b.client
      .from('documents')
      .insert({ household_id: a.householdId, created_by: b.userId, title: 'forged', status: 'ready' });
    check('B cannot insert a document into A’s household', !!forgeError);
    const { error: forgeReminderError } = await b.client
      .from('reminders')
      .insert({ household_id: a.householdId, title: 'forged', due_date: '2030-01-01', created_by: b.userId });
    check('B cannot insert a reminder into A’s household', !!forgeReminderError);

    console.log('\nStorage isolation:');
    const { data: bSigned, error: bSignError } = await b.client.storage.from('documents').createSignedUrl(path, 60);
    check("B cannot create a signed URL for A's file", !!bSignError || !bSigned?.signedUrl, bSignError?.message);
    const { data: bDownload, error: bDownloadError } = await b.client.storage.from('documents').download(path);
    check("B cannot download A's file", !!bDownloadError || !bDownload);
    const { error: bUploadForeign } = await b.client.storage
      .from('documents')
      .upload(`${a.householdId}/${doc.id}/original/evil.jpg`, new Blob([new Uint8Array([1])]), { contentType: 'image/jpeg' });
    check("B cannot upload into A's household path", !!bUploadForeign);
    const { data: aSigned, error: aSignError } = await a.client.storage.from('documents').createSignedUrl(path, 60);
    check('A can create a signed URL for own file', !aSignError && !!aSigned?.signedUrl, aSignError?.message);

    console.log('\nAssistant tables:');
    const { data: conv } = await a.client
      .from('assistant_conversations')
      .insert({ household_id: a.householdId, user_id: a.userId, title: 'secret chat' })
      .select('id')
      .single();
    if (conv) {
      const { data: bConv } = await b.client.from('assistant_conversations').select('*').eq('id', conv.id).maybeSingle();
      check("B cannot read A's conversations", bConv === null);
    }

    console.log('\nRate limits (no client access):');
    const { data: rl } = await b.client.from('rate_limits').select('*');
    check('rate_limits invisible to clients', (rl ?? []).length === 0);
  } finally {
    // Cleanup: remove test users (cascades households/data) and storage.
    await admin.storage.from('documents').remove([`${a.householdId}/`]).catch(() => undefined);
    await admin.auth.admin.deleteUser(a.userId).catch(() => undefined);
    await admin.auth.admin.deleteUser(b.userId).catch(() => undefined);
  }

  console.log(failures === 0 ? '\nAll RLS isolation checks passed.' : `\n${failures} RLS check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('RLS test run failed:', err);
  process.exit(1);
});
