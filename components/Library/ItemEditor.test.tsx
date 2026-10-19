import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultProfile, EMPTY_FIELDS } from '@/lib/library';
import type { LibraryItem } from '@/types/library';
import ItemEditor from './ItemEditor';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }),
}));
vi.mock('@/app/library-actions', () => ({ saveItem: mocks.save, deleteItem: vi.fn() }));
vi.mock('./Artwork', () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue({ id: 'saved' });
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
  vi.stubGlobal('fetch', mocks.fetch);
});

afterEach(() => vi.unstubAllGlobals());

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
