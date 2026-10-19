import { updateProfile } from './profile-actions';

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  credential: vi.fn(),
  verify: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/data/library', () => ({
  requireAccount: mocks.account,
  db: () => ({ rpc: mocks.rpc }),
}));
vi.mock('@/lib/data/accounts', () => ({ getCredentialByLogin: mocks.credential }));
vi.mock('@/lib/account', async () => ({
  ...(await vi.importActual<typeof import('@/lib/account')>('@/lib/account')),
  verifyPassword: mocks.verify,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const settings = {
  name: 'Alice',
  email: 'alice@example.com',
  password: '',
  region: 'GB',
  currency: 'GBP',
  timezone: 'Europe/London',
  platforms: [],
  services: [],
  notifications_enabled: true,
  default_release_reminder: true,
  theme: 'system',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.account.mockResolvedValue({
    memberId: 'owner',
    email: 'alice@example.com',
    username: 'alice',
  });
  mocks.credential.mockResolvedValue({ member_id: 'owner', password_hash: 'hash' });
  mocks.verify.mockResolvedValue(true);
  mocks.rpc.mockResolvedValue({ error: null });
});

describe('profile updates', () => {
  it('saves unchanged email without password verification, using session ownership', async () => {
    expect(await updateProfile({ ...settings, member_id: 'other' })).toEqual({});
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls[0][1].owner_id).toBe('owner');
  });

  it('requires current password to change email and handles duplicate emails', async () => {
    expect(await updateProfile({ ...settings, email: 'new@example.com' })).toHaveProperty('error');
    expect(mocks.rpc).not.toHaveBeenCalled();

    mocks.verify.mockResolvedValue(false);

    expect(
      await updateProfile({ ...settings, email: 'new@example.com', password: 'wrong' })
    ).toHaveProperty('error', 'Your current password is incorrect.');

    mocks.verify.mockResolvedValue(true);
    mocks.rpc.mockResolvedValue({ error: { code: '23505' } });

    expect(
      await updateProfile({ ...settings, email: 'new@example.com', password: 'correct' })
    ).toHaveProperty('error', 'That email address is already in use.');
  });

  it('rejects invalid timezones before saving', async () => {
    expect(await updateProfile({ ...settings, timezone: 'Unknown/Place' })).toHaveProperty('error');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

it('preserves spaces in a password when confirming an email change', async () => {
  expect(
    await updateProfile({
      ...settings,
      email: 'new@example.com',
      password: ' password with spaces ',
    })
  ).toEqual({});
  expect(mocks.verify).toHaveBeenCalledWith(' password with spaces ', 'hash');
});
