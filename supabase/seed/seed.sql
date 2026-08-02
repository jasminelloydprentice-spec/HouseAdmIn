-- Paperkeep development seed — LOCAL DEVELOPMENT ONLY.
-- Everything below is clearly FICTIONAL: invented providers' styling,
-- invented reference numbers, no real people, addresses or accounts.
-- Sign in locally as demo@paperkeep.test (OTP appears in inbucket :54324).

-- Demo auth user; the signup trigger provisions profile/household/person.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'demo@paperkeep.test', '',
  now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
)
on conflict (id) do nothing;

do $$
declare
  demo_user uuid := '00000000-0000-4000-8000-000000000001';
  hh uuid;
  me uuid;
  doc uuid;
begin
  select household_id into hh from public.household_members where user_id = demo_user limit 1;
  if hh is null then
    raise exception 'Seed expected the signup trigger to have created a household';
  end if;
  select id into me from public.people where household_id = hh and kind = 'me' limit 1;

  -- 1. Fictional Aviva-style pension statement -------------------------
  insert into public.documents (
    id, household_id, created_by, title, category, provider, doc_type,
    document_date, person_id, status, summary, summary_source,
    is_important, page_count, analysis_model, analysed_at
  ) values (
    gen_random_uuid(), hh, demo_user,
    '[FICTIONAL] Aviva annual pension statement', 'pensions', 'Aviva', 'Annual pension statement',
    '2026-06-14', me, 'ready',
    'FICTIONAL demo document. Annual statement for a personal pension showing the plan value. No action is required.',
    'ai', true, 1, 'seed', now()
  ) returning id into doc;

  insert into public.document_pages (document_id, household_id, page_number, text) values
    (doc, hh, 1, 'FICTIONAL DEMO DOCUMENT — Aviva. Annual pension statement for Jasmine Example. Your pension number: AV12345678. Statement date: 14 June 2026. Value of your plan on 1 June 2026: £48,210.55. You do not need to do anything. Questions? Call 0800 000 0000.');

  insert into public.document_fields (document_id, household_id, key, label, value_text, value_date, value_number, currency, confidence, source, page_number, evidence_text) values
    (doc, hh, 'pension_number', 'Pension number', 'AV12345678', null, null, null, 0.97, 'ai', 1, 'Your pension number: AV12345678'),
    (doc, hh, 'pension_value', 'Current pension value', null, null, 48210.55, 'GBP', 0.93, 'ai', 1, 'Value of your plan on 1 June 2026: £48,210.55'),
    (doc, hh, 'statement_date', 'Statement date', null, '2026-06-14', null, null, 0.96, 'ai', 1, 'Statement date: 14 June 2026');

  -- 2. Fictional home-insurance renewal --------------------------------
  insert into public.documents (
    id, household_id, created_by, title, category, provider, doc_type,
    document_date, person_id, status, summary, summary_source, action_required,
    renewal_date, expiry_date, is_important, page_count, analysis_model, analysed_at
  ) values (
    gen_random_uuid(), hh, demo_user,
    '[FICTIONAL] Harbour Insurance home renewal', 'insurance', 'Harbour Insurance', 'Renewal notice',
    '2026-07-01', me, 'ready',
    'FICTIONAL demo document. Home insurance renewal quote. The policy renews automatically unless cancelled before the renewal date.',
    'ai', 'Review the renewal quote and cancel before 1 September 2026 if not wanted.',
    '2026-09-01', '2026-08-31', true, 1, 'seed', now()
  ) returning id into doc;

  insert into public.document_pages (document_id, household_id, page_number, text) values
    (doc, hh, 1, 'FICTIONAL DEMO DOCUMENT — Harbour Insurance. Home insurance renewal. Policy number: HI-2244-6688. Your cover ends on 31 August 2026 and renews on 1 September 2026. Your renewal premium: £342.18 per year. If you do nothing your policy renews automatically.');

  insert into public.document_fields (document_id, household_id, key, label, value_text, value_date, value_number, currency, confidence, source, page_number, evidence_text) values
    (doc, hh, 'policy_number', 'Policy number', 'HI-2244-6688', null, null, null, 0.98, 'ai', 1, 'Policy number: HI-2244-6688'),
    (doc, hh, 'annual_premium', 'Renewal premium (annual)', null, null, 342.18, 'GBP', 0.95, 'ai', 1, 'Your renewal premium: £342.18 per year'),
    (doc, hh, 'renewal_date', 'Renewal date', null, '2026-09-01', null, null, 0.94, 'ai', 1, 'renews on 1 September 2026');

  insert into public.reminders (household_id, document_id, title, due_date, source, created_by) values
    (hh, doc, '[FICTIONAL] Review home insurance renewal', '2026-09-01', 'ai_suggested', demo_user);

  -- 3. Fictional council-tax letter ------------------------------------
  insert into public.documents (
    id, household_id, created_by, title, category, provider, doc_type,
    document_date, person_id, status, summary, summary_source, action_required,
    deadline_date, page_count, analysis_model, analysed_at
  ) values (
    gen_random_uuid(), hh, demo_user,
    '[FICTIONAL] Camford Council tax bill 2026–27', 'tax_hmrc', 'Camford City Council', 'Council tax bill',
    '2026-03-10', me, 'ready',
    'FICTIONAL demo document. Council tax bill for 2026–27 with first instalment due 1 April 2026.',
    'ai', 'Set up or confirm payment before the first instalment on 1 April 2026.',
    '2026-04-01', 1, 'seed', now()
  ) returning id into doc;

  insert into public.document_pages (document_id, household_id, page_number, text) values
    (doc, hh, 1, 'FICTIONAL DEMO DOCUMENT — Camford City Council. Council tax bill 2026–27. Account reference: 55511122. Annual charge: £1,845.60. First instalment of £184.56 due 1 April 2026. Band D.');

  insert into public.document_fields (document_id, household_id, key, label, value_text, value_date, value_number, currency, confidence, source, page_number, evidence_text) values
    (doc, hh, 'reference_number', 'Account reference', '55511122', null, null, null, 0.97, 'ai', 1, 'Account reference: 55511122'),
    (doc, hh, 'annual_charge', 'Annual charge', null, null, 1845.60, 'GBP', 0.96, 'ai', 1, 'Annual charge: £1,845.60');

  -- 4. Fictional boiler warranty ---------------------------------------
  insert into public.documents (
    id, household_id, created_by, title, category, provider, doc_type,
    document_date, person_id, status, summary, summary_source,
    expiry_date, page_count, analysis_model, analysed_at
  ) values (
    gen_random_uuid(), hh, demo_user,
    '[FICTIONAL] HeatWell boiler warranty certificate', 'warranties_purchases', 'HeatWell', 'Warranty certificate',
    '2024-11-05', me, 'ready',
    'FICTIONAL demo document. Ten-year warranty certificate for a HeatWell combi boiler, valid until November 2034 subject to annual service.',
    'ai', '2034-11-05', 1, 'seed', now()
  ) returning id into doc;

  insert into public.document_pages (document_id, household_id, page_number, text) values
    (doc, hh, 1, 'FICTIONAL DEMO DOCUMENT — HeatWell. Warranty certificate. Boiler model: HW-Combi 30. Serial number: HW30-987654. Warranty registration: WR-2024-1105. Valid until 5 November 2034 provided the boiler is serviced annually.');

  insert into public.document_fields (document_id, household_id, key, label, value_text, value_date, value_number, currency, confidence, source, page_number, evidence_text) values
    (doc, hh, 'serial_number', 'Boiler serial number', 'HW30-987654', null, null, null, 0.95, 'ai', 1, 'Serial number: HW30-987654'),
    (doc, hh, 'warranty_registration', 'Warranty registration', 'WR-2024-1105', null, null, null, 0.95, 'ai', 1, 'Warranty registration: WR-2024-1105'),
    (doc, hh, 'warranty_expiry', 'Warranty valid until', null, '2034-11-05', null, null, 0.92, 'ai', 1, 'Valid until 5 November 2034');

  -- 5. Fictional NHS appointment letter --------------------------------
  insert into public.documents (
    id, household_id, created_by, title, category, provider, doc_type,
    document_date, person_id, status, summary, summary_source, action_required,
    appointment_at, page_count, analysis_model, analysed_at
  ) values (
    gen_random_uuid(), hh, demo_user,
    '[FICTIONAL] NHS outpatient appointment letter', 'medical_nhs', 'Camford NHS Trust', 'Appointment letter',
    '2026-07-20', me, 'ready',
    'FICTIONAL demo document. Outpatient appointment at Camford General Hospital on 15 September 2026 at 10:30.',
    'ai', 'Attend the appointment or call to rearrange at least 48 hours before.',
    '2026-09-15T10:30:00+01:00', 1, 'seed', now()
  ) returning id into doc;

  insert into public.document_pages (document_id, household_id, page_number, text) values
    (doc, hh, 1, 'FICTIONAL DEMO DOCUMENT — Camford NHS Trust. Outpatient appointment. Hospital number: CGH-0012345. Your appointment: Tuesday 15 September 2026, 10:30, Clinic 4, Camford General Hospital. If you cannot attend call 0100 000 0001 at least 48 hours in advance.');

  insert into public.document_fields (document_id, household_id, key, label, value_text, value_date, value_number, currency, confidence, source, page_number, evidence_text) values
    (doc, hh, 'nhs_reference', 'Hospital number', 'CGH-0012345', null, null, null, 0.96, 'ai', 1, 'Hospital number: CGH-0012345'),
    (doc, hh, 'appointment_date', 'Appointment date', null, '2026-09-15', null, null, 0.95, 'ai', 1, 'Tuesday 15 September 2026, 10:30');

  -- Tags
  insert into public.tags (household_id, name) values (hh, 'boiler'), (hh, 'house'), (hh, 'demo')
  on conflict do nothing;
end $$;
