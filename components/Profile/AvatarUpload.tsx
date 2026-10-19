'use client';
import { Pencil } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useEffect, useId, useState } from 'react';
import { saveAvatar } from '@/app/avatar-actions';
import { shrinkImage } from '@/lib/image';
import styles from './AvatarUpload.module.css';

export default function AvatarUpload({
  name,
  avatarPath,
}: {
  name: string;
  avatarPath: string | null;
}) {
  const router = useRouter();
  const inputId = useId();
  const [state, action, pending] = useActionState(saveAvatar, {});
  const [processing, setProcessing] = useState(false);
  const [failedVersion, setFailedVersion] = useState<string | null>(null);
  const version = state.version ?? avatarPath;
  const hasPicture = Boolean(version) && failedVersion !== version;
  const busy = processing || pending;
  useEffect(() => {
    if (state.version) router.refresh();
  }, [state.version, router]);

  return (
    <div className={styles.uploader}>
      <form action={action} className={styles.frame} aria-busy={busy}>
        <input
          id={inputId}
          className={styles.input}
          type="file"
          name="avatarFile"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Change your profile picture"
          aria-describedby={`${inputId}-hint`}
          disabled={busy}
          onChange={async (event) => {
            const input = event.currentTarget;
            const chosen = input.files?.[0];
            if (!chosen) return;
            setProcessing(true);
            try {
              const file = await shrinkImage(chosen);
              const data = new FormData();
              data.set('avatarFile', file);
              // Submit the prepared file directly; no DataTransfer support is needed.
              startTransition(() => action(data));
            } finally {
              input.value = '';
              setProcessing(false);
            }
          }}
        />
        <label htmlFor={inputId} className={styles.picture} title="Change your profile picture">
          {hasPicture ? (
            <Image
              src={`/api/avatar?v=${encodeURIComponent(version!)}`}
              alt="Your profile picture"
              width={384}
              height={384}
              unoptimized
              loading="eager"
              onError={() => setFailedVersion(version)}
            />
          ) : (
            <span aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>
          )}
        </label>
        <span className={styles.edit} aria-hidden="true">
          <Pencil size={14} />
        </span>
      </form>
      <p id={`${inputId}-hint`} className={styles.hint}>
        {busy ? 'Saving your picture…' : 'Tap your picture to change it.'}
        <br />
        JPG, PNG or WebP · up to 5 MB
      </p>
      {(state.error || state.message) && (
        <p role="status" className={state.error ? 'errorMessage' : 'successMessage'}>
          {state.error ?? state.message}
        </p>
      )}
    </div>
  );
}
