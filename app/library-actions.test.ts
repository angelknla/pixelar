import { deleteItem, markAllNotificationsRead, moveItem, saveItem } from './library-actions';

const mocks = vi.hoisted(() => ({
  requireAccount: vi.fn(),
  ownedItem: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('@/lib/data/library', () => ({
  requireAccount: mocks.requireAccount,
  ownedItem: mocks.ownedItem,
  db: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
const id = '11111111-1111-4111-8111-111111111111';
const input = {
  kind: 'game',
  status: 'backlog',
  metadata_id: null,
  overrides: { title: 'Manual' },
  platforms: [],
  services: [],
  price: null,
  currency: 'GBP',
  notes: '',
  auto_move: true,
  reminder_days: [0],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAccount.mockResolvedValue({ memberId: 'verified-owner' });
  mocks.ownedItem.mockResolvedValue({ kind: 'game' });
  const q = {
    update: mocks.update,
    delete: mocks.delete,
    eq: mocks.eq,
    is: mocks.is,
    select: mocks.select,
    maybeSingle: mocks.maybeSingle,
  };
  mocks.from.mockReturnValue(q);
  mocks.update.mockReturnValue(q);
  mocks.delete.mockReturnValue(q);
  mocks.select.mockReturnValue(q);
  mocks.eq.mockReturnValue(q);
  mocks.is.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ data: id, error: null });
});
describe('owner-checked library actions', () => {
  it('passes the verified session owner to atomic save, ignoring input owner', async () => {
    expect(await saveItem({ ...input, member_id: 'attacker' })).toEqual({ id });
    expect(mocks.rpc).toHaveBeenCalledWith('pixelar_save_item', {
      owner_id: 'verified-owner',
      payload: input,
    });
  });
  it('does not save or delete another account item', async () => {
    mocks.ownedItem.mockRejectedValue(new Error('Item not found.'));
    expect(await saveItem({ ...input, id })).toHaveProperty('error');
    expect(await deleteItem(id)).toHaveProperty('error');
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });
  it('filters status changes by owner and item id', async () => {
    expect(await moveItem(id, 'playing')).toEqual({});
    expect(mocks.eq).toHaveBeenCalledWith('member_id', 'verified-owner');
    expect(mocks.eq).toHaveBeenCalledWith('id', id);
  });
  it('rejects kind-incompatible changes before mutation', async () => {
    expect(await moveItem(id, 'watching')).toHaveProperty('error');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('marks only the verified owner’s unread notifications without overwriting read timestamps', async () => {
    expect(await markAllNotificationsRead()).toEqual({});
    expect(mocks.from).toHaveBeenCalledWith('pixelar_notifications');
    expect(mocks.update).toHaveBeenCalledWith({ read_at: expect.any(String) });
    expect(mocks.eq).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenCalledWith('member_id', 'verified-owner');
    expect(mocks.is).toHaveBeenCalledWith('read_at', null);
    expect(mocks.revalidate).toHaveBeenCalledWith('/', 'layout');
  });
  it('reports a failed bulk read without revalidating', async () => {
    mocks.is.mockResolvedValueOnce({ error: { message: 'Database unavailable' } });
    expect(await markAllNotificationsRead()).toHaveProperty('error');
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it('requires a signed-in account before marking notifications read', async () => {
    mocks.requireAccount.mockRejectedValueOnce(new Error('Sign in required'));
    await expect(markAllNotificationsRead()).rejects.toThrow('Sign in required');
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
