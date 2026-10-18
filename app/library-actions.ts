'use server';
import { revalidatePath } from 'next/cache';
import { db, ownedItem, requireAccount } from '@/lib/data/library';
import { effectiveFields, statusesFor } from '@/lib/library';
import { parseItem, uuid } from '@/lib/validation';
import type { Json } from '@/types/database';
import type { Status } from '@/types/library';

function changed() {
  revalidatePath('/', 'layout');
}
export async function saveItem(value: unknown): Promise<{ id?: string; error?: string }> {
  const account = await requireAccount();
  try {
    const input = parseItem(value);
    if (input.id) await ownedItem(account.memberId, input.id);
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
}
export async function moveItem(id: string, status: Status): Promise<{ error?: string }> {
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
}
export async function deleteItem(id: string): Promise<{ error?: string }> {
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
}
export async function markNotificationRead(id: string) {
  const account = await requireAccount();
  const { error } = await db()
    .from('pixelar_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', uuid(id))
    .eq('member_id', account.memberId);
  if (error) return { error: 'Could not mark notification read.' };
  changed();
  return {};
}
