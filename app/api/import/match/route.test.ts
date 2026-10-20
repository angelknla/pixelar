// @vitest-environment node
import type { ItemKind } from '@/types/library';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  profile: vi.fn(),
  search: vi.fn(),
  metadata: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/session', () => ({ getCurrentAccount: mocks.account }));
vi.mock('@/lib/data/library', () => ({ profileFor: mocks.profile }));
vi.mock('@/lib/providers', () => ({
  providerFor: () => ({ search: mocks.search }),
  getMetadata: mocks.metadata,
}));

const row = { id: 'line-0', title: 'Dune', kind: null, uncertain: false, date_hint: null };
const result = {
  provider: 'tmdb',
  provider_id: '1',
  kind: 'movie',
  title: 'Dune',
  artwork: null,
  year: '2021',
};
const request = (rows: unknown = [row], origin = 'https://pixelar.test', autoLink = true) =>
  new Request('https://pixelar.test/api/import/match', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows, auto_link: autoLink, member_id: 'attacker', region: 'US' }),
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.account.mockResolvedValue({ memberId: 'verified-owner' });
  mocks.profile.mockResolvedValue({ region: 'GB' });
  mocks.search.mockImplementation(async (_query: string, kind: ItemKind) =>
    kind === 'movie' ? [result] : []
  );
  mocks.metadata.mockResolvedValue({ id: 'metadata', kind: 'movie' });
});

it('detects a mixed-list title, uses the verified profile region, and fetches clear-match metadata', async () => {
  const response = await POST(request());
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(mocks.profile).toHaveBeenCalledWith('verified-owner');
  expect(mocks.search.mock.calls.map((call) => call.slice(0, 3))).toEqual([
    ['Dune', 'movie', 'GB'],
    ['Dune', 'show', 'GB'],
    ['Dune', 'game', 'GB'],
  ]);
  expect(mocks.metadata).toHaveBeenCalledWith('tmdb', '1', 'movie', 'GB');
  expect(data.outcomes[0].metadata).toEqual({ id: 'metadata', kind: 'movie' });
});

it('searches only the selected type and supports manual suggestion without automatic linking', async () => {
  const response = await POST(request([{ ...row, kind: 'movie' }], undefined, false));

  expect(mocks.search).toHaveBeenCalledTimes(1);
  expect(mocks.metadata).not.toHaveBeenCalled();
  expect((await response.json()).outcomes[0].results).toEqual([result]);
});

it('preserves successful suggestions but does not infer a type when any source fails', async () => {
  mocks.search.mockImplementation(async (_query: string, kind: ItemKind) => {
    if (kind === 'game') throw new Error('secret provider URL');

    return kind === 'movie' ? [result] : [];
  });

  const response = await POST(request());
  const outcome = (await response.json()).outcomes[0];

  expect(outcome.results).toEqual([result]);
  expect(outcome.metadata).toBeNull();
  expect(outcome.error).toContain('Some sources are unavailable');
  expect(outcome.error).not.toContain('secret');
  expect(mocks.metadata).not.toHaveBeenCalled();
});

it('keeps ambiguous versions for review and uses a year when supplied', async () => {
  mocks.search.mockResolvedValue([result, { ...result, provider_id: '2', year: '1984' }]);

  const response = await POST(
    request([
      { ...row, kind: 'movie' },
      { ...row, id: 'line-1', kind: 'movie', title: 'Dune (2021)' },
    ])
  );
  const outcomes = (await response.json()).outcomes;

  expect(outcomes[0].metadata).toBeNull();
  expect(outcomes[1].metadata).toEqual({ id: 'metadata', kind: 'movie' });
  expect(mocks.metadata).toHaveBeenCalledTimes(1);
});

it('isolates metadata failures within a batch and returns suggestions for manual retry', async () => {
  mocks.metadata
    .mockRejectedValueOnce(new Error('private details'))
    .mockResolvedValueOnce({ id: 'metadata' });

  const response = await POST(
    request([
      { ...row, kind: 'movie' },
      { ...row, id: 'line-1', kind: 'movie' },
    ])
  );
  const outcomes = (await response.json()).outcomes;

  expect(outcomes[0]).toMatchObject({
    metadata: null,
    results: [result],
    error: 'Could not load the matched details. Retry or keep this title unmatched.',
  });
  expect(outcomes[1].metadata).toEqual({ id: 'metadata' });
});

it('rejects unauthenticated, cross-origin, oversized, and malformed requests before provider calls', async () => {
  mocks.account.mockResolvedValueOnce(null);

  expect((await POST(request())).status).toBe(401);
  expect((await POST(request([row], 'https://attacker.test'))).status).toBe(400);

  for (const rows of [
    [],
    [row, row, row, row],
    [{ ...row, kind: 'book' }],
    [{ ...row, title: '' }],
    [{ ...row, uncertain: 'false' }],
  ]) {
    expect((await POST(request(rows))).status).toBe(400);
  }

  expect(mocks.search).not.toHaveBeenCalled();
  expect(mocks.metadata).not.toHaveBeenCalled();
});
