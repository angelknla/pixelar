import { COOKIE_NAME, deriveToken, readViewerToken, VIEWER_COOKIE } from '@/lib/auth';
import { lock, loginWithCredentials, registerAccount } from './auth-actions';

const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  credential: vi.fn(),
  createAccount: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: mocks.setCookie, delete: mocks.deleteCookie }),
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/supabase/server', () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock('@/lib/data/accounts', () => ({
  createAccount: mocks.createAccount,
  getCredentialByLogin: mocks.credential,
}));
vi.mock('@/lib/account', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/account')>()),
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
}));

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('APP_PASSCODE', 'test-app-passcode');
  mocks.configured.mockReturnValue(true);
  mocks.verifyPassword.mockResolvedValue(true);
  mocks.hashPassword.mockResolvedValue('salted-password-hash');
  mocks.credential.mockResolvedValue({ member_id: 'member-1', password_hash: 'stored-hash' });
  mocks.createAccount.mockResolvedValue({ memberId: 'member-1' });
});

afterEach(() => vi.unstubAllEnvs());

describe('account actions', () => {
  it('fails closed when the database or app passcode is unavailable', async () => {
    mocks.configured.mockReturnValue(false);
    expect(
      await loginWithCredentials({}, form({ login: 'alice', password: 'password' }))
    ).toHaveProperty('error');
    mocks.configured.mockReturnValue(true);
    vi.stubEnv('APP_PASSCODE', '');
    expect(await registerAccount({}, form({}))).toHaveProperty('error');
    expect(mocks.credential).not.toHaveBeenCalled();
    expect(mocks.createAccount).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it('does not establish a session for an incorrect password', async () => {
    mocks.verifyPassword.mockResolvedValue(false);
    const result = await loginWithCredentials(
      {},
      form({ login: 'alice', password: 'wrong-password' })
    );
    expect(result.error).toBe('Username/email or password is incorrect.');
    expect(mocks.setCookie).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('normalizes login and creates signed, secure production cookies', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(
      loginWithCredentials({}, form({ login: ' ALICE@EXAMPLE.COM ', password: 'password' }))
    ).rejects.toThrow('redirect:/');
    expect(mocks.credential).toHaveBeenCalledWith('alice@example.com');
    const unlock = mocks.setCookie.mock.calls.find(([name]) => name === COOKIE_NAME);
    const viewer = mocks.setCookie.mock.calls.find(([name]) => name === VIEWER_COOKIE);
    expect(unlock?.[1]).toBe(await deriveToken('test-app-passcode'));
    expect(await readViewerToken(viewer?.[1], 'test-app-passcode')).toBe('member-1');
    expect(viewer?.[2]).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 90,
    });
  });

  it('rejects an incorrect registration passcode before writing an account', async () => {
    expect(await registerAccount({}, form({ passcode: 'wrong-passcode' }))).toHaveProperty('error');
    expect(mocks.createAccount).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it('registers normalized credentials and stores a hash instead of a password', async () => {
    await expect(
      registerAccount(
        {},
        form({
          passcode: 'test-app-passcode',
          name: ' Alice ',
          username: ' Alice ',
          email: ' ALICE@EXAMPLE.COM ',
          password: 'valid-password',
        })
      )
    ).rejects.toThrow('redirect:/');
    expect(mocks.createAccount).toHaveBeenCalledWith(
      'Alice',
      'alice',
      'alice@example.com',
      'salted-password-hash'
    );
    expect(mocks.setCookie).toHaveBeenCalledTimes(2);
  });

  it('deletes both cookies when signing out', async () => {
    await expect(lock()).rejects.toThrow('redirect:/');
    expect(mocks.deleteCookie).toHaveBeenCalledWith(COOKIE_NAME);
    expect(mocks.deleteCookie).toHaveBeenCalledWith(VIEWER_COOKIE);
  });
});
