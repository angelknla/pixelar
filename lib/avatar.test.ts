// @vitest-environment node
import sharp from 'sharp';
import { downloadAvatar, uploadAvatar } from './avatar';

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  bucket: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/data/library', () => ({
  profileFor: mocks.profile,
  db: () => ({ storage: { from: mocks.bucket }, from: mocks.from }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile.mockResolvedValue({ avatar_path: null });
  mocks.bucket.mockReturnValue({
    upload: mocks.upload,
    download: mocks.download,
    remove: mocks.remove,
  });
  mocks.from.mockReturnValue({ upsert: mocks.upsert });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
});

describe('private avatar ownership and validation', () => {
  it('never downloads a different owner path', async () => {
    mocks.profile.mockResolvedValue({ avatar_path: 'other/image.webp' });

    expect(await downloadAvatar('owner')).toBeNull();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it('rejects fake images before storage access', async () => {
    await expect(
      uploadAvatar('owner', new File(['bad'], 'avatar.png', { type: 'image/png' }))
    ).rejects.toThrow(/valid JPG/);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('resizes actual image bytes and writes only under verified owner', async () => {
    const bytes = await sharp({
      create: { width: 1000, height: 750, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();

    await uploadAvatar('owner', new File([new Uint8Array(bytes)], 'image.png'));

    const [path, output] = mocks.upload.mock.calls[0];

    expect(path).toBe('owner/profile.webp');

    const info = await sharp(output).metadata();

    expect(info).toMatchObject({ format: 'webp', width: 512, height: 384 });
    expect(mocks.upload).toHaveBeenCalledWith(path, expect.any(Buffer), {
      contentType: 'image/webp',
      cacheControl: '0',
      upsert: true,
    });
    expect(mocks.upsert).toHaveBeenCalledWith(
      { member_id: 'owner', avatar_path: path },
      { onConflict: 'member_id' }
    );
  });

  it('replaces an existing deterministic picture without deleting it or rewriting the profile', async () => {
    mocks.profile.mockResolvedValue({ avatar_path: 'owner/profile.webp' });

    const bytes = await sharp({ create: { width: 20, height: 10, channels: 3, background: 'red' } })
      .png()
      .toBuffer();

    await uploadAvatar('owner', new File([new Uint8Array(bytes)], 'image.png'));

    expect(mocks.upload.mock.calls[0][0]).toBe('owner/profile.webp');
    expect((await sharp(mocks.upload.mock.calls[0][1]).metadata()).width).toBe(20);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('keeps a legacy avatar until its replacement is saved successfully', async () => {
    mocks.profile.mockResolvedValue({ avatar_path: 'owner/legacy.webp' });

    const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'red' } })
      .png()
      .toBuffer();

    mocks.upsert.mockResolvedValueOnce({ error: { message: 'save failed' } });

    await expect(
      uploadAvatar('owner', new File([new Uint8Array(bytes)], 'image.png'))
    ).rejects.toThrow('Could not save avatar.');
    expect(mocks.remove).toHaveBeenCalledWith(['owner/profile.webp']);
    expect(mocks.remove).not.toHaveBeenCalledWith(['owner/legacy.webp']);

    mocks.remove.mockClear();
    await uploadAvatar('owner', new File([new Uint8Array(bytes)], 'image.png'));

    expect(mocks.remove).toHaveBeenCalledWith(['owner/legacy.webp']);
  });
});
