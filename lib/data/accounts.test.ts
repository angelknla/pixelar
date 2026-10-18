import { createAccount, getAccount, getCredentialByLogin } from './accounts';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  getSupabase: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  const query = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle };
  mocks.from.mockReturnValue(query);
  mocks.select.mockReturnValue(query);
  mocks.eq.mockReturnValue(query);
});

describe('accounts in the shared Supabase project', () => {
  it.each([
    'alice',
    'alice@example.com',
  ])('looks up %s only in Pixelar credentials', async (login) => {
    const credential = {
      member_id: 'pixelar-member',
      username: 'alice',
      email: 'alice@example.com',
      password_hash: 'hash',
    };
    mocks.maybeSingle.mockResolvedValue({ data: credential, error: null });
    expect(await getCredentialByLogin(login)).toEqual(credential);
    expect(mocks.from).toHaveBeenCalledWith('pixelar_member_credentials');
    expect(mocks.eq).toHaveBeenCalledWith(login.includes('@') ? 'email' : 'username', login);
  });

  it('limits profile lookup to the verified Pixelar member and joins Pixelar members', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        member_id: 'pixelar-member',
        username: 'alice',
        email: 'alice@example.com',
        members: { name: 'Alice' },
      },
      error: null,
    });
    expect(await getAccount('pixelar-member')).toEqual({
      memberId: 'pixelar-member',
      username: 'alice',
      email: 'alice@example.com',
      name: 'Alice',
    });
    expect(mocks.from).toHaveBeenCalledWith('pixelar_member_credentials');
    expect(mocks.select).toHaveBeenCalledWith(
      'member_id, username, email, members:pixelar_members!inner(name)'
    );
    expect(mocks.eq).toHaveBeenCalledWith('member_id', 'pixelar-member');
  });

  it('creates accounts using only the Pixelar transaction function', async () => {
    mocks.rpc.mockResolvedValue({ data: 'pixelar-member', error: null });
    expect(await createAccount('Alice', 'alice', 'alice@example.com', 'hash')).toEqual({
      memberId: 'pixelar-member',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('create_pixelar_account', {
      account_name: 'Alice',
      account_username: 'alice',
      account_email: 'alice@example.com',
      account_password_hash: 'hash',
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
