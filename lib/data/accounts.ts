import 'server-only';
import { getSupabase } from '@/lib/supabase/server';
import type { CredentialRow, MemberAccount } from '@/types/auth';

export const getCredentialByLogin = async (login: string): Promise<CredentialRow | null> => {
  const supabase = getSupabase();

  if (!supabase) return null;

  const { data, error } = await supabase
    .from('pixelar_member_credentials')
    .select('member_id, username, email, password_hash')
    .eq(login.includes('@') ? 'email' : 'username', login)
    .maybeSingle();

  if (error) throw new Error('Account lookup failed.');

  return data as CredentialRow | null;
};

export const getAccount = async (memberId: string): Promise<MemberAccount | null> => {
  const supabase = getSupabase();

  if (!supabase) return null;

  const { data, error } = await supabase
    .from('pixelar_member_credentials')
    .select('member_id, username, email, members:pixelar_members!inner(name)')
    .eq('member_id', memberId)
    .maybeSingle();

  if (error) throw new Error('Account lookup failed.');
  if (!data) return null;

  const row = data as unknown as {
    member_id: string;
    username: string;
    email: string;
    members: { name: string };
  };

  return {
    memberId: row.member_id,
    name: row.members.name,
    username: row.username,
    email: row.email,
  };
};

export const createAccount = async (
  name: string,
  username: string,
  email: string,
  passwordHash: string
): Promise<{ memberId?: string; error?: string }> => {
  const supabase = getSupabase();

  if (!supabase) return { error: 'Account registration is unavailable.' };

  const { data, error } = await supabase.rpc('create_pixelar_account', {
    account_name: name,
    account_username: username,
    account_email: email,
    account_password_hash: passwordHash,
  });

  if (error?.code === '23505') return { error: 'That username or email is already in use.' };
  if (error || typeof data !== 'string') return { error: 'Could not create your account.' };

  return { memberId: data };
};
