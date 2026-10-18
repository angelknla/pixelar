import 'server-only';
export function apiKey(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured. You can still add titles manually.`);
  return value;
}
export async function fetchJson(url: URL, headers?: HeadersInit): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Provider unavailable.');
    return await response.json();
  } catch {
    throw new Error('The metadata provider is unavailable. Try again later or add manually.');
  }
}
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function array(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}
export function string(value: unknown): string | null {
  return typeof value === 'string' && value.length ? value : null;
}
export function date(value: unknown): string | null {
  const s = string(value);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null;
}
export function score(value: unknown): number | null {
  const n = Number(value);
  return value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isInteger(n) &&
    n >= 0 &&
    n <= 100
    ? n
    : null;
}
