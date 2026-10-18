'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { lock } from '@/app/auth-actions';
import { updateProfile } from '@/app/profile-actions';
import { PLATFORMS, serviceLabel, SERVICES } from '@/lib/library';
import type { MemberAccount } from '@/types/auth';
import type { ProfileRow } from '@/types/library';
import AvatarUpload from './AvatarUpload';
import Theme from './Theme';
export default function Profile({
  account,
  profile,
}: {
  account: MemberAccount;
  profile: ProfileRow;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
  const [password, setPassword] = useState('');
  const [settings, setSettings] = useState<ProfileRow>({
    ...profile,
    theme: profile.theme === 'light' ? 'light' : 'dark',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const patch = <K extends keyof ProfileRow>(key: K, value: ProfileRow[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));
  function run(work: () => Promise<void>) {
    setError('');
    setMessage('');
    start(async () => {
      try {
        await work();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update profile.');
      }
    });
  }
  const toggle = (key: 'platforms' | 'services', value: string) =>
    patch(
      key,
      settings[key].includes(value)
        ? settings[key].filter((v) => v !== value)
        : [...settings[key], value]
    );
  return (
    <>
      <Theme theme={settings.theme} />
      <header className="pageHeading">
        <div>
          <span className="eyebrow">Account & preferences</span>
          <h1>Your profile</h1>
          <p>Your details, platforms, and streaming services.</p>
        </div>
      </header>
      <div className="profileLayout">
        <section className="profileIdentity">
          <AvatarUpload name={name} avatarPath={profile.avatar_path} />
          <h2>{name}</h2>
          <p>@{account.username}</p>
          <form action={lock}>
            <button type="submit">Sign out</button>
          </form>
        </section>
        <form
          className="profileForm"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const result = await updateProfile({ ...settings, name, email, password });
              if (result.error) throw new Error(result.error);
              setPassword('');
              router.refresh();
              setMessage('Profile saved.');
            });
          }}
        >
          <fieldset>
            <legend>Account</legend>
            <label>
              Display name
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {email !== account.email && (
              <label>
                Current password
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span className="hint">Confirm your password to change your login email.</span>
              </label>
            )}
          </fieldset>
          <fieldset>
            <legend>Where you are</legend>
            <div className="formGrid">
              <label>
                Region (country code)
                <input
                  required
                  pattern="[A-Za-z]{2}"
                  maxLength={2}
                  value={settings.region}
                  onChange={(e) => patch('region', e.target.value.toUpperCase())}
                />
              </label>
              <label>
                Currency
                <input
                  required
                  maxLength={3}
                  pattern="[A-Za-z]{3}"
                  value={settings.currency}
                  onChange={(e) => patch('currency', e.target.value.toUpperCase())}
                />
              </label>
            </div>
            <label>
              Timezone
              <input
                required
                list="timezones"
                value={settings.timezone}
                onChange={(e) => patch('timezone', e.target.value)}
              />
              <datalist id="timezones">
                {[
                  'Europe/London',
                  'Europe/Paris',
                  'America/New_York',
                  'America/Los_Angeles',
                  'Australia/Sydney',
                  'Asia/Tokyo',
                  'UTC',
                ].map((t) => (
                  <option value={t} key={t} />
                ))}
              </datalist>
            </label>
            <p className="hint">
              Release days and 9am reminders use this timezone. Prices keep their original currency.
            </p>
          </fieldset>
          <fieldset>
            <legend>Platforms you own</legend>
            <div className="choiceChips">
              {[...new Set([...PLATFORMS, ...settings.platforms])].map((p) => (
                <label key={p}>
                  <input
                    type="checkbox"
                    checked={settings.platforms.includes(p)}
                    onChange={() => toggle('platforms', p)}
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Your streaming subscriptions</legend>
            <div className="choiceChips">
              {[...new Set([...SERVICES, ...settings.services])].map((s) => (
                <label key={s}>
                  <input
                    type="checkbox"
                    checked={settings.services.includes(s)}
                    onChange={() => toggle('services', s)}
                  />
                  <span>{serviceLabel(s)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Preferences</legend>
            <label>
              Appearance
              <select
                value={settings.theme}
                onChange={(e) => patch('theme', e.target.value as ProfileRow['theme'])}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={settings.notifications_enabled}
                onChange={(e) => patch('notifications_enabled', e.target.checked)}
              />
              Enable in-app notifications
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={settings.default_release_reminder}
                onChange={(e) => patch('default_release_reminder', e.target.checked)}
              />
              Add a release-day reminder to new titles
            </label>
          </fieldset>
          {error && (
            <p role="alert" className="errorMessage">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="successMessage">
              {message}
            </p>
          )}
          <button type="submit" className="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>
    </>
  );
}
