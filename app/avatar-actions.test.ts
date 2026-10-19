// @vitest-environment node
import { saveAvatar } from './avatar-actions';

const mocks = vi.hoisted(() => ({ account: vi.fn(), upload: vi.fn(), revalidate: vi.fn() }));

vi.mock('@/lib/data/library', () => ({ requireAccount: mocks.account }));
vi.mock('@/lib/avatar', () => ({ uploadAvatar: mocks.upload }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.account.mockResolvedValue({ memberId: 'verified-owner' });
  mocks.upload.mockResolvedValue(undefined);
});

describe('profile picture action', () => {
  it('uses the verified account, ignoring submitted ownership', async () => {
    const file = new File(['image'], 'photo.webp', { type: 'image/webp' });
    const data = new FormData();

    data.set('avatarFile', file);
    data.set('memberId', 'other');

    const result = await saveAvatar({}, data);

    expect(mocks.upload).toHaveBeenCalledWith('verified-owner', file);
    expect(result.version).toBeTruthy();
    expect(result.message).toBe('Profile picture saved.');
    expect(mocks.revalidate).toHaveBeenCalledWith('/', 'layout');
  });

  it('rejects an empty selection before uploading', async () => {
    expect(await saveAvatar({}, new FormData())).toEqual({ error: 'Choose a profile picture.' });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('returns upload failures without claiming success or invalidating pages', async () => {
    mocks.upload.mockRejectedValue(new Error('Upload failed.'));

    const data = new FormData();

    data.set('avatarFile', new File(['image'], 'photo.webp'));

    expect(await saveAvatar({}, data)).toEqual({ error: 'Upload failed.' });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
