import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ImgHTMLAttributes } from 'react';
import { saveAvatar } from '@/app/avatar-actions';
import { shrinkImage } from '@/lib/image';
import AvatarUpload from './AvatarUpload';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('next/image', () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    const { unoptimized: _unoptimized, ...rest } = props;

    // biome-ignore lint/performance/noImgElement: next/image test double.
    return <img {...rest} alt={props.alt} />;
  },
}));
vi.mock('@/app/avatar-actions', () => ({ saveAvatar: vi.fn() }));
vi.mock('@/lib/image', () => ({ shrinkImage: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(saveAvatar).mockResolvedValue({
    message: 'Profile picture saved.',
    version: 'version-1',
  });
});

describe('tap-to-upload profile picture', () => {
  it('automatically submits the prepared image in its own form and refreshes the picture', async () => {
    const original = new File(['original'], 'phone.jpg', { type: 'image/jpeg' });
    const prepared = new File(['small'], 'phone.webp', { type: 'image/webp' });

    vi.mocked(shrinkImage).mockResolvedValue(prepared);

    render(<AvatarUpload name="Alice" avatarPath={null} />);

    const input = screen.getByLabelText('Change your profile picture');

    fireEvent.change(input, { target: { files: [original] } });
    await waitFor(() => expect(saveAvatar).toHaveBeenCalledOnce());

    expect(shrinkImage).toHaveBeenCalledWith(original);
    expect(vi.mocked(saveAvatar).mock.calls[0][1].get('avatarFile')).toBe(prepared);

    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'Your profile picture' })).toHaveAttribute(
        'src',
        '/api/avatar?v=version-1'
      )
    );

    expect(screen.getByRole('status')).toHaveTextContent('Profile picture saved.');
    expect(mocks.refresh).toHaveBeenCalled();
    expect(input.closest('form')).not.toHaveFormValues({ name: 'Alice' });
  });

  it('preserves the current picture on upload failure and permits retry', async () => {
    const file = new File(['image'], 'photo.png', { type: 'image/png' });

    vi.mocked(shrinkImage).mockResolvedValue(file);
    vi.mocked(saveAvatar).mockResolvedValue({ error: 'Upload failed.' });

    render(<AvatarUpload name="Alice" avatarPath="owner/old.webp" />);

    const input = screen.getByLabelText('Change your profile picture');

    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Upload failed.'));

    expect(screen.getByRole('img', { name: 'Your profile picture' })).toHaveAttribute(
      'src',
      '/api/avatar?v=owner%2Fold.webp'
    );
    expect(input).not.toBeDisabled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
