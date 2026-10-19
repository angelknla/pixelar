const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const coverUrlPattern = new RegExp(`^/api/covers/(${UUID})\\?v=(${UUID})$`, 'i');

export function coverReference(url: string | null | undefined) {
  const match = url?.match(coverUrlPattern);
  return match ? { itemId: match[1], version: match[2] } : null;
}
