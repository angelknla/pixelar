import { apiAccount, apiError } from '@/lib/api';
import { profileFor } from '@/lib/data/library';
import { providerFor } from '@/lib/providers';
import type { ItemKind } from '@/types/library';
export async function GET(request: Request) {
  try {
    const account = await apiAccount(request);
    const params = new URL(request.url).searchParams;
    const query = (params.get('q') ?? '').trim();
    const kind = params.get('kind') as ItemKind;
    if (query.length < 2 || query.length > 200 || !['game', 'movie', 'show'].includes(kind))
      throw new Error('Enter at least two characters and choose a type.');
    const profile = await profileFor(account.memberId);
    const results = await providerFor(kind === 'game' ? 'rawg' : 'tmdb', kind).search(
      query,
      kind,
      profile.region
    );
    return Response.json({ results }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
