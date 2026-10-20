import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { saveReviewedImport } from '@/app/import-actions';
import { defaultProfile, EMPTY_FIELDS } from '@/lib/library';
import type { ItemKind, MetadataRow, SearchResult } from '@/types/library';
import Import from './Import';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/import-actions', () => ({ saveReviewedImport: vi.fn() }));

const result = (title: string, kind: ItemKind = 'movie', id = '1'): SearchResult => ({
  provider: kind === 'game' ? 'rawg' : 'tmdb',
  provider_id: id,
  kind,
  title,
  artwork: null,
  year: '2021',
});

const metadata = (title: string, kind: ItemKind = 'movie', id = '1'): MetadataRow => ({
  ...result(title, kind, id),
  id: `metadata-${id}`,
  region: 'GB',
  fetched_at: '2026-10-20',
  fields: { ...EMPTY_FIELDS, title, kind, platforms: [], services: [], source_url: '' },
});

const paste = (notes: string) => {
  fireEvent.change(screen.getByLabelText('Your notes'), { target: { value: notes } });
  fireEvent.click(screen.getByRole('button', { name: /^(Find and review titles|Review titles)$/ }));
};

const getRow = (title: string) => screen.getByRole('region', { name: title });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(saveReviewedImport).mockImplementation(async (values) => ({
    saved: (values as { key: string }[]).map((value) => value.key),
    errors: [],
  }));
});

afterEach(() => vi.unstubAllGlobals());

it('applies a default type to 61 titles and imports them in one confirmation without matching', async () => {
  const fetch = vi.fn();

  vi.stubGlobal('fetch', fetch);

  render(<Import items={[]} profile={defaultProfile('owner')} />);
  fireEvent.change(screen.getByLabelText('Default type'), { target: { value: 'game' } });
  fireEvent.click(screen.getByLabelText('Find and link clear matches automatically'));
  paste(Array.from({ length: 61 }, (_, index) => `Game ${index + 1}`).join('\n'));

  expect(screen.getByRole('heading', { name: '61 titles to review' })).toBeInTheDocument();
  expect(
    screen
      .getAllByLabelText('Type')
      .every((select) => (select as HTMLSelectElement).value === 'game')
  ).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
  expect(saveReviewedImport).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Import 61 titles' }));

  await waitFor(() => expect(saveReviewedImport).toHaveBeenCalledTimes(1));

  const values = vi.mocked(saveReviewedImport).mock.calls[0][0] as {
    item: { kind: string; status: string };
  }[];

  expect(values).toHaveLength(61);
  expect(values.every(({ item }) => item.kind === 'game' && item.status === 'backlog')).toBe(true);
  expect(await screen.findByText('61 titles imported.')).toBeInTheDocument();
});

it('automatically matches a mixed list and focuses review on unresolved titles', async () => {
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      outcomes: [
        { id: 'line-0', results: [result('Dune')], metadata: metadata('Dune'), error: '' },
        {
          id: 'line-1',
          results: [result('Hades', 'game', '2')],
          metadata: metadata('Hades', 'game', '2'),
          error: '',
        },
        { id: 'line-2', results: [], metadata: null, error: '' },
      ],
    })
  );

  vi.stubGlobal('fetch', fetch);

  render(<Import items={[]} profile={defaultProfile('owner')} />);

  expect(fetch).not.toHaveBeenCalled();

  paste('Dune\nHades\nUnknown');

  await screen.findByText('2 ready · 1 need attention · 0 skipped');

  expect(getRow('Unknown')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Dune' })).not.toBeInTheDocument();
  expect(saveReviewedImport).not.toHaveBeenCalled();
  expect(
    JSON.parse(fetch.mock.calls[0][1].body).rows.map((row: { kind: ItemKind | null }) => row.kind)
  ).toEqual([null, null, null]);

  fireEvent.click(screen.getByRole('button', { name: 'Import 2 ready titles' }));
  await screen.findByText('2 titles imported.');

  const values = vi.mocked(saveReviewedImport).mock.calls[0][0] as {
    item: { kind: string; status: string; metadata_id: string };
  }[];

  expect(values.map(({ item }) => [item.kind, item.status, item.metadata_id])).toEqual([
    ['movie', 'watchlist', 'metadata-1'],
    ['game', 'backlog', 'metadata-2'],
  ]);
  expect(getRow('Unknown')).toBeInTheDocument();
});

it('allows one bulk type choice for all unresolved titles after provider failure', async () => {
  const fetch = vi.fn().mockRejectedValue(new Error('Matching unavailable'));

  vi.stubGlobal('fetch', fetch);

  render(<Import items={[]} profile={defaultProfile('owner')} />);
  paste('Dune\nAlien');

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Match remaining titles' })).toBeEnabled()
  );

  fireEvent.change(screen.getByLabelText('Type for remaining titles'), {
    target: { value: 'movie' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply to 2 titles' }));

  expect(
    screen
      .getAllByLabelText('Type')
      .every((select) => (select as HTMLSelectElement).value === 'movie')
  ).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: 'Import 2 titles' }));

  await screen.findByText('2 titles imported.');
});

it('matches in small batches, skips repeated titles, and saves only selected rows', async () => {
  const fetch = vi.fn().mockImplementation(async (_url, options) =>
    Response.json({
      outcomes: JSON.parse(options.body).rows.map((row: { id: string; title: string }) => ({
        id: row.id,
        results: [],
        metadata: null,
        error: '',
      })),
    })
  );

  vi.stubGlobal('fetch', fetch);

  render(<Import items={[]} profile={defaultProfile('owner')} />);
  fireEvent.change(screen.getByLabelText('Default type'), { target: { value: 'movie' } });
  paste('One\nTwo\nThree\nFour\nFive\nOne');

  await screen.findByText('0 ready · 5 need attention · 1 skipped');

  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls.map((call) => JSON.parse(call[1].body).rows.length)).toEqual([3, 2]);

  fireEvent.click(screen.getByRole('button', { name: 'Import 5 titles' }));
  await screen.findByText('5 titles imported.');

  expect(vi.mocked(saveReviewedImport).mock.calls[0][0]).toHaveLength(5);
});

it('distinguishes movie and series results with the same provider ID and links the chosen type', async () => {
  const movie = result('Dune');
  const show = result('Dune', 'show');
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        outcomes: [{ id: 'line-0', results: [movie, show], metadata: null, error: '' }],
      })
    )
    .mockResolvedValueOnce(Response.json({ metadata: metadata('Dune', 'show') }));

  vi.stubGlobal('fetch', fetch);

  render(<Import items={[]} profile={defaultProfile('owner')} />);
  paste('Dune');

  const select = await screen.findByLabelText('Choose a result');

  expect(within(select).getByRole('option', { name: 'Dune (2021) · Movie' })).toHaveValue(
    'tmdb:movie:1'
  );
  expect(within(select).getByRole('option', { name: 'Dune (2021) · TV series' })).toHaveValue(
    'tmdb:show:1'
  );

  fireEvent.change(select, { target: { value: 'tmdb:show:1' } });
  await screen.findByText('1 ready · 0 need attention · 0 skipped');
  fireEvent.click(screen.getByRole('button', { name: 'Import 1 title' }));
  await screen.findByText('1 title imported.');

  expect(vi.mocked(saveReviewedImport).mock.calls[0][0]).toMatchObject([
    { item: { kind: 'show', status: 'watchlist' } },
  ]);
});

it('stops matching and ignores a late response before allowing a new paste', async () => {
  let resolve: (response: Response) => void = () => {};
  const fetch = vi.fn().mockImplementation(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      })
  );

  vi.stubGlobal('fetch', fetch);

  render(<Import items={[]} profile={defaultProfile('owner')} />);
  paste('Dune');

  expect(screen.getByRole('button', { name: 'Import 1 title' })).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'Stop matching' }));
  await act(async () =>
    resolve(
      Response.json({
        outcomes: [{ id: 'line-0', metadata: metadata('Dune'), results: [], error: '' }],
      })
    )
  );

  expect(screen.getByText('0 ready · 1 need attention · 0 skipped')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start over' })).toBeEnabled();

  fireEvent.click(screen.getByRole('button', { name: 'Start over' }));

  expect(screen.getByLabelText('Your notes')).toHaveValue('Dune');
  expect(saveReviewedImport).not.toHaveBeenCalled();
});

it('keeps only failed rows after partial save so retry does not resave successful titles', async () => {
  vi.mocked(saveReviewedImport).mockResolvedValueOnce({
    saved: ['line-0'],
    errors: [{ key: 'line-1', error: 'Could not save' }],
  });

  render(<Import items={[]} profile={defaultProfile('owner')} />);
  fireEvent.change(screen.getByLabelText('Default type'), { target: { value: 'movie' } });
  fireEvent.click(screen.getByLabelText('Find and link clear matches automatically'));
  paste('Dune\nAlien');
  fireEvent.click(screen.getByRole('button', { name: 'Import 2 titles' }));

  await screen.findByText('1 title imported.');

  expect(screen.queryByRole('region', { name: 'Dune' })).not.toBeInTheDocument();
  expect(getRow('Alien')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Import 1 title' }));
  await waitFor(() => expect(saveReviewedImport).toHaveBeenCalledTimes(2));

  expect(vi.mocked(saveReviewedImport).mock.calls[1][0]).toMatchObject([{ key: 'line-1' }]);
});
