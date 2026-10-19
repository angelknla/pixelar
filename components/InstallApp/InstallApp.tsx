'use client';

import { Download, Share, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './InstallApp.module.css';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const InstallApp = ({ sidebarTargetId }: { sidebarTargetId?: string }) => {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [sidebarTarget, setSidebarTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!sidebarTargetId) return;

    const desktop = window.matchMedia('(min-width: 651px)');

    const place = () => {
      setSidebarTarget(desktop.matches ? document.getElementById(sidebarTargetId) : null);
    };

    place();
    desktop.addEventListener('change', place);

    return () => desktop.removeEventListener('change', place);
  }, [sidebarTargetId]);

  useEffect(() => {
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        console.warn('Pixelar app worker registration failed.');
      });
    }

    const standalone = window.matchMedia('(display-mode: standalone)');
    const appleStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;

    if (standalone.matches || appleStandalone) return;

    const appleDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    setIos(appleDevice);

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };

    const installed = () => {
      setPrompt(null);
      setIos(false);
      dialog.current?.close();
    };

    const displayChanged = () => {
      if (standalone.matches) installed();
    };

    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    standalone.addEventListener('change', displayChanged);

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
      standalone.removeEventListener('change', displayChanged);
    };
  }, []);

  const install = async () => {
    setError('');

    if (!prompt) {
      dialog.current?.showModal();

      return;
    }

    setBusy(true);

    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      setError('Installation is unavailable. Try again from your browser menu.');
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  };

  if (!prompt && !ios && !error) return null;

  const controls = (
    <>
      {(prompt || ios) && (
        <button
          type="button"
          className={styles.install}
          onClick={install}
          disabled={busy}
          title="Install Pixelar"
          aria-label="Install Pixelar"
        >
          <Download size={18} aria-hidden="true" />
          Install Pixelar
        </button>
      )}
      {error && (
        <span role="status" className={styles.error}>
          {error}
        </span>
      )}
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId}>
        <button
          type="button"
          className={styles.close}
          onClick={() => dialog.current?.close()}
          title="Close"
          aria-label="Close"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <h2 id={titleId}>Install Pixelar</h2>
        <p>
          In Safari, tap <Share size={16} aria-label="Share" /> Share, then Add to Home Screen.
        </p>
        <p>Choose Open as Web App when offered, then tap Add.</p>
      </dialog>
    </>
  );

  return sidebarTarget ? createPortal(controls, sidebarTarget) : controls;
};

export default InstallApp;
