'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  hashPassword,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
  verifyPassword,
} from '@/lib/account';
import {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  createViewerToken,
  deriveToken,
  tokensMatch,
  VIEWER_COOKIE,
} from '@/lib/auth';
import { createAccount, getCredentialByLogin } from '@/lib/data/accounts';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import type { ActionState } from '@/types/auth';

const setAuthenticatedCookies = async (memberId: string) => {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) throw new Error('Authentication is not configured.');
  const store = await cookies();
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
  store.set(COOKIE_NAME, await deriveToken(passcode), options);
  store.set(VIEWER_COOKIE, await createViewerToken(memberId, passcode), options);
};

export const loginWithCredentials = async (
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> => {
  if (!isSupabaseConfigured() || !process.env.APP_PASSCODE) {
    return { error: 'Sign-in is currently unavailable.' };
  }
  const login = String(formData.get('login') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!login || !password || login.length > 254 || password.length > 128) {
    return { error: 'Enter your username or email and password.' };
  }
  try {
    const credential = await getCredentialByLogin(login);
    if (!credential || !(await verifyPassword(password, credential.password_hash))) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return { error: 'Username/email or password is incorrect.' };
    }
    await setAuthenticatedCookies(credential.member_id);
  } catch {
    return { error: 'Sign-in is currently unavailable. Please try again later.' };
  }
  redirect('/');
};

export const registerAccount = async (
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> => {
  const passcode = process.env.APP_PASSCODE;
  if (!isSupabaseConfigured() || !passcode) {
    return { error: 'Registration is currently unavailable.' };
  }
  const entered = String(formData.get('passcode') ?? '');
  if (
    entered.length > 256 ||
    !tokensMatch(await deriveToken(entered), await deriveToken(passcode))
  ) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { error: 'That app passcode is not right.' };
  }
  const name = String(formData.get('name') ?? '').trim();
  const username = normalizeUsername(String(formData.get('username') ?? ''));
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');
  if (!name || name.length > 80) return { error: 'Enter a name between 1 and 80 characters.' };
  if (!isValidUsername(username))
    return { error: 'Use a username with 3 to 30 letters, numbers, dots, underscores or hyphens.' };
  if (!isValidEmail(email) || email.length > 254) return { error: 'Enter a valid email address.' };
  if (!isValidPassword(password)) return { error: 'Use a password between 8 and 128 characters.' };
  try {
    const result = await createAccount(name, username, email, await hashPassword(password));
    if (result.error || !result.memberId)
      return { error: result.error ?? 'Could not create your account.' };
    await setAuthenticatedCookies(result.memberId);
  } catch {
    return { error: 'Registration is currently unavailable. Please try again later.' };
  }
  redirect('/');
};

export const lock = async (): Promise<void> => {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  store.delete(VIEWER_COOKIE);
  redirect('/login');
};
