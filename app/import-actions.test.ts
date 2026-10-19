import { saveReviewedImport } from './import-actions';

const mocks = vi.hoisted(() => ({ save: vi.fn(), account: vi.fn() }));

vi.mock('@/app/library-actions', () => ({ saveItem: mocks.save }));
vi.mock('@/lib/data/library', () => ({ requireAccount: mocks.account }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.account.mockResolvedValue({ memberId: 'owner' });
});

it('saves only reviewed payloads and returns failed keys for safe retry', async () => {
  mocks.save
    .mockResolvedValueOnce({ id: 'saved' })
    .mockResolvedValueOnce({ error: 'Invalid title' });

  expect(
    await saveReviewedImport([
      { key: 'one', item: { title: 'A' } },
      { key: 'two', item: { title: 'B' } },
    ])
  ).toEqual({ saved: ['one'], errors: [{ key: 'two', error: 'Invalid title' }] });
  expect(mocks.save).toHaveBeenCalledTimes(2);
});

it('does not save an empty selection', async () => {
  expect(await saveReviewedImport([])).toEqual({ saved: [], errors: [] });
  expect(mocks.save).not.toHaveBeenCalled();
});
