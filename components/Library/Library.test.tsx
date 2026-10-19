import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { deleteItem, moveItem, saveShelfLayout } from '@/app/library-actions';
import { defaultProfile, EMPTY_FIELDS } from '@/lib/library';
import type { LibraryItem } from '@/types/library';
import Library from './Library';

const routerRefresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: routerRefresh }) }));
vi.mock('@/app/library-actions', () => ({
  moveItem: vi.fn().mockResolvedValue({}),
  deleteItem: vi.fn().mockResolvedValue({}),
  saveShelfLayout: vi.fn().mockResolvedValue({}),
}));
vi.mock('./ItemEditor', () => ({ default: () => null }));
vi.mock('./Artwork', () => ({ default: () => null }));
vi.mock('./Countdown', () => ({ default: () => null }));

beforeEach(() => {
  routerRefresh.mockClear();
  vi.mocked(deleteItem).mockReset().mockResolvedValue({});
  vi.mocked(saveShelfLayout).mockReset().mockResolvedValue({});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
    configurable: true,
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
    configurable: true,
  });
});

afterEach(() => vi.unstubAllGlobals());

it('syncs all movies and series despite filters, deduplicates sources, and skips manual titles', async () => {
  const linked = (id: string, kind: 'movie' | 'show', metadataId: string): LibraryItem => ({
    ...tvItem(id, id, ['Netflix']),
    kind,
    metadata_id: metadataId,
  });
  const items = [
    linked('movie', 'movie', 'film'),
    linked('series', 'show', 'show'),
    linked('duplicate', 'movie', 'film'),
    tvItem('manual', 'Manual title', []),
  ];
  let complete!: (response: Response) => void;
  const fetch = vi.fn().mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      })
  );
  vi.stubGlobal('fetch', fetch);
  render(<Library items={items} profile={defaultProfile('owner')} kind="screen" />);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /^Movies$/ }));
  expect(fetch).not.toHaveBeenCalled();
  const button = screen.getByRole('button', { name: 'Sync all movies and series' });
  expect(button.closest('.libraryHero')).not.toBeNull();
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetch.mock.calls[0][1].body).item_ids).toEqual(['duplicate', 'series']);
  await act(async () =>
    complete(
      Response.json({
        outcomes: [
          { id: 'duplicate', state: 'updated' },
          { id: 'series', state: 'updated' },
        ],
      })
    )
  );
  expect(screen.getByText('2 titles updated. 1 unmatched title skipped.')).toHaveAttribute(
    'role',
    'status'
  );
  expect(routerRefresh).toHaveBeenCalledTimes(1);
  expect(button).toBeEnabled();
});

it('batches game syncs and retries only failed titles while keeping the library available', async () => {
  const items = Array.from(
    { length: 5 },
    (_, index): LibraryItem => ({
      ...tvItem(`game-${index}`, `Game ${index}`, []),
      kind: 'game',
      status: 'backlog',
      metadata_id: `metadata-${index}`,
    })
  );
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        outcomes: items
          .slice(0, 4)
          .map((item) => ({ id: item.id, state: item.id === 'game-1' ? 'failed' : 'updated' })),
      })
    )
    .mockRejectedValueOnce(new Error('Network down'))
    .mockResolvedValueOnce(
      Response.json({
        outcomes: [
          { id: 'game-1', state: 'updated' },
          { id: 'game-4', state: 'updated' },
        ],
      })
    );
  vi.stubGlobal('fetch', fetch);
  render(<Library items={items} profile={defaultProfile('owner')} kind="game" />);
  fireEvent.click(screen.getByRole('button', { name: 'Sync all games' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Retry failed syncs' })).toBeEnabled()
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetch.mock.calls[0][1].body).item_ids).toHaveLength(4);
  expect(JSON.parse(fetch.mock.calls[1][1].body).item_ids).toEqual(['game-4']);
  expect(screen.getByRole('alert')).toHaveTextContent(
    '2 titles could not sync. Cached data is still available.'
  );
  expect(screen.getByRole('heading', { name: 'Game 1' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry failed syncs' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Retry failed syncs' })).not.toBeInTheDocument()
  );
  expect(JSON.parse(fetch.mock.calls[2][1].body).item_ids).toEqual(['game-1', 'game-4']);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('disables metadata sync for an empty or entirely unmatched library', () => {
  render(
    <Library
      items={[tvItem('manual', 'Manual', [])]}
      profile={defaultProfile('owner')}
      kind="screen"
    />
  );
  expect(screen.getByRole('button', { name: 'Sync all movies and series' })).toBeDisabled();
});

it('restores saved shelf order and collapsed state, and keeps grid titles visible', async () => {
  let completeSave!: (result: { error?: string }) => void;
  vi.mocked(saveShelfLayout).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        completeSave = resolve;
      })
  );
  const profile = {
    ...defaultProfile('owner'),
    shelf_layouts: {
      tv_service: { order: ['Prime Video', 'Netflix'], collapsed: ['Prime Video'] },
    },
  };
  render(
    <Library
      kind="screen"
      profile={profile}
      items={[
        tvItem('one', 'Prime title', ['Prime Video']),
        tvItem('two', 'Netflix title', ['Netflix']),
      ]}
    />
  );
  expect(document.querySelector('.shelf .shelfName')).toHaveTextContent('Prime Video');
  expect(screen.queryByRole('heading', { name: 'Prime title' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Prime Video 1/ }));
  expect(screen.getByRole('heading', { name: 'Prime title' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Prime Video 1/ })).toBeEnabled();
  expect(screen.queryByText('Syncing shelves…')).not.toBeInTheDocument();
  await act(async () => completeSave({}));
  await waitFor(() =>
    expect(saveShelfLayout).toHaveBeenCalledWith('tv_service', {
      order: ['Prime Video', 'Netflix'],
      collapsed: [],
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Move Netflix shelf up' }));
  expect(document.querySelector('.shelf .shelfName')).toHaveTextContent('Netflix');
  await waitFor(() =>
    expect(saveShelfLayout).toHaveBeenLastCalledWith('tv_service', {
      order: ['Netflix', 'Prime Video', 'None'],
      collapsed: [],
    })
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Prime Video 1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'All titles together' }));
  });
  expect(screen.getByRole('heading', { name: 'Prime title' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Netflix title' })).toBeInTheDocument();
});

it('retains local shelf changes when syncing fails and retries the latest layout', async () => {
  vi.mocked(saveShelfLayout).mockResolvedValueOnce({ error: 'Could not sync shelves.' });
  render(
    <Library
      kind="screen"
      profile={defaultProfile('owner')}
      items={[tvItem('one', 'Netflix title', ['Netflix'])]}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: /Netflix 1/ }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('heading', { name: 'Netflix title' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry sync' }));
  await waitFor(() => expect(saveShelfLayout).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

it.each([
  'game',
  'movie',
  'show',
] as const)('confirms %s removal and lets users cancel safely', async (kind) => {
  const item = {
    ...tvItem('one', 'My title', ['Netflix']),
    kind,
    status: kind === 'game' ? ('backlog' as const) : ('watchlist' as const),
  };
  render(
    <Library
      items={[item]}
      profile={defaultProfile('owner')}
      kind={kind === 'game' ? 'game' : 'screen'}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove My title' }));
  const dialog = screen.getByRole('dialog', { name: 'Remove title?' });
  const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
  expect(cancel).toHaveFocus();
  expect(deleteItem).not.toHaveBeenCalled();
  fireEvent.click(cancel);
  expect(screen.queryByRole('dialog', { name: 'Remove title?' })).not.toBeInTheDocument();
  expect(deleteItem).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove My title' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove title' }));
  await waitFor(() => expect(deleteItem).toHaveBeenCalledWith('one'));
  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'My title' })).not.toBeInTheDocument()
  );
  expect(screen.getByRole('heading', { name: 'Your collection starts here.' })).toBeInTheDocument();
});

it('keeps failed deletions in the library and allows retrying from the confirmation', async () => {
  vi.mocked(deleteItem).mockResolvedValueOnce({ error: 'Could not delete item.' });
  render(
    <Library
      items={[tvItem('one', 'Shared title', ['Netflix', 'Prime Video'])]}
      profile={defaultProfile('owner')}
      kind="screen"
    />
  );
  expect(screen.getAllByRole('button', { name: 'Remove Shared title' })).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove Shared title' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Remove title' }));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Could not delete item.')
  );
  expect(screen.getAllByRole('heading', { name: 'Shared title' })).toHaveLength(2);
  const retry = await screen.findByRole('button', { name: 'Remove title' });
  await waitFor(() => expect(retry).toBeEnabled());
  fireEvent.click(retry);
  await waitFor(() =>
    expect(screen.queryAllByRole('heading', { name: 'Shared title' })).toHaveLength(0)
  );
  expect(deleteItem).toHaveBeenCalledTimes(2);
});

it('offers platform choices before any games have platform assignments', () => {
  const profile = { ...defaultProfile('owner'), platforms: ['Retro handheld'] };
  render(<Library items={[]} profile={profile} kind="game" />);
  const filter = screen.getByRole('combobox', { name: 'Filter by platform' });
  expect(within(filter).getByRole('option', { name: 'PC' })).toBeInTheDocument();
  expect(within(filter).getByRole('option', { name: 'PlayStation 5' })).toBeInTheDocument();
  expect(within(filter).getByRole('option', { name: 'Retro handheld' })).toBeInTheDocument();
});

it('filters assigned platforms and falls back to fetched platforms for unassigned games', () => {
  const item: LibraryItem = {
    id: 'one',
    member_id: 'owner',
    kind: 'game',
    status: 'backlog',
    metadata_id: null,
    metadata: null,
    overrides: { title: 'PC title' },
    fields: { ...EMPTY_FIELDS, title: 'PC title' },
    platforms: ['PC'],
    services: [],
    price: null,
    currency: 'GBP',
    notes: '',
    auto_move: true,
    created_at: '2026-10-18',
    updated_at: '2026-10-18',
  };
  const unmatched: LibraryItem = {
    ...item,
    id: 'two',
    platforms: [],
    fields: { ...EMPTY_FIELDS, title: 'Fetched game' },
    metadata_id: 'metadata',
    metadata: {
      id: 'metadata',
      provider: 'rawg',
      provider_id: '1',
      kind: 'game',
      region: 'GB',
      fetched_at: '2026-10-18',
      fields: {
        ...EMPTY_FIELDS,
        title: 'Fetched game',
        kind: 'game',
        platforms: ['Nintendo Switch'],
        services: [],
        source_url: 'https://rawg.io',
      },
    },
  };
  render(<Library items={[item, unmatched]} profile={defaultProfile('owner')} kind="game" />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by platform' }), {
    target: { value: 'Nintendo Switch' },
  });
  expect(screen.getByRole('heading', { name: 'Fetched game' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'PC title' })).not.toBeInTheDocument();
});

function tvItem(id: string, title: string, services: string[]): LibraryItem {
  return {
    id,
    member_id: 'owner',
    kind: 'show',
    status: 'watchlist',
    metadata_id: null,
    metadata: null,
    overrides: { title },
    fields: { ...EMPTY_FIELDS, title },
    platforms: [],
    services,
    price: null,
    currency: 'GBP',
    notes: '',
    auto_move: true,
    created_at: '2026-10-18',
    updated_at: '2026-10-18',
  };
}

it.each([
  'game',
  'screen',
] as const)('switches %s between grid and list without changing grouping or filters', async (kind) => {
  const items: LibraryItem[] = [
    {
      ...tvItem('one', 'First title', ['Netflix', 'Prime Video']),
      kind: kind === 'game' ? 'game' : 'show',
      status: kind === 'game' ? 'backlog' : 'watchlist',
      platforms: ['PC'],
    },
    {
      ...tvItem('two', 'Second title', ['Netflix']),
      kind: kind === 'game' ? 'game' : 'movie',
      status: kind === 'game' ? 'playing' : 'watching',
    },
  ];
  render(<Library items={items} profile={defaultProfile('owner')} kind={kind} />);
  const grouping = screen.getByRole('group', { name: 'Library grouping' });
  const display = screen.getByRole('group', { name: 'Title display' });
  expect(within(display).getByRole('button', { name: 'Grid' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  fireEvent.click(within(display).getByRole('button', { name: 'List' }));
  const views =
    kind === 'game'
      ? ['Shelves', 'All titles together']
      : ['Services', 'Shelves', 'All titles together'];
  for (const view of views) {
    fireEvent.click(within(grouping).getByRole('button', { name: view }));
    expect(within(display).getByRole('button', { name: 'List' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const rows = document.querySelectorAll('.itemCard');
    expect(rows).toHaveLength(view === 'Services' ? 3 : 2);
    rows.forEach((row) => {
      expect(row).toHaveClass('listTile');
    });
    expect(screen.getByRole('heading', { name: 'Second title' })).toBeInTheDocument();
  }
  fireEvent.change(screen.getByRole('textbox', { name: 'Search your library' }), {
    target: { value: 'First' },
  });
  fireEvent.click(within(grouping).getByRole('button', { name: 'Shelves' }));
  fireEvent.click(within(display).getByRole('button', { name: 'Grid' }));
  expect(within(grouping).getByRole('button', { name: 'Shelves' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(document.querySelector('.itemCard')).not.toHaveClass('listTile');
  expect(screen.queryByRole('heading', { name: 'Second title' })).not.toBeInTheDocument();
  fireEvent.click(within(display).getByRole('button', { name: 'List' }));
  const shelfName = kind === 'game' ? 'Backlog' : 'Watchlist';
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${shelfName} 1`) }));
  expect(screen.queryByRole('heading', { name: 'First title' })).not.toBeInTheDocument();
  fireEvent.click(within(display).getByRole('button', { name: 'Grid' }));
  expect(screen.queryByRole('heading', { name: 'First title' })).not.toBeInTheDocument();
  fireEvent.click(within(grouping).getByRole('button', { name: 'All titles together' }));
  expect(screen.getByRole('heading', { name: 'First title' })).toBeInTheDocument();
  await waitFor(() => expect(saveShelfLayout).toHaveBeenCalledTimes(1));
});

it('keeps status changes and removal available in list rows', async () => {
  render(
    <Library
      items={[tvItem('one', 'List title', ['Netflix'])]}
      profile={defaultProfile('owner')}
      kind="screen"
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'List' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Status of List title' }), {
    target: { value: 'watching' },
  });
  await waitFor(() => expect(moveItem).toHaveBeenCalledWith('one', 'watching'));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Remove List title' })).toBeEnabled()
  );
  expect(screen.getByRole('button', { name: 'Drag List title to a status shelf' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove List title' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove title' }));
  await waitFor(() => expect(deleteItem).toHaveBeenCalledWith('one'));
  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'List title' })).not.toBeInTheDocument()
  );
});

it('offers streaming service choices before adding TV titles, including custom subscriptions', () => {
  const profile = { ...defaultProfile('owner'), services: ['MUBI'] };
  render(<Library items={[]} profile={profile} kind="screen" />);
  const filter = screen.getByRole('combobox', { name: 'Filter by streaming service' });
  for (const name of [
    'Apple TV',
    'Disney+',
    'HBO Max',
    'Netflix',
    'Prime Video',
    'Other',
    'MUBI',
  ]) {
    expect(within(filter).getByRole('option', { name })).toBeInTheDocument();
  }
});

it('filters legacy HBO and multi-service titles across TV views and combines with status', () => {
  const items = [
    tvItem('one', 'Legacy HBO show', ['HBO']),
    { ...tvItem('two', 'Shared show', ['HBO Max', 'Netflix']), status: 'watching' as const },
    tvItem('three', 'Netflix show', ['Netflix']),
  ];
  render(<Library items={items} profile={defaultProfile('owner')} kind="screen" />);
  const filter = screen.getByRole('combobox', { name: 'Filter by streaming service' });
  expect(within(filter).getAllByRole('option', { name: 'HBO Max' })).toHaveLength(1);
  fireEvent.change(filter, { target: { value: 'HBO Max' } });
  expect(screen.getByRole('heading', { name: 'Legacy HBO show' })).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { name: 'Shared show' })).toHaveLength(1);
  expect(screen.queryByRole('heading', { name: 'Netflix show' })).not.toBeInTheDocument();
  expect(document.querySelectorAll('.shelf')).toHaveLength(1);
  for (const view of ['Shelves', 'All titles together']) {
    fireEvent.click(screen.getByRole('button', { name: view }));
    expect(screen.getByRole('heading', { name: 'Legacy HBO show' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Shared show' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Netflix show' })).not.toBeInTheDocument();
  }
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
    target: { value: 'watching' },
  });
  expect(screen.queryByRole('heading', { name: 'Legacy HBO show' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Shared show' })).toBeInTheDocument();
  fireEvent.change(filter, { target: { value: '' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
    target: { value: '' },
  });
  expect(document.querySelectorAll('.itemCard')).toHaveLength(3);
});

it('keeps Other separate from unassigned services and ignores unconfirmed provider suggestions', () => {
  const other = tvItem('one', 'Other service show', ['Other']);
  const unassigned = tvItem('two', 'Unassigned show', []);
  unassigned.metadata = {
    id: 'metadata',
    provider: 'tmdb',
    provider_id: '1',
    kind: 'show',
    region: 'GB',
    fetched_at: '2026-10-18',
    fields: {
      ...EMPTY_FIELDS,
      title: 'Unassigned show',
      kind: 'show',
      platforms: [],
      services: ['Netflix'],
      source_url: 'https://www.themoviedb.org',
    },
  };
  render(<Library items={[other, unassigned]} profile={defaultProfile('owner')} kind="screen" />);
  const filter = screen.getByRole('combobox', { name: 'Filter by streaming service' });
  fireEvent.change(filter, { target: { value: 'Other' } });
  expect(screen.getByRole('heading', { name: 'Other service show' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Unassigned show' })).not.toBeInTheDocument();
  fireEvent.change(filter, { target: { value: '__none__' } });
  expect(screen.getByRole('heading', { name: 'Unassigned show' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Other service show' })).not.toBeInTheDocument();
  fireEvent.change(filter, { target: { value: 'Netflix' } });
  expect(screen.getByRole('heading', { name: 'No titles match.' })).toBeInTheDocument();
});

it('filters movies and TV series across views and combines type with service and status', () => {
  const items = [
    { ...tvItem('movie', 'Netflix movie', ['Netflix']), kind: 'movie' as const },
    tvItem('series', 'Netflix series', ['Netflix']),
    { ...tvItem('watching', 'Watching series', ['Netflix']), status: 'watching' as const },
    tvItem('other', 'Prime series', ['Prime Video']),
  ];
  render(<Library items={items} profile={defaultProfile('owner')} kind="screen" />);
  fireEvent.click(screen.getByRole('button', { name: 'Movies' }));
  expect(screen.getByRole('heading', { name: 'Netflix movie' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Netflix series' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'TV series' }));
  for (const view of ['Services', 'Shelves', 'All titles together']) {
    fireEvent.click(screen.getByRole('button', { name: view }));
    expect(screen.queryByRole('heading', { name: 'Netflix movie' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Netflix series' })).toBeInTheDocument();
  }
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by streaming service' }), {
    target: { value: 'Netflix' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
    target: { value: 'watchlist' },
  });
  expect(document.querySelectorAll('.itemCard')).toHaveLength(1);
  expect(screen.getByRole('heading', { name: 'Netflix series' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'All titles' }));
  expect(document.querySelectorAll('.itemCard')).toHaveLength(2);
});

it('orders scheduled games by earliest release by default, with unannounced dates last', () => {
  const game = (
    id: string,
    releaseDate: string | null,
    createdAt: string,
    precision: LibraryItem['fields']['release_precision'] = 'day'
  ): LibraryItem => ({
    ...tvItem(id, id, []),
    kind: 'game',
    status: 'scheduled',
    created_at: createdAt,
    fields: {
      ...EMPTY_FIELDS,
      title: id,
      release_date: releaseDate,
      release_precision: precision,
    },
  });
  const items = [
    game('Later release', '2027-02-10', '2026-10-19'),
    game('Missing date', null, '2026-10-18'),
    game('Unannounced date', '2026-01-01', '2026-10-17', 'unknown'),
    game('Nearest release', '2026-10-20', '2026-10-16'),
    game('Next release', '2026-11-01', '2026-10-15'),
    { ...game('Older backlog', '2026-10-20', '2026-10-15'), status: 'backlog' as const },
    { ...game('Newer backlog', '2027-02-10', '2026-10-19'), status: 'backlog' as const },
  ];
  render(<Library items={items} profile={defaultProfile('owner')} kind="game" />);
  const titles = (element: HTMLElement) =>
    within(element)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
  const scheduled = screen.getByRole('button', { name: /Scheduled 5/ }).closest('section')!;
  const expected = [
    'Nearest release',
    'Next release',
    'Later release',
    'Missing date',
    'Unannounced date',
  ];
  expect(titles(scheduled)).toEqual(expected);
  const backlog = screen.getByRole('button', { name: /Backlog 2/ }).closest('section')!;
  expect(titles(backlog)).toEqual(['Newer backlog', 'Older backlog']);

  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
    target: { value: 'scheduled' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'All titles together' }));
  expect(titles(document.querySelector('.libraryPage')!)).toEqual(expected);

  fireEvent.click(screen.getByRole('button', { name: 'Shelves' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort titles' }), {
    target: { value: 'score' },
  });
  expect(titles(screen.getByRole('button', { name: /Scheduled 5/ }).closest('section')!)).toEqual(
    items.slice(0, 5).map((item) => item.fields.title)
  );
});

it('keeps prices off game tiles while preserving detail links and status changes in both views', async () => {
  const game: LibraryItem = {
    ...tvItem('game', 'Fable', []),
    kind: 'game',
    status: 'scheduled',
    platforms: ['PlayStation 5'],
    price: 59.99,
  };
  render(<Library items={[game]} profile={defaultProfile('owner')} kind="game" />);
  for (const view of ['Shelves', 'All titles together']) {
    fireEvent.click(screen.getByRole('button', { name: view }));
    expect(screen.queryByText('£59.99')).not.toBeInTheDocument();
    expect(screen.queryByText('Price —')).not.toBeInTheDocument();
    const title = screen.getByRole('heading', { name: 'Fable' });
    expect(title.closest('a')).toHaveAttribute('href', '/items/game');
    const status = screen.getByRole('combobox', { name: 'Status of Fable' });
    expect(within(status).getByRole('option', { name: 'Playing' })).toBeInTheDocument();
    expect(within(status).queryByRole('option', { name: 'Watching' })).not.toBeInTheDocument();
    fireEvent.change(status, { target: { value: 'backlog' } });
    await waitFor(() => expect(moveItem).toHaveBeenCalledWith('game', 'backlog'));
    await waitFor(() => expect(status).toBeEnabled());
    vi.mocked(moveItem).mockClear();
  }
});
