import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { deleteItem, moveItem } from '@/app/library-actions';
import { defaultProfile, EMPTY_FIELDS } from '@/lib/library';
import type { LibraryItem } from '@/types/library';
import Library from './Library';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/library-actions', () => ({
  moveItem: vi.fn().mockResolvedValue({}),
  deleteItem: vi.fn().mockResolvedValue({}),
}));
vi.mock('./ItemEditor', () => ({ default: () => null }));
vi.mock('./Artwork', () => ({ default: () => null }));
vi.mock('./Countdown', () => ({ default: () => null }));

beforeEach(() => {
  vi.mocked(deleteItem).mockReset().mockResolvedValue({});
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
afterEach(() => {
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
  fireEvent.click(screen.getByRole('button', { name: 'Remove title' }));
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
  for (const view of ['Shelves', 'Grid']) {
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
  for (const view of ['Services', 'Shelves', 'Grid']) {
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

it('keeps prices off game tiles while preserving detail links and status changes in both views', async () => {
  const game: LibraryItem = {
    ...tvItem('game', 'Fable', []),
    kind: 'game',
    status: 'scheduled',
    platforms: ['PlayStation 5'],
    price: 59.99,
  };
  render(<Library items={[game]} profile={defaultProfile('owner')} kind="game" />);
  for (const view of ['Shelves', 'Grid']) {
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
