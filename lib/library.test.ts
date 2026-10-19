import { countdown, EMPTY_FIELDS, effectiveFields, localDay, releaseLabel } from './library';
import { parseItem, parseOverrides } from './validation';

describe('library metadata and dates', () => {
  it('preserves explicit clearing and all manual edits across refresh', () => {
    expect(
      effectiveFields(
        { ...EMPTY_FIELDS, title: 'Fetched', description: 'New', metascore: 90 },
        { title: 'My title', description: null, metascore: null }
      )
    ).toMatchObject({ title: 'My title', description: null, metascore: null });
  });
  it('counts local calendar days across London daylight saving', () => {
    const fields = {
      ...EMPTY_FIELDS,
      release_date: '2026-03-30',
      release_precision: 'day' as const,
    };
    expect(localDay('Europe/London', new Date('2026-03-29T23:30:00Z'))).toBe('2026-03-30');
    expect(countdown(fields, 'Europe/London', new Date('2026-03-28T23:30:00Z'))).toBe('2 days');
    expect(countdown(fields, 'Europe/London', new Date('2026-03-29T12:00:00Z'))).toBe('1 day');
    expect(countdown(fields, 'Europe/London', new Date('2026-03-29T23:30:00Z'))).toBe('Out today!');
    expect(countdown(fields, 'Europe/London', new Date('2026-03-31T12:00:00Z'))).toBeNull();
  });
  it('displays partial windows without countdowns', () => {
    const fields = {
      ...EMPTY_FIELDS,
      release_date: '2027-11-01',
      release_precision: 'month' as const,
    };
    expect(releaseLabel(fields)).toBe('Nov 2027');
    expect(countdown(fields, 'Europe/London')).toBeNull();
  });
  it('rejects impossible dates, invalid scores and unsafe artwork schemes', () => {
    expect(() => parseOverrides({ release_date: '2026-02-30' })).toThrow();
    expect(() => parseOverrides({ metascore: 101 })).toThrow();
    expect(() => parseOverrides({ artwork: 'javascript:alert(1)' })).toThrow();
  });
  it('rejects statuses from another kind and client-supplied extra owner fields', () => {
    const value = {
      kind: 'game',
      status: 'backlog',
      metadata_id: null,
      overrides: { title: 'Hades' },
      platforms: [],
      services: [],
      price: null,
      currency: 'GBP',
      notes: '',
      auto_move: true,
      reminder_days: [0],
      member_id: 'someone-else',
    };
    expect(parseItem(value)).not.toHaveProperty('member_id');
    expect(() => parseItem({ ...value, status: 'watched' })).toThrow();
  });
});
