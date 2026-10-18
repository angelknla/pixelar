import 'server-only';
import sharp from 'sharp';
import { db, profileFor } from '@/lib/data/library';
export async function uploadAvatar(memberId: string, file: File) {
  if (file.size > 5 * 1024 * 1024 || file.size === 0)
    throw new Error('Choose an image under 5 MB.');
  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    const image = sharp(input, { limitInputPixels: 16000000, animated: false });
    const info = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(info.format ?? '') || (info.pages ?? 1) > 1)
      throw new Error('Unsupported image.');
    output = await image
      .rotate()
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new Error('Choose a valid JPG, PNG, or WebP image (maximum 16 megapixels).');
  }
  const client = db(),
    profile = await profileFor(memberId);
  const path = `${memberId}/profile.webp`;
  const uploaded = await client.storage
    .from('pixelar_avatars')
    .upload(path, output, { contentType: 'image/webp', cacheControl: '0', upsert: true });
  if (uploaded.error) throw new Error('Avatar upload failed. Check the Pixelar storage setup.');
  if (profile.avatar_path === path) return;
  const saved = await client
    .from('pixelar_profiles')
    .upsert({ member_id: memberId, avatar_path: path }, { onConflict: 'member_id' });
  if (saved.error) {
    await client.storage.from('pixelar_avatars').remove([path]);
    throw new Error('Could not save avatar.');
  }
  if (profile.avatar_path?.startsWith(`${memberId}/`))
    await client.storage.from('pixelar_avatars').remove([profile.avatar_path]);
}
export async function downloadAvatar(memberId: string) {
  const profile = await profileFor(memberId);
  const path = profile.avatar_path;
  if (!path?.startsWith(`${memberId}/`)) return null;
  const { data, error } = await db().storage.from('pixelar_avatars').download(path);
  if (error) throw new Error('Avatar unavailable.');
  return data;
}
