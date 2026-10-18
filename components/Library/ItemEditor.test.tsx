import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultProfile } from '@/lib/library';
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
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My series' } });
  fireEvent.click(screen.getByRole('button', { name: 'TV series' }));
  expect(screen.getByRole('button', { name: 'TV series' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByPlaceholderText('Search a title…'), {
    target: { value: 'Dark matter' },
  });
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
