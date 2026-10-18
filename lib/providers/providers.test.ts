import { rawg } from './rawg';
import { tmdb } from './tmdb';

vi.mock('server-only', () => ({}));
beforeEach(() => {
  vi.stubEnv('RAWG_API_KEY', 'test-key');
  vi.stubEnv('TMDB_API_KEY', 'test-key');
  vi.stubEnv('OMDB_API_KEY', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('server metadata providers', () => {
  it('offers manual adding when keys are missing', async () => {
    vi.stubEnv('RAWG_API_KEY', '');
    await expect(rawg.search('Hades', 'game', 'GB')).rejects.toThrow(/manually/);
  });
  it('does not include provider request URLs or credentials in errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('https://api.rawg.io?key=test-key'))
    );
    await expect(rawg.search('Hades', 'game', 'GB')).rejects.toThrow(
      'The metadata provider is unavailable. Try again later or add manually.'
    );
  });
  it('normalizes RAWG detail fields and nullable scores', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          name: 'Hades',
          released: '2020-09-17',
          metacritic: 93,
          description_raw: 'Escape',
          platforms: [{ platform: { name: 'PC' } }],
          publishers: [{ name: 'Supergiant' }],
        })
      )
    );
    expect(await rawg.details('1', 'game', 'GB')).toMatchObject({
      title: 'Hades',
      metascore: 93,
      platforms: ['PC'],
      publisher: 'Supergiant',
      release_precision: 'day',
    });
  });
  it('normalizes UK streaming suggestions and tolerates optional OMDb failure', async () => {
    vi.stubEnv('OMDB_API_KEY', 'test-key');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          title: 'Film',
          release_date: '2026-10-18',
          external_ids: { imdb_id: 'tt123' },
          'watch/providers': {
            results: {
              GB: {
                flatrate: [
                  { provider_name: 'Amazon Prime Video' },
                  { provider_name: 'Apple TV Plus' },
                ],
              },
              US: { flatrate: [{ provider_name: 'Netflix' }] },
            },
          },
        })
      )
      .mockRejectedValueOnce(new Error('OMDb timeout'));
    vi.stubGlobal('fetch', fetch);
    expect(await tmdb.details('1', 'movie', 'GB')).toMatchObject({
      title: 'Film',
      services: ['Prime Video', 'Apple TV'],
      metascore: null,
    });
  });
});
