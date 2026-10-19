'use client';
import { Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { shrinkImage } from '@/lib/image';

export default function CoverUpload({
  itemId,
  disabled,
  onUploaded,
  onBusy,
}: {
  itemId: string;
  disabled: boolean;
  onUploaded: (url: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const hint = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  return (
    <div className="coverUpload" aria-busy={busy}>
      <div className="coverUploadRow">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Choose cover image"
          aria-describedby={hint}
          tabIndex={-1}
          disabled={busy || disabled}
          onChange={async (event) => {
            const element = event.currentTarget;
            const file = element.files?.[0];
            if (!file) return;
            setError('');
            setMessage('');
            setBusy(true);
            onBusy(true);
            try {
              if (file.size > 5 * 1024 * 1024) throw new Error('Choose an image under 5 MB.');
              const prepared = await shrinkImage(file, 1920);
              const data = new FormData();
              data.set('cover', prepared);
              const response = await fetch(`/api/covers/${itemId}`, { method: 'POST', body: data });
              const result = await response.json();
              if (!response.ok)
                throw new Error(result.error || 'Could not upload the cover image.');
              onUploaded(result.url);
              setMessage('Cover uploaded. Save changes to use it.');
            } catch (error) {
              setError(
                error instanceof Error ? error.message : 'Could not upload the cover image.'
              );
            } finally {
              setBusy(false);
              onBusy(false);
              element.value = '';
            }
          }}
        />
        <button type="button" disabled={busy || disabled} onClick={() => input.current?.click()}>
          <Upload size={17} aria-hidden="true" />
          {busy ? 'Uploading…' : 'Upload image'}
        </button>
        <p className="hint" id={hint}>
          JPG, PNG or WebP · up to 5 MB
        </p>
      </div>
      {error && (
        <p className="errorMessage" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="successMessage" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
