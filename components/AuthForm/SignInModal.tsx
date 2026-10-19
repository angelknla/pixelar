'use client';

import { X } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useRef } from 'react';
import AuthForm from './AuthForm';
import styles from './SignInModal.module.css';

const SignInModal = ({ available }: { available: boolean }) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const open = searchParams.get('signin') === '1';

  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());

    params.delete('signin');
    router.replace(params.size ? `/?${params}` : '/', { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    const element = dialog.current;

    if (!element) return;

    if (!open) {
      element.close();

      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    element.showModal();
    element.querySelector<HTMLInputElement>('input[name="login"]:enabled')?.focus();

    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={headingId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;

        const bounds = event.currentTarget.getBoundingClientRect();

        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          close();
        }
      }}
    >
      {open && (
        <>
          <button type="button" className={styles.close} aria-label="Close sign in" onClick={close}>
            <X size={20} aria-hidden="true" />
          </button>
          <div className={styles.branding}>
            <Image src="/icon.svg?v=2" alt="" width={44} height={44} unoptimized loading="eager" />
            <span className="eyebrow">Welcome back to Pixelar</span>
          </div>
          <AuthForm mode="login" available={available} embedded headingId={headingId} />
        </>
      )}
    </dialog>
  );
};

export default SignInModal;
