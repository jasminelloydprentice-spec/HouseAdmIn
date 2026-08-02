import { computeNotificationDates, DEFAULT_LEAD_DAYS, leadLabel, notificationBody } from '../offsets';

describe('computeNotificationDates', () => {
  it('schedules all default offsets when far in the future', () => {
    const result = computeNotificationDates('2026-09-01', DEFAULT_LEAD_DAYS, '2026-06-14');
    expect(result.map((r) => r.leadDays)).toEqual([30, 14, 7, 1]);
    expect(result[0].fireDate).toBe('2026-08-02');
    expect(result[3].fireDate).toBe('2026-08-31');
  });

  it('drops offsets that are already past', () => {
    const result = computeNotificationDates('2026-06-20', DEFAULT_LEAD_DAYS, '2026-06-14');
    expect(result.map((r) => r.leadDays)).toEqual([1]); // only 19 June remains ahead (30/14/7 passed)
  });

  it('supports an on-the-day offset', () => {
    const result = computeNotificationDates('2026-06-14', [0], '2026-06-14');
    expect(result).toEqual([{ fireDate: '2026-06-14', leadDays: 0 }]);
  });

  it('deduplicates and ignores negative offsets', () => {
    const result = computeNotificationDates('2026-09-01', [7, 7, -3], '2026-06-14');
    expect(result.map((r) => r.leadDays)).toEqual([7]);
  });

  it('returns nothing for an invalid due date', () => {
    expect(computeNotificationDates('someday', DEFAULT_LEAD_DAYS)).toEqual([]);
  });

  it('is DST-safe (offsets around late March)', () => {
    const result = computeNotificationDates('2026-04-10', [14], '2026-03-01');
    expect(result[0].fireDate).toBe('2026-03-27');
  });
});

describe('labels', () => {
  it('leadLabel', () => {
    expect(leadLabel(0)).toBe('On the day');
    expect(leadLabel(1)).toBe('1 day before');
    expect(leadLabel(30)).toBe('30 days before');
  });
  it('notificationBody', () => {
    expect(notificationBody('Renew insurance', 0)).toBe('Renew insurance — due today.');
    expect(notificationBody('Renew insurance', 1)).toBe('Renew insurance — due tomorrow.');
    expect(notificationBody('Renew insurance', 7)).toBe('Renew insurance — due in 7 days.');
  });
});
