import { supabase } from '../../lib/supabase';
import { ReminderRow } from '../documents/types';
import { cancelReminderNotifications, scheduleReminderNotifications } from './notifications';

export interface NewReminder {
  householdId: string;
  documentId: string | null;
  title: string;
  dueDate: string;
  leadDays: number[];
  source: 'ai_suggested' | 'user';
  notes?: string;
}

export async function createReminder(input: NewReminder): Promise<ReminderRow> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      household_id: input.householdId,
      document_id: input.documentId,
      title: input.title,
      due_date: input.dueDate,
      lead_days: input.leadDays,
      source: input.source,
      notes: input.notes ?? null,
      created_by: user.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  const reminder = data as ReminderRow;
  await scheduleReminderNotifications(reminder).catch(() => undefined);
  return reminder;
}

export async function setReminderStatus(reminder: ReminderRow, status: 'completed' | 'dismissed' | 'pending'): Promise<void> {
  const { error } = await supabase.from('reminders').update({ status }).eq('id', reminder.id);
  if (error) throw error;
  if (status === 'pending') {
    await scheduleReminderNotifications(reminder).catch(() => undefined);
  } else {
    await cancelReminderNotifications(reminder.id).catch(() => undefined);
  }
}

export async function updateReminder(reminder: ReminderRow, changes: { title?: string; dueDate?: string; leadDays?: number[] }): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .update({
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.dueDate !== undefined ? { due_date: changes.dueDate } : {}),
      ...(changes.leadDays !== undefined ? { lead_days: changes.leadDays } : {}),
    })
    .eq('id', reminder.id);
  if (error) throw error;
  await scheduleReminderNotifications({
    id: reminder.id,
    title: changes.title ?? reminder.title,
    due_date: changes.dueDate ?? reminder.due_date,
    lead_days: changes.leadDays ?? reminder.lead_days,
  }).catch(() => undefined);
}

export async function deleteReminder(reminderId: string): Promise<void> {
  const { error } = await supabase.from('reminders').delete().eq('id', reminderId);
  if (error) throw error;
  await cancelReminderNotifications(reminderId).catch(() => undefined);
}
