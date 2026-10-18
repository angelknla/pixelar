'use server';
import { revalidatePath } from 'next/cache';
import { isValidEmail, normalizeEmail, verifyPassword } from '@/lib/account';
import { getCredentialByLogin } from '@/lib/data/accounts';
import { db, requireAccount } from '@/lib/data/library';
import { object, strings, text } from '@/lib/validation';
import type { Json } from '@/types/database';
export async function updateProfile(value: unknown) {
  const account = await requireAccount();
  try {
    const input = object(value);
    const name = text(input.name, 80, true);
    const email = normalizeEmail(text(input.email, 254, true));
    if (!isValidEmail(email)) throw new Error('Enter a valid email address.');
    if (email !== account.email) {
      text(input.password, 128, true);
      const password = input.password as string;
      const credential = await getCredentialByLogin(account.username);
      if (
        !credential ||
        credential.member_id !== account.memberId ||
        !(await verifyPassword(password, credential.password_hash))
      )
        throw new Error('Your current password is incorrect.');
    }
    const region = text(input.region, 2, true).toUpperCase(),
      currency = text(input.currency, 3, true).toUpperCase(),
      timezone = text(input.timezone, 80, true);
    if (!/^[A-Z]{2}$/.test(region) || !/^[A-Z]{3}$/.test(currency))
      throw new Error('Check region and currency codes.');
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
      new Intl.NumberFormat('en-GB', { style: 'currency', currency });
    } catch {
      throw new Error('Invalid timezone or currency.');
    }
    if (!['system', 'light', 'dark'].includes(String(input.theme)))
      throw new Error('Choose a theme.');
    if (
      typeof input.notifications_enabled !== 'boolean' ||
      typeof input.default_release_reminder !== 'boolean'
    )
      throw new Error('Invalid notification settings.');
    const settings = {
      region,
      currency,
      timezone,
      platforms: strings(input.platforms),
      services: strings(input.services),
      notifications_enabled: input.notifications_enabled,
      default_release_reminder: input.default_release_reminder,
      theme: input.theme,
    };
    const { error } = await db().rpc('pixelar_update_profile', {
      owner_id: account.memberId,
      display_name: name,
      new_email: email,
      settings: settings as Json,
    });
    if (error?.code === '23505') throw new Error('That email address is already in use.');
    if (error) throw new Error('Could not update your profile.');
    revalidatePath('/', 'layout');
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not update profile.' };
  }
}
