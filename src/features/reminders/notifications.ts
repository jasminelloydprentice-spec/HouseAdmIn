import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { computeNotificationDates, notificationBody } from './offsets';

/**
 * Local notification scheduling for reminders. Deliberately separate from
 * extracted document fields: notifications are only ever scheduled from a
 * user-confirmed reminder, never directly from AI-detected dates.
 *
 * Scheduled notification ids are stored locally per reminder so they can be
 * cancelled when the reminder is completed/dismissed/deleted.
 */

const STORE_KEY = 'paperkeep.reminderNotifications';

async function loadMap(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

async function saveMap(map: Record<string, string[]>): Promise<void> {
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(map)).catch(() => undefined);
}

/** Ask permission lazily — only when the user first enables a reminder. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}

export async function scheduleReminderNotifications(reminder: {
  id: string;
  title: string;
  due_date: string;
  lead_days: number[];
}): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const granted = await ensureNotificationPermission();
  if (!granted) return 0;

  await cancelReminderNotifications(reminder.id);

  const schedule = computeNotificationDates(reminder.due_date, [...reminder.lead_days, 0]);
  const ids: string[] = [];
  for (const item of schedule) {
    const fireAt = new Date(`${item.fireDate}T09:00:00`);
    if (fireAt.getTime() <= Date.now()) continue;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Paperwork reminder',
        body: notificationBody(reminder.title, item.leadDays),
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
    ids.push(id);
  }
  const map = await loadMap();
  map[reminder.id] = ids;
  await saveMap(map);
  return ids.length;
}

export async function cancelReminderNotifications(reminderId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const map = await loadMap();
  const ids = map[reminderId] ?? [];
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  delete map[reminderId];
  await saveMap(map);
}
