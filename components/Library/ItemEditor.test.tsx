import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultProfile, EMPTY_FIELDS } from '@/lib/library';
import type { LibraryItem } from '@/types/library';
import ItemEditor from './ItemEditor';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  banner: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }),
}));
vi.mock('@/app/library-actions', () => ({
  saveItem: mocks.save,
  saveBanner: mocks.banner,
  deleteItem: vi.fn(),
}));
vi.mock('./Artwork', () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue({ id: 'saved' });
  mocks.banner.mockReset().mockResolvedValue({});
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
  vi.stubGlobal('fetch', mocks.fetch);
});

afterEach(() => vi.unstubAllGlobals());

const bannerItem = (kind: LibraryItem['kind'], status: LibraryItem['status']): LibraryItem => ({
  id: '11111111-1111-4111-8111-111111111111',
  member_id: 'owner',
  kind,
  status,
  metadata_id: null,
  metadata: null,
  overrides: { title: 'My title' },
  fields: { ...EMPTY_FIELDS, title: 'My title' },
  platforms: [],
  services: [],
  price: null,
  currency: 'GBP',
  notes: '',
  auto_move: false,
  created_at: '2026-10-19',
  updated_at: '2026-10-19',
});

it.each([
  ['game', 'playing', 'game'],
  ['movie', 'watching', 'screen'],
  ['show', 'watching', 'screen'],
] as const)('puts the banner option first for a %s and saves it independently of other edits', async (kind, status, libraryKind) => {
  const item = bannerItem(kind, status);

  render(<ItemEditor kind={kind} item={item} profile={defaultProfile('owner')} />);

  const toggle = screen.getByRole('checkbox', { name: 'Show in banner' });

  expect(document.querySelector('.editor')?.firstElementChild).toBe(toggle.closest('label'));
  expect(toggle).not.toBeChecked();

  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unsaved title edit' } });
  fireEvent.click(toggle);

  await waitFor(() => expect(toggle).toBeChecked());
  await waitFor(() => expect(toggle).toBeEnabled());
  expect(mocks.banner).toHaveBeenCalledWith(libraryKind, item.id);
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Title')).toHaveValue('Unsaved title edit');

  fireEvent.click(toggle);

  await waitFor(() => expect(toggle).not.toBeChecked());
  expect(mocks.banner).toHaveBeenLastCalledWith(libraryKind, null);
});

it.each([
  ['game', 'backlog'],
  ['game', 'completed'],
  ['movie', 'watchlist'],
  ['show', 'watched'],
] as const)('hides the banner option for a %s marked %s', (kind, status) => {
  render(
    <ItemEditor kind={kind} item={bannerItem(kind, status)} profile={defaultProfile('owner')} />
  );

  expect(screen.queryByRole('checkbox', { name: 'Show in banner' })).not.toBeInTheDocument();
});

it('keeps the banner option out of new-title forms', () => {
  render(<ItemEditor kind="game" initialStatus="playing" profile={defaultProfile('owner')} />);

  expect(screen.queryByRole('checkbox', { name: 'Show in banner' })).not.toBeInTheDocument();
});

it('reads the selection for the matching library and follows refreshed profile data', async () => {
  const item = bannerItem('show', 'watching');
  const profile = { ...defaultProfile('owner'), banner_items: { game: item.id, screen: 'other' } };

  const { rerender } = render(<ItemEditor kind="show" item={item} profile={profile} />);

  expect(screen.getByRole('checkbox', { name: 'Show in banner' })).not.toBeChecked();

  rerender(
    <ItemEditor
      kind="show"
      item={item}
      profile={{ ...profile, banner_items: { screen: item.id } }}
    />
  );

  await waitFor(() =>
    expect(screen.getByRole('checkbox', { name: 'Show in banner' })).toBeChecked()
  );
});

it.each([
  'response',
  'exception',
])('retains the previous banner on a save %s failure and allows retry', async (failure) => {
  const item = bannerItem('game', 'playing');
  const profile = { ...defaultProfile('owner'), banner_items: { game: item.id } };

  if (failure === 'response')
    mocks.banner.mockResolvedValueOnce({ error: 'Could not save banner.' });
  else mocks.banner.mockRejectedValueOnce(new Error('Network unavailable.'));

  render(<ItemEditor kind="game" item={item} profile={profile} />);

  const toggle = screen.getByRole('checkbox', { name: 'Show in banner' });

  fireEvent.click(toggle);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    failure === 'response' ? 'Could not save banner.' : 'Network unavailable.'
  );
  await waitFor(() => expect(toggle).toBeEnabled());
  expect(toggle).toBeChecked();
  expect(mocks.refresh).not.toHaveBeenCalled();

  fireEvent.click(toggle);

  await waitFor(() => expect(toggle).not.toBeChecked());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('disables the banner option and Save changes while saving the banner', async () => {
  let complete!: (result: { error?: string }) => void;

  mocks.banner.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      })
  );

  render(
    <ItemEditor
      kind="game"
      item={bannerItem('game', 'playing')}
      profile={defaultProfile('owner')}
    />
  );

  const toggle = screen.getByRole('checkbox', { name: 'Show in banner' });

  fireEvent.click(toggle);

  expect(toggle).toBeDisabled();
  expect(toggle).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();

  await act(async () => complete({}));

  expect(toggle).toBeChecked();
  expect(toggle).toBeEnabled();
});

it('uses the chosen TV series type for provider search and saving a manual title', async () => {
  render(<ItemEditor kind="movie" profile={defaultProfile('owner')} />);

  expect(mocks.fetch).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My series' } });
  fireEvent.click(screen.getByRole('button', { name: 'TV series' }));

  expect(screen.getByRole('button', { name: 'TV series' })).toHaveAttribute('aria-pressed', 'true');

  fireEvent.change(screen.getByPlaceholderText('Search a title…'), {
    target: { value: 'Dark matter' },
  });

  expect(mocks.fetch).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await waitFor(() =>
    expect(mocks.fetch).toHaveBeenCalledWith('/api/search?q=Dark%20matter&kind=show')
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add title' })).toBeEnabled());

  expect(screen.getByLabelText('Title')).toHaveValue('My series');

  fireEvent.click(screen.getByRole('button', { name: 'Add title' }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'show',
        status: 'watchlist',
        overrides: { title: 'My series' },
      })
    )
  );
});

it('defaults to the requested type and allows switching back to movie', async () => {
  render(<ItemEditor kind="show" profile={defaultProfile('owner')} />);

  expect(screen.getByRole('button', { name: 'TV series' })).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByRole('button', { name: 'Movie' }));
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My movie' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add title' }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'movie' }))
  );
});

it('preserves existing details and manual overrides while editing a cover, status, notes and price', async () => {
  const item: LibraryItem = {
    id: '11111111-1111-4111-8111-111111111111',
    member_id: 'owner',
    kind: 'game',
    status: 'playing',
    metadata_id: 'metadata',
    metadata: {
      id: 'metadata',
      provider: 'rawg',
      provider_id: '1',
      kind: 'game',
      region: 'GB',
      fetched_at: '2026-10-19',
      fields: {
        ...EMPTY_FIELDS,
        title: 'Fetched title',
        artwork: 'https://example.com/fetched.jpg',
        kind: 'game',
        platforms: ['PC'],
        services: [],
        source_url: 'https://rawg.io',
      },
    },
    overrides: { title: 'My title', description: null },
    fields: { ...EMPTY_FIELDS, title: 'My title' },
    platforms: ['PC'],
    services: [],
    price: 29.99,
    currency: 'GBP',
    notes: 'My progress',
    auto_move: false,
    created_at: '2026-10-19',
    updated_at: '2026-10-19',
  };

  render(
    <ItemEditor kind="game" item={item} profile={defaultProfile('owner')} reminderDays={[0, 7]} />
  );

  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My title');

  fireEvent.click(screen.getByText('Search & refresh metadata'));

  expect(mocks.fetch).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText('Search & refresh metadata'));

  expect(screen.getByText('Search & refresh metadata').closest('details')).not.toHaveAttribute(
    'open'
  );
  expect(screen.getByRole('group', { name: 'Cover image' })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Cover / poster URL'), {
    target: { value: 'https://example.com/custom.jpg' },
  });
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
  fireEvent.change(screen.getByLabelText('My notes'), { target: { value: 'Finished it' } });
  fireEvent.change(screen.getByLabelText('Price (optional)'), { target: { value: '19.99' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        status: 'completed',
        overrides: {
          title: 'My title',
          description: null,
          artwork: 'https://example.com/custom.jpg',
        },
        price: 19.99,
        notes: 'Finished it',
        platforms: ['PC'],
        reminder_days: [0, 7],
        auto_move: false,
      })
    )
  );

  expect(mocks.fetch).not.toHaveBeenCalled();
});
