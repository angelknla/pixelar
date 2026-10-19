export const COOKIE_NAME = 'pixelar_unlock';
export const VIEWER_COOKIE = 'pixelar_who';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

const encoder = new TextEncoder();

const encodeBytes = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const deriveToken = async (passcode: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`pixelar:v1:${passcode}`));

  return encodeBytes(new Uint8Array(digest));
};

const sessionSignature = async (memberId: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`pixelar:member:v1:${memberId}`)
  );

  return encodeBytes(new Uint8Array(signature));
};

export const createViewerToken = async (memberId: string, secret: string): Promise<string> =>
  `${memberId}.${await sessionSignature(memberId, secret)}`;

export const readViewerToken = async (token: string, secret: string): Promise<string | null> => {
  const separator = token.lastIndexOf('.');

  if (separator < 1) return null;

  const memberId = token.slice(0, separator);
  const expected = await sessionSignature(memberId, secret);

  return tokensMatch(token.slice(separator + 1), expected) ? memberId : null;
};

export const tokensMatch = (actual: string, expected: string): boolean => {
  if (actual.length !== expected.length) return false;

  let difference = 0;

  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return difference === 0;
};
