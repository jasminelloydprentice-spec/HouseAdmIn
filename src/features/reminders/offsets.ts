import { addDaysIso, daysBetween, parseIsoDate, todayIso } from '../../utils/dates';

/** Default lead offsets, in days before the due date. */
export const DEFAULT_LEAD_DAYS = [30, 14, 7, 1] as const;

export interface ScheduledNotification {
  /** ISO date the notification should fire (09:00 local time). */
  fireDate: string;
  /** Days before the due date. */
  leadDays: number;
}

/**
 * Compute which lead notifications are still in the future.
 * Offsets whose fire date has already passed are silently dropped —
 * creating a reminder 5 days before a deadline schedules only the 1-day
 * notice (plus the due date itself).
 */
export function computeNotificationDates(
  dueDateIso: string,
  leadDays: readonly number[],
  fromIso = todayIso(),
): ScheduledNotification[] {
  if (!parseIsoDate(dueDateIso)) return [];
  const out: ScheduledNotification[] = [];
  const uniqueSorted = [...new Set(leadDays.filter((d) => Number.isInteger(d) && d >= 0))].sort((a, b) => b - a);
  for (const lead of uniqueSorted) {
    const fireDate = addDaysIso(dueDateIso, -lead);
    if (!fireDate) continue;
    const diff = daysBetween(fromIso, fireDate);
    if (diff !== null && diff >= 0) out.push({ fireDate, leadDays: lead });
  }
  return out;
}

/** Human description of a lead offset: 30 → "30 days before". */
export function leadLabel(leadDays: number): string {
  if (leadDays === 0) return 'On the day';
  if (leadDays === 1) return '1 day before';
  return `${leadDays} days before`;
}

/** Notification body copy for a reminder firing. */
export function notificationBody(title: string, leadDays: number): string {
  if (leadDays === 0) return `${title} — due today.`;
  if (leadDays === 1) return `${title} — due tomorrow.`;
  return `${title} — due in ${leadDays} days.`;
}
