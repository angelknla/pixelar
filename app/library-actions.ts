'use server';

import { revalidatePath } from 'next/cache';
import { validateCover } from '@/lib/cover';
import { db, ownedItem, requireAccount } from '@/lib/data/library';
import { effectiveFields, statusesFor } from '@/lib/library';
import { parseShelfLayout, parseShelfView } from '@/lib/shelves';
import { parseItem, uuid } from '@/lib/validation';
import type { Json } from '@/types/database';
import type { Status } from '@/types/library';

const changed = () => {
  revalidatePath('/', 'layout');
};

export const saveItem = async (value: unknown): Promise<{ id?: string; error?: string }> => {
  const account = await requireAccount();

  try {
    const input = parseItem(value);

    if (input.id) await ownedItem(account.memberId, input.id);

    await validateCover(account.memberId, input.id, input.overrides.artwork);

    let base = null;

    if (input.metadata_id) {
      const result = await db()
        .from('pixelar_metadata_cache')
        .select('*')
        .eq('id', input.metadata_id)
        .eq('kind', input.kind)
        .maybeSingle();

      if (result.error || !result.data) throw new Error('Metadata not found.');

      base = result.data.fields;
    }

    const fields = effectiveFields(base, input.overrides);

    if (!fields.title) throw new Error('Enter a title.');
    if (fields.release_precision !== 'unknown' && !fields.release_date)
      throw new Error('Enter a release date or choose Unknown.');

    const { data, error } = await db().rpc('pixelar_save_item', {
      owner_id: account.memberId,
      payload: input as unknown as Json,
    });

    if (error || !data)
      throw new Error('Could not save the item. Check that the library schema has been applied.');

    changed();

    return { id: data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save item.' };
  }
};

export const moveItem = async (id: string, status: Status): Promise<{ error?: string }> => {
  const account = await requireAccount();

  try {
    const item = await ownedItem(account.memberId, uuid(id));

    if (!statusesFor(item.kind).includes(status)) throw new Error('Invalid status.');

    const { error } = await db()
      .from('pixelar_items')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('member_id', account.memberId);

    if (error) throw new Error('Could not change status.');

    changed();

    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not change status.' };
  }
};

export const deleteItem = async (id: string): Promise<{ error?: string }> => {
  const account = await requireAccount();

  try {
    await ownedItem(account.memberId, uuid(id));

    const { error } = await db()
      .from('pixelar_items')
      .delete()
      .eq('id', id)
      .eq('member_id', account.memberId);

    if (error) throw new Error('Could not delete item.');

    changed();

    return {};
  } catch {
    return { error: 'Could not delete item.' };
  }
};

export const markNotificationRead = async (id: string) => {
  const account = await requireAccount();
  const { error } = await db()
    .from('pixelar_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', uuid(id))
    .eq('member_id', account.memberId);

  if (error) return { error: 'Could not mark notification read.' };

  changed();

  return {};
};

export const markAllNotificationsRead = async (): Promise<{ error?: string }> => {
  const account = await requireAccount();

  try {
    const { error } = await db()
      .from('pixelar_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('member_id', account.memberId)
      .is('read_at', null);

    if (error) return { error: 'Could not mark all notifications read.' };

    changed();

    return {};
  } catch {
    return { error: 'Could not mark all notifications read.' };
  }
};

export const saveShelfLayout = async (
  view: unknown,
  value: unknown
): Promise<{ error?: string }> => {
  const account = await requireAccount();

  try {
    const viewKey = parseShelfView(view);
    const layout = parseShelfLayout(value);
    const { error } = await db().rpc('pixelar_save_shelf_layout', {
      owner_id: account.memberId,
      view_key: viewKey,
      layout: layout as unknown as Json,
    });

    if (error)
      return {
        error:
          'Could not sync shelves. Apply the Pixelar shelf layout migration in Supabase, then retry.',
      };

    changed();

    return {};
  } catch {
    return { error: 'Could not sync shelves. Please try again.' };
  }
};

export const saveBanner = async (kind: unknown, itemId: unknown): Promise<{ error?: string }> => {
  const account = await requireAccount();

  try {
    if (kind !== 'game' && kind !== 'screen') throw new Error('Choose a library.');

    const selectedItem = itemId === null ? null : uuid(itemId);

    if (selectedItem) {
      const item = await ownedItem(account.memberId, selectedItem);

      if ((kind === 'game') !== (item.kind === 'game'))
        throw new Error('Choose a title from this library.');
      if (item.status !== (kind === 'game' ? 'playing' : 'watching'))
        throw new Error('Choose a title you’re currently playing or watching.');
    }

    const { error } = await db().rpc('pixelar_save_banner', {
      owner_id: account.memberId,
      library_kind: kind,
      selected_item: selectedItem,
    });

    if (error) throw new Error('Could not save banner. Please try again.');

    changed();

    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save banner.' };
  }
};
