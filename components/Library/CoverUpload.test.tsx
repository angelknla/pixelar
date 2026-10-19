import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { shrinkImage } from '@/lib/image';
import CoverUpload from './CoverUpload';

vi.mock('@/lib/image', () => ({ shrinkImage: vi.fn() }));
const uploaded = vi.fn(),
  busy = vi.fn(),
  fetcher = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetcher);
  vi.mocked(shrinkImage).mockImplementation(async (file) => file);
});
afterEach(() => vi.unstubAllGlobals());
it('uploads a prepared cover, reports pending state, and returns the private URL for explicit save', async () => {
  fetcher.mockResolvedValue({
    ok: true,
    json: async () => ({ url: '/api/covers/item?v=version' }),
  });
  render(<CoverUpload itemId="item" disabled={false} onUploaded={uploaded} onBusy={busy} />);
  const file = new File(['image'], 'image.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText('Choose cover image'), { target: { files: [file] } });
  await waitFor(() => expect(uploaded).toHaveBeenCalledWith('/api/covers/item?v=version'));
  expect(shrinkImage).toHaveBeenCalledWith(file, 1920);
  expect(fetcher.mock.calls[0][0]).toBe('/api/covers/item');
  expect(fetcher.mock.calls[0][1].body.get('cover')).toBe(file);
  expect(busy.mock.calls).toEqual([[true], [false]]);
  expect(screen.getByRole('status')).toHaveTextContent('Save changes');
});
it('keeps the previous cover on upload failure and allows retry', async () => {
  fetcher
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Upload failed.' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ url: '/api/covers/item?v=next' }) });
  render(<CoverUpload itemId="item" disabled={false} onUploaded={uploaded} onBusy={busy} />);
  const input = screen.getByLabelText('Choose cover image'),
    file = new File(['image'], 'image.png');
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByRole('alert');
  expect(uploaded).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Upload image' })).toBeEnabled();
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(uploaded).toHaveBeenCalled());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
