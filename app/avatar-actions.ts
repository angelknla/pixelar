'use server';

import { revalidatePath } from 'next/cache';
import { uploadAvatar } from '@/lib/avatar';
import { requireAccount } from '@/lib/data/library';

export interface AvatarState {
  error?: string;
  message?: string;
  version?: string;
}

export const saveAvatar = async (
  _previous: AvatarState,
  formData: FormData
): Promise<AvatarState> => {
  const account = await requireAccount();

  try {
    const file = formData.get('avatarFile');

    if (!(file instanceof File) || file.size === 0) throw new Error('Choose a profile picture.');

    await uploadAvatar(account.memberId, file);
    revalidatePath('/', 'layout');

    return { message: 'Profile picture saved.', version: crypto.randomUUID() };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not save your profile picture.',
    };
  }
};
