import { apiAccount, apiError } from '@/lib/api';
import { profileFor } from '@/lib/data/library';
import {
  confidentImportMatch,
  type ImportMatchInput,
  type ImportMatchOutcome,
  importSearchHint,
} from '@/lib/import-matching';
import { getMetadata, providerFor } from '@/lib/providers';
import { object, text } from '@/lib/validation';
import type { ItemKind } from '@/types/library';

const parseRow = (value: unknown): ImportMatchInput => {
  const row = object(value);

  if (row.kind !== null && !['game', 'movie', 'show'].includes(String(row.kind)))
    throw new Error('Choose a valid type.');
  if (typeof row.uncertain !== 'boolean') throw new Error('Invalid import row.');

  return {
    id: text(row.id, 100, true),
    title: text(row.title, 300, true),
    kind: row.kind as ItemKind | null,
    uncertain: row.uncertain,
    date_hint: row.date_hint === null ? null : text(row.date_hint, 100),
  };
};

const matchRow = async (
  row: ImportMatchInput,
  region: string,
  autoLink: boolean
): Promise<ImportMatchOutcome> => {
  const outcome: ImportMatchOutcome = { id: row.id, results: [], metadata: null, error: '' };
  const { query } = importSearchHint(row);

  if (query.length < 2 || query.length > 200) {
    outcome.error = 'Use a title between 2 and 200 characters to search, or keep it unmatched.';

    return outcome;
  }

  const kinds: ItemKind[] = row.kind ? [row.kind] : ['movie', 'show', 'game'];
  const searches = await Promise.allSettled(
    kinds.map((kind) =>
      providerFor(kind === 'game' ? 'rawg' : 'tmdb', kind).search(query, kind, region)
    )
  );

  outcome.results = searches.flatMap((search) =>
    search.status === 'fulfilled' ? search.value : []
  );

  if (searches.some((search) => search.status === 'rejected')) {
    outcome.error =
      'Some sources are unavailable. Choose a result, set a type and retry, or keep unmatched.';

    return outcome;
  }

  const match = autoLink ? confidentImportMatch(row, outcome.results) : null;

  if (match) {
    try {
      outcome.metadata = await getMetadata(match.provider, match.provider_id, match.kind, region);
    } catch {
      outcome.error = 'Could not load the matched details. Retry or keep this title unmatched.';
    }
  }

  return outcome;
};

export const POST = async (request: Request) => {
  try {
    const account = await apiAccount(request, true);
    const body = object(await request.json());

    if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 3)
      throw new Error('Match between 1 and 3 titles at a time.');
    if (typeof body.auto_link !== 'boolean') throw new Error('Invalid matching option.');

    const rows = body.rows.map(parseRow);
    const profile = await profileFor(account.memberId);
    const outcomes = await Promise.all(
      rows.map((row) => matchRow(row, profile.region, body.auto_link as boolean))
    );

    return Response.json({ outcomes }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
};
