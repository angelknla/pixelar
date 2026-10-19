// @vitest-environment node
import { GET, POST } from './route';

const mocks = vi.hoisted(() => ({ account: vi.fn(), upload: vi.fn(), download: vi.fn() }));

vi.mock('@/lib/api', () => ({
  apiAccount: mocks.account,
  apiError: (error: Error) => Response.json({ error: error.message }, { status: 400 }),
}));
vi.mock('@/lib/cover', () => ({ uploadCover: mocks.upload, downloadCover: mocks.download }));

const id = '11111111-1111-4111-8111-111111111111',
  version = '22222222-2222-4222-8222-222222222222';

const context = { params: Promise.resolve({ id }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.account.mockResolvedValue({ memberId: 'verified-owner' });
  mocks.upload.mockResolvedValue(`/api/covers/${id}?v=${version}`);
  mocks.download.mockResolvedValue(new Blob(['image']));
});

it('uploads using only the verified account and route item, with origin checking', async () => {
  const body = new FormData();

  body.set('cover', new File(['image'], 'image.webp'));
  body.set('memberId', 'attacker');

  const request = new Request(`https://pixelar.test/api/covers/${id}`, { method: 'POST', body });
  const response = await POST(request, context);

  expect(response.status).toBe(200);
  expect(mocks.account).toHaveBeenCalledWith(request, true);
  expect(mocks.upload).toHaveBeenCalledWith('verified-owner', id, expect.any(File));
});

it('denies uploads before storage when authentication or origin checks fail', async () => {
  mocks.account.mockRejectedValueOnce(new Error('Invalid request origin.'));

  const response = await POST(
    new Request(`https://pixelar.test/api/covers/${id}`, { method: 'POST' }),
    context
  );

  expect(response.status).toBe(400);
  expect(mocks.upload).not.toHaveBeenCalled();
});

it('validates empty and oversized upload requests', async () => {
  const empty = await POST(
    new Request(`https://pixelar.test/api/covers/${id}`, { method: 'POST', body: new FormData() }),
    context
  );

  expect(empty.status).toBe(400);

  const oversized = await POST(
    new Request(`https://pixelar.test/api/covers/${id}`, {
      method: 'POST',
      headers: { 'content-length': String(7 * 1024 * 1024) },
    }),
    context
  );

  expect(oversized.status).toBe(400);
  expect(mocks.upload).not.toHaveBeenCalled();
});

it('serves covers through private noncached owner-checked downloads and rejects invalid versions', async () => {
  const response = await GET(
    new Request(`https://pixelar.test/api/covers/${id}?v=${version}`),
    context
  );

  expect(mocks.download).toHaveBeenCalledWith('verified-owner', id, version);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(response.headers.get('Content-Type')).toBe('image/webp');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');

  mocks.download.mockClear();

  expect(
    (await GET(new Request(`https://pixelar.test/api/covers/${id}?v=../../profile`), context))
      .status
  ).toBe(400);
  expect(mocks.download).not.toHaveBeenCalled();
});
