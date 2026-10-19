import 'server-only';

export const apiKey = (name: string): string => {
  const value = process.env[name];

  if (!value) throw new Error(`${name} is not configured. You can still add titles manually.`);

  return value;
};

export const fetchJson = async (
  url: URL,
  headers?: HeadersInit,
  cacheSeconds = 0
): Promise<unknown> => {
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
      ...(cacheSeconds
        ? { cache: 'force-cache' as const, next: { revalidate: cacheSeconds } }
        : { cache: 'no-store' as const }),
    });

    if (!response.ok) throw new Error('Provider unavailable.');

    return await response.json();
  } catch {
    throw new Error('The metadata provider is unavailable. Try again later or add manually.');
  }
};

export const record = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

export const array = (value: unknown): Record<string, unknown>[] => {
  return Array.isArray(value) ? value.map(record) : [];
};

export const string = (value: unknown): string | null => {
  return typeof value === 'string' && value.length ? value : null;
};

export const date = (value: unknown): string | null => {
  const s = string(value);

  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null;
};

export const score = (value: unknown): number | null => {
  const n = Number(value);

  return value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isInteger(n) &&
    n >= 0 &&
    n <= 100
    ? n
    : null;
};
