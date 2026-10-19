import {
  hashPassword,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  verifyPassword,
} from '@/lib/account';

describe('account credentials', () => {
  it('uses salted hashes and verifies passwords', async () => {
    const hash = await hashPassword('a-test-password');

    expect(hash).toMatch(/^pbkdf2-sha256\$120000\$/);
    expect(await verifyPassword('a-test-password', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
    expect(await hashPassword('a-test-password')).not.toBe(hash);
  });

  it('rejects malformed stored hashes without throwing', async () => {
    expect(await verifyPassword('password', 'invalid')).toBe(false);
    expect(await verifyPassword('password', 'pbkdf2-sha256$-1$salt$hash')).toBe(false);
    expect(await verifyPassword('password', 'pbkdf2-sha256$120000$!$hash')).toBe(false);
  });

  it('validates account fields', () => {
    expect(isValidUsername(' Alice_01 ')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidEmail('alice@example.com')).toBe(true);
    expect(isValidEmail('alice')).toBe(false);
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('short')).toBe(false);
    expect(isValidPassword('a'.repeat(129))).toBe(false);
  });
});
