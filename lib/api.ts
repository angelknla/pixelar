import 'server-only';
import { getCurrentAccount } from '@/lib/session';
import type { ItemKind, Provider } from '@/types/library';

export const apiAccount = async (request: Request, mutation = false) => {
  if (mutation) {
    const origin = request.headers.get('origin');

    if (!origin || origin !== new URL(request.url).origin)
      throw new Error('Invalid request origin.');
  }

  const account = await getCurrentAccount();

  if (!account) throw new Error('Sign in to continue.');

  return account;
};

export const apiError = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Request failed.';

  return Response.json(
    { error: message },
    { status: message === 'Sign in to continue.' ? 401 : 400 }
  );
};

export const sourceParams = (value: Record<string, unknown>) => {
  const provider = value.provider as Provider,
    kind = value.kind as ItemKind,
    id = String(value.provider_id ?? '');

  if (
    !['rawg', 'tmdb'].includes(provider) ||
    !['game', 'movie', 'show'].includes(kind) ||
    !/^\d{1,12}$/.test(id)
  )
    throw new Error('Invalid metadata selection.');

  return { provider, kind, id };
};
