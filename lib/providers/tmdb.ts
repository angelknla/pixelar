import 'server-only';
import { apiKey, array, date, fetchJson, record, score, string } from './http';
import type { MetadataProvider } from './types';

const image = (value: unknown) =>
  string(value) ? `https://image.tmdb.org/t/p/w500${value}` : null;
function url(path: string) {
  const u = new URL(`https://api.themoviedb.org/3/${path}`);
  u.searchParams.set('api_key', apiKey('TMDB_API_KEY'));
  return u;
}
function service(name: string) {
  if (/amazon prime/i.test(name)) return 'Prime Video';
  if (/apple tv/i.test(name)) return 'Apple TV';
  if (/hbo|max/i.test(name)) return 'HBO';
  return name;
}
export const tmdb: MetadataProvider = {
  async search(query, kind, region) {
    const u = url(`search/${kind === 'show' ? 'tv' : 'movie'}`);
    u.searchParams.set('query', query);
    u.searchParams.set('region', region);
    return array(record(await fetchJson(u)).results)
      .slice(0, 12)
      .flatMap((r) =>
        typeof r.id === 'number' && string(r.title ?? r.name)
          ? [
              {
                provider: 'tmdb' as const,
                provider_id: String(r.id),
                kind,
                title: String(r.title ?? r.name),
                artwork: image(r.poster_path),
                year: date(r.release_date ?? r.first_air_date)?.slice(0, 4) ?? null,
              },
            ]
          : []
      );
  },
  async details(id, kind, region) {
    const path = `${kind === 'show' ? 'tv' : 'movie'}/${id}`;
    const u = url(path);
    u.searchParams.set('append_to_response', 'external_ids,watch/providers');
    const r = record(await fetchJson(u));
    const title = string(r.title ?? r.name);
    if (!title) throw new Error('Title not found.');
    const released = date(r.release_date ?? r.first_air_date);
    const providers = record(record(record(r['watch/providers']).results)[region]);
    let metascore: number | null = null;
    const imdb = string(record(r.external_ids).imdb_id);
    if (imdb && process.env.OMDB_API_KEY) {
      try {
        const omdb = new URL('https://www.omdbapi.com/');
        omdb.searchParams.set('apikey', apiKey('OMDB_API_KEY'));
        omdb.searchParams.set('i', imdb);
        metascore = score(record(await fetchJson(omdb)).Metascore);
      } catch {
        /* Optional score enrichment must not block adding a title. */
      }
    }
    return {
      kind,
      title,
      artwork: image(r.poster_path),
      description: string(r.overview),
      publisher:
        array(kind === 'show' ? r.networks : r.production_companies)
          .map((p) => string(p.name))
          .filter(Boolean)
          .join(', ') || null,
      release_date: released,
      release_precision: released ? 'day' : 'unknown',
      metascore,
      platforms: [],
      services: [
        ...new Set(
          array(providers.flatrate)
            .map((p) => string(p.provider_name))
            .filter((p): p is string => Boolean(p))
            .map(service)
        ),
      ],
      source_url: `https://www.themoviedb.org/${path}`,
    };
  },
};
