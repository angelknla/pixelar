import 'server-only';
import sharp from 'sharp';
import { coverReference } from '@/lib/cover-path';
import { db, ownedItem } from '@/lib/data/library';
import { uuid } from '@/lib/validation';

// Covers share Pixelar's existing private image bucket, with a separate item namespace.
const BUCKET = 'pixelar_avatars';
const coverPath = (memberId: string, itemId: string, version: string) =>
  `${memberId}/covers/${uuid(itemId)}/${uuid(version)}.webp`;

export async function uploadCover(memberId: string, itemId: string, file: File) {
  await ownedItem(memberId, uuid(itemId));
  if (file.size === 0 || file.size > 5 * 1024 * 1024)
    throw new Error('Choose an image under 5 MB.');
  let output: Buffer;
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 16000000,
      animated: false,
    });
    const info = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(info.format ?? '') || (info.pages ?? 1) > 1)
      throw new Error('Unsupported image.');
    output = await image
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new Error('Choose a valid JPG, PNG, or WebP image (maximum 16 megapixels).');
  }
  const version = crypto.randomUUID();
  const { error } = await db()
    .storage.from(BUCKET)
    .upload(coverPath(memberId, itemId, version), output, {
      contentType: 'image/webp',
      cacheControl: '0',
      upsert: false,
    });
  if (error) throw new Error('Could not upload the cover image. Please try again.');
  return `/api/covers/${itemId}?v=${version}`;
}

export async function downloadCover(memberId: string, itemId: string, version: string) {
  await ownedItem(memberId, uuid(itemId));
  const { data, error } = await db()
    .storage.from(BUCKET)
    .download(coverPath(memberId, itemId, version));
  if (error || !data) throw new Error('Cover image unavailable.');
  return data;
}

export async function validateCover(
  memberId: string,
  itemId: string | undefined,
  url: string | null | undefined
) {
  if (!url?.startsWith('/')) return;
  const cover = coverReference(url);
  if (!cover || !itemId || cover.itemId !== itemId)
    throw new Error('Choose a cover uploaded for this title.');
  const { error } = await db()
    .storage.from(BUCKET)
    .info(coverPath(memberId, itemId, cover.version));
  if (error) throw new Error('Cover image unavailable. Upload it again.');
}
