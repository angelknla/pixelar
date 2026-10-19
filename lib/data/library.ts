import 'server-only';
import { redirect } from 'next/navigation';
import { defaultProfile, effectiveFields } from '@/lib/library';
import { getCurrentAccount } from '@/lib/session';
import { getSupabase } from '@/lib/supabase/server';
import type { LibraryItem, MetadataRow } from '@/types/library';

export const db = () => {
  const client = getSupabase();

  if (!client) throw new Error('Database connection is unavailable.');

  return client;
};

export const requireAccount = async () => {
  const account = await getCurrentAccount();

  if (!account) redirect('/?signin=1');

  return account;
};

export const profileFor = async (memberId: string) => {
  const { data, error } = await db()
    .from('pixelar_profiles')
    .select('*')
    .eq('member_id', memberId)
    .maybeSingle();

  if (error)
    throw new Error('Profile is unavailable. Apply the Pixelar library schema in Supabase.');

  return data ?? defaultProfile(memberId);
};

export const reconcile = async (memberId: string) => {
  const { error } = await db().rpc('pixelar_process_releases', { target_member: memberId });

  if (error)
    throw new Error(
      'Release processing is unavailable. Apply the Pixelar library schema in Supabase.'
    );
};

export const listItems = async (memberId: string): Promise<LibraryItem[]> => {
  const { data, error } = await db()
    .from('pixelar_items')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  if (error)
    throw new Error('Library is unavailable. Apply the Pixelar library schema in Supabase.');

  const ids = [...new Set((data ?? []).flatMap((i) => (i.metadata_id ? [i.metadata_id] : [])))];

  let metadata: MetadataRow[] = [];

  if (ids.length) {
    const result = await db().from('pixelar_metadata_cache').select('*').in('id', ids);

    if (result.error) throw new Error('Metadata is unavailable.');

    metadata = result.data ?? [];
  }

  const map = new Map(metadata.map((m) => [m.id, m]));

  return (data ?? []).map((item) => {
    const cached = item.metadata_id ? (map.get(item.metadata_id) ?? null) : null;

    return {
      ...item,
      metadata: cached,
      fields: effectiveFields(cached?.fields ?? null, item.overrides),
    };
  });
};

export const ownedItem = async (memberId: string, id: string) => {
  const { data, error } = await db()
    .from('pixelar_items')
    .select('*')
    .eq('member_id', memberId)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) throw new Error('Item not found.');

  return data;
};

export const remindersFor = async (memberId: string, itemId: string) => {
  const { data, error } = await db()
    .from('pixelar_reminders')
    .select('*')
    .eq('member_id', memberId)
    .eq('item_id', itemId);

  if (error) throw new Error('Reminders are unavailable.');

  return data ?? [];
};

export const notificationsFor = async (memberId: string) => {
  const { data, error } = await db()
    .from('pixelar_notifications')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error('Notifications are unavailable.');

  return data ?? [];
};
