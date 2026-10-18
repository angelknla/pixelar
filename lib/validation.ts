import { statusesFor } from '@/lib/library';
import type { ItemInput, ItemKind, MetadataFields, Precision, Status } from '@/types/library';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid request.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    throw new Error('Check the text fields.');
  return value.trim();
}
export function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 30) throw new Error('Too many choices.');
  return [...new Set(value.map((v) => text(v, 80, true)))];
}
export function uuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
    throw new Error('Invalid item.');
  return value;
}
export function parseOverrides(value: unknown): Partial<MetadataFields> {
  const input = object(value);
  const output: Partial<MetadataFields> = {};
  for (const key of ['title', 'artwork', 'description', 'publisher', 'release_date'] as const) {
    if (!(key in input)) continue;
    const v = input[key];
    if (key === 'title') output.title = text(v, 300, true);
    else output[key] = v === null ? null : text(v, key === 'description' ? 20000 : 2000);
  }
  if (output.artwork && !/^https:\/\//.test(output.artwork))
    throw new Error('Artwork must use an HTTPS address.');
  if ('metascore' in input) {
    if (
      input.metascore !== null &&
      (typeof input.metascore !== 'number' ||
        !Number.isInteger(input.metascore) ||
        input.metascore < 0 ||
        input.metascore > 100)
    )
      throw new Error('Metascore must be between 0 and 100.');
    output.metascore = input.metascore as number | null;
  }
  if ('release_precision' in input) {
    if (!['unknown', 'year', 'month', 'day'].includes(String(input.release_precision)))
      throw new Error('Invalid release precision.');
    output.release_precision = input.release_precision as Precision;
  }
  if (output.release_date) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(output.release_date) ||
      Number.isNaN(Date.parse(output.release_date)) ||
      new Date(output.release_date).toISOString().slice(0, 10) !== output.release_date
    )
      throw new Error('Enter a valid release date.');
  }
  return output;
}
export function parseItem(value: unknown): ItemInput {
  const input = object(value);
  const kind = input.kind as ItemKind;
  if (
    !['game', 'movie', 'show'].includes(kind) ||
    !statusesFor(kind).includes(input.status as Status)
  )
    throw new Error('Choose a valid type and status.');
  const price = input.price;
  if (
    price !== null &&
    (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 9999999999)
  )
    throw new Error('Enter a valid price.');
  const currency = text(input.currency, 3, true).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Enter a three-letter currency code.');
  const reminderDays = input.reminder_days;
  if (
    !Array.isArray(reminderDays) ||
    reminderDays.length > 10 ||
    reminderDays.some((d) => !Number.isInteger(d) || d < 0 || d > 365)
  )
    throw new Error('Reminders must be 0–365 days before release.');
  if (typeof input.auto_move !== 'boolean') throw new Error('Invalid release setting.');
  return {
    ...(input.id ? { id: uuid(input.id) } : {}),
    kind,
    status: input.status as Status,
    metadata_id: input.metadata_id === null ? null : uuid(input.metadata_id),
    overrides: parseOverrides(input.overrides),
    platforms: kind === 'game' ? strings(input.platforms) : [],
    services: kind === 'game' ? [] : strings(input.services),
    price: kind === 'game' ? (price as number | null) : null,
    currency,
    notes: text(input.notes, 20000),
    auto_move: input.auto_move,
    reminder_days: [...new Set(reminderDays)] as number[],
  };
}
