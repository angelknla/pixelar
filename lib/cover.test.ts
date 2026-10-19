// @vitest-environment node
import sharp from 'sharp';
import { downloadCover, uploadCover, validateCover } from './cover';
import { coverReference } from './cover-path';
import { parseOverrides } from './validation';

const mocks = vi.hoisted(() => ({
  ownedItem: vi.fn(),
  bucket: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  info: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/data/library', () => ({
  ownedItem: mocks.ownedItem,
  db: () => ({ storage: { from: mocks.bucket } }),
}));
const id = '11111111-1111-4111-8111-111111111111';
const version = '22222222-2222-4222-8222-222222222222';
const url = `/api/covers/${id}?v=${version}`;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.ownedItem.mockResolvedValue({ id });
  mocks.bucket.mockReturnValue(mocks);
  mocks.upload.mockResolvedValue({ error: null });
  mocks.download.mockResolvedValue({ data: new Blob(['image']), error: null });
  mocks.info.mockResolvedValue({ data: {}, error: null });
});
it('accepts only the exact internal cover URL format or HTTPS artwork', () => {
  expect(coverReference(url)).toEqual({ itemId: id, version });
  expect(parseOverrides({ artwork: url })).toEqual({ artwork: url });
  for (const artwork of [
    '/api/avatar',
    '//evil.test',
    `${url}&other=1`,
    `/api/covers/${id}?v=../profile`,
    'http://example.com/image',
  ])
    expect(() => parseOverrides({ artwork })).toThrow();
  expect(parseOverrides({ artwork: 'https://example.com/image.webp' }).artwork).toBeTruthy();
});
it('rejects another account’s item before any image/storage operations', async () => {
  mocks.ownedItem.mockRejectedValue(new Error('Item not found.'));
  await expect(uploadCover('owner', id, new File(['bad'], 'image.png'))).rejects.toThrow(
    'Item not found.'
  );
  await expect(downloadCover('owner', id, version)).rejects.toThrow('Item not found.');
  expect(mocks.bucket).not.toHaveBeenCalled();
});
it('validates bytes, resizes a real cover without cropping, strips metadata, and uses the owner namespace', async () => {
  const bytes = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: 'red' },
  })
    .withMetadata({ orientation: 1 })
    .jpeg()
    .toBuffer();
  const result = await uploadCover('owner', id, new File([new Uint8Array(bytes)], 'image.jpg'));
  const ref = coverReference(result)!;
  expect(mocks.upload.mock.calls[0][0]).toBe(`owner/covers/${id}/${ref.version}.webp`);
  expect(mocks.bucket).toHaveBeenCalledWith('pixelar_avatars');
  const info = await sharp(mocks.upload.mock.calls[0][1]).metadata();
  expect(info).toMatchObject({ format: 'webp', width: 1920, height: 1280 });
  expect(info.exif).toBeUndefined();
  expect(mocks.upload.mock.calls[0][2].upsert).toBe(false);
});
it('rejects invalid, oversized and excessively large images before upload', async () => {
  await expect(uploadCover('owner', id, new File(['fake'], 'image.png'))).rejects.toThrow(
    /valid JPG/
  );
  await expect(
    uploadCover('owner', id, new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'image.png'))
  ).rejects.toThrow(/under 5 MB/);
  const bytes = await sharp({
    create: { width: 4100, height: 4100, channels: 3, background: 'red' },
  })
    .png()
    .toBuffer();
  await expect(
    uploadCover('owner', id, new File([new Uint8Array(bytes)], 'large.png'))
  ).rejects.toThrow(/valid JPG/);
  expect(mocks.upload).not.toHaveBeenCalled();
});
it('validates the referenced object under the owner and rejects other items and missing uploads', async () => {
  await validateCover('owner', id, url);
  expect(mocks.info).toHaveBeenCalledWith(`owner/covers/${id}/${version}.webp`);
  await expect(validateCover('owner', version, url)).rejects.toThrow(/this title/);
  await expect(validateCover('owner', undefined, url)).rejects.toThrow(/this title/);
  mocks.info.mockResolvedValueOnce({ error: { message: 'Not found' } });
  await expect(validateCover('owner', id, url)).rejects.toThrow(/Upload it again/);
});
it('returns upload/download failures without exposing storage errors', async () => {
  const bytes = await sharp({ create: { width: 20, height: 10, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
  mocks.upload.mockResolvedValueOnce({ error: { message: 'private detail' } });
  await expect(
    uploadCover('owner', id, new File([new Uint8Array(bytes)], 'image.png'))
  ).rejects.toThrow('Could not upload the cover image.');
  mocks.download.mockResolvedValueOnce({ error: { message: 'private detail' } });
  await expect(downloadCover('owner', id, version)).rejects.toThrow('Cover image unavailable.');
  await downloadCover('owner', id, version);
  expect(mocks.ownedItem).toHaveBeenCalledWith('owner', id);
  expect(mocks.download).toHaveBeenCalledWith(`owner/covers/${id}/${version}.webp`);
});
