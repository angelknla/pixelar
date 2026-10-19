// @vitest-environment node
import { EMPTY_FIELDS } from '@/lib/library';
import { getMetadata } from './index';

const mocks = vi.hoisted(() => ({ db: vi.fn(), details: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/data/library', () => ({ db: mocks.db }));
vi.mock('./rawg', () => ({ rawg: { details: mocks.details } }));
vi.mock('./tmdb', () => ({ tmdb: { details: mocks.details } }));

const cached = {
  id: 'cached',
  provider: 'rawg',
  provider_id: '1',
  kind: 'game',
  region: 'GB',
  fields: {
    ...EMPTY_FIELDS,
    kind: 'game',
    title: 'Old title',
    platforms: [],
    services: [],
    source_url: 'https://rawg.io/games/1',
  },
  fetched_at: '2020-01-01T00:00:00Z',
};

let existing: { data: typeof cached | null; error: object | null };
let query: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  existing = { data: cached, error: null };
  query = {
    select: vi.fn().mockImplementation(() => query),
    eq: vi.fn().mockImplementation(() => query),
    maybeSingle: vi.fn().mockImplementation(async () => existing),
    upsert: vi.fn().mockImplementation(() => query),
    single: vi.fn().mockImplementation(async () => ({
      data: { ...cached, fields: { ...cached.fields, title: 'Fresh title' } },
      error: null,
    })),
  };
  mocks.db.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
  mocks.details.mockResolvedValue({ ...cached.fields, title: 'Fresh title' });
});

it('reuses old persisted metadata without provider requests, including linking', async () => {
  expect(await getMetadata('rawg', '1', 'game', 'GB')).toEqual(cached);
  expect(await getMetadata('rawg', '1', 'game', 'GB')).toEqual(cached);
  expect(mocks.details).not.toHaveBeenCalled();
  expect(query.upsert).not.toHaveBeenCalled();
  expect(query.eq).toHaveBeenCalledWith('region', 'GB');
});

it('explicitly refreshes and caches fetched values without touching personal items', async () => {
  expect(await getMetadata('rawg', '1', 'game', 'GB', true)).toMatchObject({
    fields: { title: 'Fresh title' },
  });
  expect(mocks.details).toHaveBeenCalledWith('1', 'game', 'GB');
  expect(query.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ provider: 'rawg', provider_id: '1', region: 'GB' }),
    { onConflict: 'provider,provider_id,kind,region' }
  );
  expect(mocks.db().from).toHaveBeenCalledTimes(2);
  expect(
    mocks.db().from.mock.calls.every(([table]: [string]) => table === 'pixelar_metadata_cache')
  ).toBe(true);
});

it('coalesces overlapping refreshes, then permits a later explicit refresh', async () => {
  let finish!: (value: typeof cached.fields) => void;

  mocks.details.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );

  const first = getMetadata('rawg', '1', 'game', 'GB', true);
  const second = getMetadata('rawg', '1', 'game', 'GB', true);

  await vi.waitFor(() => expect(mocks.details).toHaveBeenCalledTimes(1));
  finish(cached.fields);
  await Promise.all([first, second]);

  expect(query.upsert).toHaveBeenCalledTimes(1);

  await getMetadata('rawg', '1', 'game', 'GB', true);

  expect(mocks.details).toHaveBeenCalledTimes(2);
});

it('keeps failed refreshes out of the cache and permits retry', async () => {
  mocks.details.mockRejectedValueOnce(new Error('Provider unavailable.'));

  await expect(getMetadata('rawg', '1', 'game', 'GB', true)).rejects.toThrow(
    'Provider unavailable.'
  );
  expect(query.upsert).not.toHaveBeenCalled();
  expect(await getMetadata('rawg', '1', 'game', 'GB')).toEqual(cached);

  await getMetadata('rawg', '1', 'game', 'GB', true);

  expect(mocks.details).toHaveBeenCalledTimes(2);
});

it('fetches uncached metadata and rejects cache failures or incompatible providers', async () => {
  existing.data = null;
  await getMetadata('rawg', '1', 'game', 'GB');

  expect(mocks.details).toHaveBeenCalledTimes(1);

  existing.error = {};

  await expect(getMetadata('rawg', '1', 'game', 'GB')).rejects.toThrow(
    'Metadata cache unavailable.'
  );
  await expect(getMetadata('tmdb', '1', 'game', 'GB')).rejects.toThrow('Invalid provider');
  expect(mocks.details).toHaveBeenCalledTimes(1);
});
