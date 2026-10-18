import AuthForm from '@components/AuthForm/AuthForm';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isUnlocked } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Sign in | Pixelar' };

export default async function LoginPage() {
  if (await isUnlocked()) redirect('/');
  return (
    <AuthForm
      mode="login"
      available={isSupabaseConfigured() && Boolean(process.env.APP_PASSCODE)}
    />
  );
}
