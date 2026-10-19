import AuthForm from '@components/AuthForm/AuthForm';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isUnlocked } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Create account | Pixelar' };

const RegisterPage = async () => {
  if (await isUnlocked()) redirect('/');

  return (
    <AuthForm
      mode="register"
      available={isSupabaseConfigured() && Boolean(process.env.APP_PASSCODE)}
    />
  );
};

export default RegisterPage;
