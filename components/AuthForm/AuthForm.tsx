'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginWithCredentials, registerAccount } from '@/app/auth-actions';
import type { ActionState } from '@/types/auth';
import styles from './AuthForm.module.css';
import SecretInput from './SecretInput';

const initialState: ActionState = {};

export default function AuthForm({
  mode,
  available,
  embedded = false,
  headingId,
}: {
  mode: 'login' | 'register';
  available: boolean;
  embedded?: boolean;
  headingId?: string;
}) {
  const registering = mode === 'register';
  const [state, action, pending] = useActionState(
    registering ? registerAccount : loginWithCredentials,
    initialState
  );

  return (
    <section className={`${styles.section} ${embedded ? styles.embedded : ''}`}>
      {embedded ? (
        <h2 id={headingId}>{registering ? 'Create account' : 'Sign in'}</h2>
      ) : (
        <h1 id={headingId}>{registering ? 'Create account' : 'Sign in'}</h1>
      )}
      <form action={action} className={styles.form}>
        <fieldset disabled={!available || pending}>
          {registering ? (
            <>
              <label htmlFor="passcode">App passcode</label>
              <SecretInput
                id="passcode"
                name="passcode"
                secretLabel="app passcode"
                autoComplete="off"
                maxLength={256}
                required
              />
              <label htmlFor="name">Name</label>
              <input id="name" name="name" autoComplete="name" maxLength={80} required />
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,29}"
                required
              />
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
              />
            </>
          ) : (
            <>
              <label htmlFor="login">Username or email</label>
              <input id="login" name="login" autoComplete="username" maxLength={254} required />
            </>
          )}
          <label htmlFor="password">Password</label>
          <SecretInput
            id="password"
            name="password"
            secretLabel="password"
            autoComplete={registering ? 'new-password' : 'current-password'}
            minLength={registering ? 8 : undefined}
            maxLength={128}
            required
          />
          <button type="submit">
            {pending ? 'Please wait...' : registering ? 'Create account' : 'Sign in'}
          </button>
        </fieldset>
        {!available && (
          <p role="status">{registering ? 'Registration' : 'Sign-in'} is currently unavailable.</p>
        )}
        {state.error && (
          <p role="alert" className={styles.error}>
            {state.error}
          </p>
        )}
      </form>
      <Link href={registering ? '/?signin=1' : '/register'} scroll={false}>
        {registering ? 'Sign in' : 'Create account'}
      </Link>
    </section>
  );
}
