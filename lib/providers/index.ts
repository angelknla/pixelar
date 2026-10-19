import 'server-only';
import { db } from '@/lib/data/library';
import type { ItemKind, MetadataRow, Provider } from '@/types/library';
import { rawg } from './rawg';
import { tmdb } from './tmdb';

export const providerFor = (provider: Provider, kind: ItemKind) => {
  if (provider === 'rawg' && kind === 'game') return rawg;
  if (provider === 'tmdb' && (kind === 'movie' || kind === 'show')) return tmdb;

  throw new Error('Invalid provider for this title.');
};

const pendingMetadata = new Map<string, Promise<MetadataRow>>();

export const getMetadata = async (
  provider: Provider,
  id: string,
  kind: ItemKind,
  region: string,
  refresh = false
): Promise<MetadataRow> => {
  providerFor(provider, kind);

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

  const key = JSON.stringify([provider, id, kind, region]);
  const pending = pendingMetadata.get(key);

  if (pending) return pending;
  if (existing.data && !refresh) return existing.data;

  const request = (async () => {
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
  })().finally(() => pendingMetadata.delete(key));

  pendingMetadata.set(key, request);

  return request;
};
