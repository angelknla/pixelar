import { revalidatePath } from 'next/cache';
import { apiAccount, apiError, sourceParams } from '@/lib/api';
import { ownedItem, profileFor } from '@/lib/data/library';
import { getMetadata } from '@/lib/providers';
import { object, uuid } from '@/lib/validation';

export const POST = async (request: Request) => {
  try {
    const account = await apiAccount(request, true);
    const body = object(await request.json());
    const profile = await profileFor(account.memberId);
    const { provider, kind, id } = sourceParams(body);

    if (body.refresh) {
      const item = await ownedItem(account.memberId, uuid(body.item_id));

      if (item.kind !== kind) throw new Error('Invalid refresh target.');
      // The client must link the returned metadata through the owner-checked save action.
    }

    const metadata = await getMetadata(provider, id, kind, profile.region, Boolean(body.refresh));

    revalidatePath('/', 'layout');

    return Response.json({ metadata });
  } catch (error) {
    return apiError(error);
  }
};
