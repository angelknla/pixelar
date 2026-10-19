// @vitest-environment node
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  db: vi.fn(),
  profile: vi.fn(),
  metadata: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/session', () => ({ getCurrentAccount: mocks.account }));
vi.mock('@/lib/data/library', () => ({ db: mocks.db, profileFor: mocks.profile }));
vi.mock('@/lib/providers', () => ({ getMetadata: mocks.metadata }));

const id = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const third = '33333333-3333-4333-8333-333333333333';

const source = { id: 'cached', kind: 'movie', provider: 'tmdb', provider_id: '7', region: 'GB' };

let items: { id: string; kind: string; metadata_id: string | null }[];
let sources: (typeof source)[];
let itemQuery: Record<string, ReturnType<typeof vi.fn>>;

const request = (ids: string[] = [id], origin = 'https://pixelar.test') => {
  return new Request('https://pixelar.test/api/metadata/sync', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_ids: ids, member_id: 'attacker' }),
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  items = [{ id, kind: 'movie', metadata_id: 'cached' }];
  sources = [source];
  mocks.account.mockResolvedValue({ memberId: 'verified-owner' });
  mocks.profile.mockResolvedValue({ region: 'GB' });
  mocks.metadata.mockResolvedValue({ id: 'cached' });
  itemQuery = {
    select: vi.fn().mockImplementation(() => itemQuery),
    eq: vi.fn().mockImplementation(() => itemQuery),
    in: vi.fn().mockImplementation(async () => ({ data: items, error: null })),
    update: vi.fn().mockImplementation(() => itemQuery),
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are intentionally awaitable.
    then: vi.fn().mockImplementation((resolve) => Promise.resolve({ error: null }).then(resolve)),
  };
  mocks.db.mockReturnValue({
    from: vi
      .fn()
      .mockImplementation((table) =>
        table === 'pixelar_items'
          ? itemQuery
          : { select: () => ({ in: async () => ({ data: sources, error: null }) }) }
      ),
  });
});

it('derives ownership from the session, refreshes linked data, and never rewrites overrides', async () => {
  const response = await POST(request());

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ outcomes: [{ id, state: 'updated' }] });
  expect(itemQuery.eq).toHaveBeenCalledWith('member_id', 'verified-owner');
  expect(mocks.metadata).toHaveBeenCalledWith('tmdb', '7', 'movie', 'GB', true);
  expect(itemQuery.update).not.toHaveBeenCalled();
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
});

it('rejects unauthenticated, wrong-origin, and cross-account batches before fetching providers', async () => {
  mocks.account.mockResolvedValueOnce(null);

  expect((await POST(request())).status).toBe(401);
  expect((await POST(request([id], 'https://attacker.test'))).status).toBe(400);

  items = [];

  expect((await POST(request())).status).toBe(400);
  expect(mocks.metadata).not.toHaveBeenCalled();
});

it('deduplicates linked titles and skips manual titles in one batch', async () => {
  items.push(
    { id: second, kind: 'movie', metadata_id: 'cached' },
    { id: third, kind: 'show', metadata_id: null }
  );

  const response = await POST(request([id, second, third]));

  expect((await response.json()).outcomes).toEqual([
    { id, state: 'updated' },
    { id: second, state: 'updated' },
    { id: third, state: 'skipped' },
  ]);
  expect(mocks.metadata).toHaveBeenCalledTimes(1);
});

it('reports partial provider failures while updating the other title', async () => {
  items.push({ id: second, kind: 'show', metadata_id: 'series' });
  sources.push({ ...source, id: 'series', kind: 'show', provider_id: '8' });
  mocks.metadata
    .mockRejectedValueOnce(new Error('Provider failure with secret'))
    .mockResolvedValueOnce({ id: 'series' });

  const response = await POST(request([id, second]));

  expect(await response.json()).toEqual({
    outcomes: [
      { id, state: 'failed' },
      { id: second, state: 'updated' },
    ],
  });
});

it('relinks changed regions using only the owner and source link', async () => {
  mocks.profile.mockResolvedValue({ region: 'US' });
  mocks.metadata.mockResolvedValue({ id: 'new-region' });

  expect((await POST(request())).status).toBe(200);
  expect(mocks.metadata).toHaveBeenCalledWith('tmdb', '7', 'movie', 'US', true);
  expect(itemQuery.update).toHaveBeenCalledWith({ metadata_id: 'new-region' });
  expect(itemQuery.eq).toHaveBeenCalledWith('member_id', 'verified-owner');
  expect(itemQuery.eq).toHaveBeenCalledWith('metadata_id', 'cached');
});

it('limits batch size and validates item identifiers', async () => {
  for (const ids of [[], ['invalid'], [id, second, third, id, second]])
    expect((await POST(request(ids))).status).toBe(400);

  expect(mocks.metadata).not.toHaveBeenCalled();
});
