import type { ItemKind, LibraryItem, MetadataFields, ProfileRow, Status } from '@/types/library';

export const GAME_STATUSES: Status[] = [
  'anticipated',
  'scheduled',
  'backlog',
  'playing',
  'replay',
  'completed',
  'dropped',
];
export const SCREEN_STATUSES: Status[] = [
  'upcoming',
  'watchlist',
  'watching',
  'watched',
  'dropped',
];
export const PLATFORMS = [
  'PC',
  'PlayStation 5',
  'PlayStation 4',
  'Xbox Series S/X',
  'Xbox One',
  'Nintendo Switch',
  'Nintendo Switch 2',
  'Steam Deck',
  'iOS',
  'Android',
];
export const SERVICES = [
  'Netflix',
  'Prime Video',
  'HBO',
  'Apple TV',
  'Disney+',
  'BBC iPlayer',
  'Other',
];
export function serviceLabel(value: string): string {
  if (/^(hbo(?: max)?|max)$/i.test(value)) return 'HBO Max';
  if (/^apple tv(?:\+| plus)?$/i.test(value)) return 'Apple TV';
  if (/^disney(?:\+| plus)$/i.test(value)) return 'Disney+';
  if (/^(?:amazon )?prime\s*(?:video)?$/i.test(value)) return 'Prime Video';
  return value;
}
export const statusesFor = (kind: ItemKind) => (kind === 'game' ? GAME_STATUSES : SCREEN_STATUSES);
export const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
export const EMPTY_FIELDS: MetadataFields = {
  title: '',
  artwork: null,
  description: null,
  publisher: null,
  release_date: null,
  release_precision: 'unknown',
  metascore: null,
};
export const defaultProfile = (memberId: string): ProfileRow => ({
  member_id: memberId,
  region: 'GB',
  currency: 'GBP',
  timezone: 'Europe/London',
  platforms: [],
  services: [],
  notifications_enabled: true,
  default_release_reminder: true,
  theme: 'dark',
  avatar_path: null,
});
export function effectiveFields(
  base: Partial<MetadataFields> | null,
  overrides: Partial<MetadataFields>
): MetadataFields {
  return { ...EMPTY_FIELDS, ...base, ...overrides };
}
export function localDay(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function releaseLabel(fields: MetadataFields): string {
  if (!fields.release_date || fields.release_precision === 'unknown') return 'Date to be announced';
  const date = new Date(`${fields.release_date}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    year: 'numeric',
    ...(fields.release_precision !== 'year' ? { month: 'short' as const } : {}),
    ...(fields.release_precision === 'day' ? { day: 'numeric' as const } : {}),
  }).format(date);
}
export function countdown(
  fields: MetadataFields,
  timezone: string,
  now = new Date()
): string | null {
  if (fields.release_precision !== 'day' || !fields.release_date) return null;
  const days = Math.round(
    (Date.parse(fields.release_date) - Date.parse(localDay(timezone, now))) / 86400000
  );
  return days > 0 ? `${days} day${days === 1 ? '' : 's'}` : days === 0 ? 'Out today!' : null;
}
export function isUpcoming(item: LibraryItem, timezone: string): boolean {
  const { release_date: date, release_precision: precision } = item.fields;
  if (!date || precision === 'unknown') return false;
  const today = localDay(timezone);
  return precision === 'year'
    ? date.slice(0, 4) >= today.slice(0, 4)
    : precision === 'month'
      ? date.slice(0, 7) >= today.slice(0, 7)
      : date >= today;
}
