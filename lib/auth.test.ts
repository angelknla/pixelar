import { createHash, createHmac } from 'node:crypto';
import {
  COOKIE_NAME,
  createViewerToken,
  deriveToken,
  readViewerToken,
  tokensMatch,
  VIEWER_COOKIE,
} from '@/lib/auth';

describe('authentication tokens', () => {
  it('derives stable tokens without exposing the passcode', async () => {
    const token = await deriveToken('test-passcode');

    expect(token).toBe(await deriveToken('test-passcode'));
    expect(token).not.toContain('test-passcode');
    expect(token).not.toBe(await deriveToken('another-passcode'));
  });

  it('accepts a signed identity and rejects altered identities and secrets', async () => {
    const token = await createViewerToken('member-id', 'test-secret');

    expect(await readViewerToken(token, 'test-secret')).toBe('member-id');
    expect(await readViewerToken(token.replace('member-id', 'other-id'), 'test-secret')).toBeNull();
    expect(await readViewerToken(token, 'other-secret')).toBeNull();
    expect(await readViewerToken('invalid', 'test-secret')).toBeNull();
  });

  it('compares complete tokens', () => {
    expect(tokensMatch('abc', 'abc')).toBe(true);
    expect(tokensMatch('abc', 'abd')).toBe(false);
    expect(tokensMatch('abc', 'abcd')).toBe(false);
  });

  it('rejects Caelum sessions even when both apps use the same passcode', async () => {
    const secret = 'shared-app-passcode';
    const memberId = 'member-id';
    const caelumUnlock = createHash('sha256').update(`caelum:v1:${secret}`).digest('base64url');
    const caelumSignature = createHmac('sha256', secret)
      .update(`caelum:member:v1:${memberId}`)
      .digest('base64url');

    expect(tokensMatch(caelumUnlock, await deriveToken(secret))).toBe(false);
    expect(await readViewerToken(`${memberId}.${caelumSignature}`, secret)).toBeNull();
    expect(COOKIE_NAME).toBe('pixelar_unlock');
    expect(VIEWER_COOKIE).toBe('pixelar_who');
  });
});
