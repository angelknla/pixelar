import { revalidatePath } from 'next/cache';
import { apiAccount, apiError } from '@/lib/api';
import { db, profileFor } from '@/lib/data/library';
import { getMetadata } from '@/lib/providers';
import { object, uuid } from '@/lib/validation';

export const POST = async (request: Request) => {
  try {
    const account = await apiAccount(request, true);
    const body = object(await request.json());

    if (!Array.isArray(body.item_ids) || !body.item_ids.length || body.item_ids.length > 4)
      throw new Error('Choose up to four titles to sync.');

    const ids = [...new Set(body.item_ids.map(uuid))];

    const client = db();
    const result = await client
      .from('pixelar_items')
      .select('*')
      .eq('member_id', account.memberId)
      .in('id', ids);

    if (result.error || result.data?.length !== ids.length) throw new Error('Item not found.');

    const profile = await profileFor(account.memberId);

    const metadataIds = [
      ...new Set(result.data.flatMap((i) => (i.metadata_id ? [i.metadata_id] : []))),
    ];

    const cached = metadataIds.length
      ? await client.from('pixelar_metadata_cache').select('*').in('id', metadataIds)
      : { data: [], error: null };

    if (cached.error) throw new Error('Metadata is unavailable.');

    const metadata = new Map((cached.data ?? []).map((m) => [m.id, m]));
    const tasks = new Map<string, Promise<void>>();
    const outcomes = await Promise.all(
      result.data.map(async (item) => {
        if (!item.metadata_id) return { id: item.id, state: 'skipped' as const };

        const source = metadata.get(item.metadata_id);

        if (!source || source.kind !== item.kind) return { id: item.id, state: 'failed' as const };

        let task = tasks.get(source.id);

        if (!task) {
          task = (async () => {
            const updated = await getMetadata(
              source.provider,
              source.provider_id,
              source.kind,
              profile.region,
              true
            );

            if (updated.id !== source.id) {
              // Region changes relink only this member's titles; personal fields stay intact.
              const link = await client
                .from('pixelar_items')
                .update({ metadata_id: updated.id })
                .eq('member_id', account.memberId)
                .eq('metadata_id', source.id);

              if (link.error) throw new Error('Could not link metadata.');
            }
          })();
          tasks.set(source.id, task);
        }

        try {
          await task;

          return { id: item.id, state: 'updated' as const };
        } catch {
          return { id: item.id, state: 'failed' as const };
        }
      })
    );

    revalidatePath('/', 'layout');

    return Response.json({ outcomes }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
};
