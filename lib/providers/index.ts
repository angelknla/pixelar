import 'server-only';
import { db } from '@/lib/data/library';
import type { ItemKind, Provider } from '@/types/library';
import { rawg } from './rawg';
import { tmdb } from './tmdb';
export function providerFor(provider: Provider, kind: ItemKind) {
  if (provider === 'rawg' && kind === 'game') return rawg;
  if (provider === 'tmdb' && (kind === 'movie' || kind === 'show')) return tmdb;
  throw new Error('Invalid provider for this title.');
}
export async function getMetadata(
  provider: Provider,
  id: string,
  kind: ItemKind,
  region: string,
  refresh = false
) {
  const client = db();
  const existing = await client
    .from('pixelar_metadata_cache')
    .select('*')
    .eq('provider', provider)
    .eq('provider_id', id)
    .eq('kind', kind)
    .eq('region', region)
    .maybeSingle();
  if (existing.error) throw new Error('Metadata cache unavailable.');
  if (existing.data && !refresh && Date.now() - Date.parse(existing.data.fetched_at) < 86400000)
    return existing.data;
  const fields = await providerFor(provider, kind).details(id, kind, region);
  const { data, error } = await client
    .from('pixelar_metadata_cache')
    .upsert(
      { provider, provider_id: id, kind, region, fields, fetched_at: new Date().toISOString() },
      { onConflict: 'provider,provider_id,kind,region' }
    )
    .select('*')
    .single();
  if (error) throw new Error('Could not cache metadata.');
  return data;
}
