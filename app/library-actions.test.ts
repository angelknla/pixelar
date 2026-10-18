import { deleteItem, moveItem, saveItem } from './library-actions';

const mocks = vi.hoisted(() => ({
  requireAccount: vi.fn(),
  ownedItem: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
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
    select: mocks.select,
    maybeSingle: mocks.maybeSingle,
  };
  mocks.from.mockReturnValue(q);
  mocks.update.mockReturnValue(q);
  mocks.delete.mockReturnValue(q);
  mocks.select.mockReturnValue(q);
  mocks.eq.mockReturnValue(q);
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
});
