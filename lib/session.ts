import 'server-only';
import { cookies } from 'next/headers';
import { COOKIE_NAME, deriveToken, readViewerToken, tokensMatch, VIEWER_COOKIE } from '@/lib/auth';
import { getAccount } from '@/lib/data/accounts';
import type { MemberAccount } from '@/types/auth';

export const hasAppAccess = async (): Promise<boolean> => {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return false;
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return Boolean(value && tokensMatch(value, await deriveToken(passcode)));
};

export const readViewer = async (): Promise<{ memberId: string | null }> => {
  const secret = process.env.APP_PASSCODE;
  const value = (await cookies()).get(VIEWER_COOKIE)?.value;
  if (!secret || !value) return { memberId: null };
  return { memberId: await readViewerToken(value, secret) };
};

export const getCurrentAccount = async (): Promise<MemberAccount | null> => {
  if (!(await hasAppAccess())) return null;
  const { memberId } = await readViewer();
  return memberId ? getAccount(memberId) : null;
};

export const isUnlocked = async (): Promise<boolean> => Boolean(await getCurrentAccount());
