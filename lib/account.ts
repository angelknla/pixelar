import { tokensMatch } from '@/lib/auth';

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ITERATIONS = 120_000;
const encoder = new TextEncoder();

const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const decode = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

export const normalizeUsername = (value: string) => value.trim().toLowerCase();
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const isValidUsername = (value: string) => USERNAME.test(normalizeUsername(value));
export const isValidEmail = (value: string) => EMAIL.test(normalizeEmail(value));
export const isValidPassword = (value: string) => value.length >= 8 && value.length <= 128;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256
  );
  return `pbkdf2-sha256$${ITERATIONS}$${encode(salt)}$${encode(new Uint8Array(bits))}`;
};

export const verifyPassword = async (password: string, encoded: string): Promise<boolean> => {
  const [algorithm, iterationsText, saltText, expected, extra] = encoded.split('$');
  const iterations = Number(iterationsText);
  if (
    algorithm !== 'pbkdf2-sha256' ||
    !Number.isInteger(iterations) ||
    iterations < 1 ||
    iterations > 1_000_000 ||
    !saltText ||
    !expected ||
    extra !== undefined
  )
    return false;

  try {
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
      'deriveBits',
    ]);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: decode(saltText), iterations },
      key,
      256
    );
    return tokensMatch(encode(new Uint8Array(bits)), expected);
  } catch {
    return false;
  }
};
