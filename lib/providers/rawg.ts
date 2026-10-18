import 'server-only';
import { apiKey, array, date, fetchJson, record, score, string } from './http';
import type { MetadataProvider } from './types';

function url(path: string) {
  const u = new URL(`https://api.rawg.io/api/${path}`);
  u.searchParams.set('key', apiKey('RAWG_API_KEY'));
  return u;
}
export const rawg: MetadataProvider = {
  async search(query) {
    const u = url('games');
    u.searchParams.set('search', query);
    u.searchParams.set('page_size', '12');
    const data = record(await fetchJson(u));
    return array(data.results).flatMap((r) =>
      typeof r.id === 'number' && string(r.name)
        ? [
            {
              provider: 'rawg' as const,
              provider_id: String(r.id),
              kind: 'game' as const,
              title: String(r.name),
              artwork: string(r.background_image),
              year: date(r.released)?.slice(0, 4) ?? null,
            },
          ]
        : []
    );
  },
  async details(id) {
    const r = record(await fetchJson(url(`games/${id}`)));
    const released = date(r.released);
    if (!string(r.name)) throw new Error('Game not found.');
    return {
      kind: 'game',
      title: String(r.name),
      artwork: string(r.background_image),
      description: string(r.description_raw),
      publisher:
        array(r.publishers)
          .map((p) => string(p.name))
          .filter(Boolean)
          .join(', ') || null,
      release_date: released,
      release_precision: released ? 'day' : 'unknown',
      metascore: score(r.metacritic),
      platforms: array(r.platforms)
        .map((p) => string(record(p.platform).name))
        .filter((p): p is string => Boolean(p)),
      services: [],
      source_url: `https://rawg.io/games/${string(r.slug) ?? id}`,
    };
  },
};
