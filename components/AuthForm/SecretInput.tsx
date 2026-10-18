'use client';

import { Eye, EyeOff } from 'lucide-react';
import { type ComponentProps, useState } from 'react';
import styles from './SecretInput.module.css';

type SecretInputProps = Omit<ComponentProps<'input'>, 'type' | 'className'> & {
  secretLabel: string;
};

export default function SecretInput({ secretLabel, disabled, ...props }: SecretInputProps) {
  const [visible, setVisible] = useState(false);
  const toggleLabel = `${visible ? 'Hide' : 'Show'} ${secretLabel}`;

  return (
    <div className={styles.field}>
      <input
        {...props}
        disabled={disabled}
        type={visible ? 'text' : 'password'}
        className={styles.input}
      />
      <button
        type="button"
        className={styles.toggle}
        disabled={disabled}
        onClick={() => setVisible(!visible)}
        aria-label={toggleLabel}
        aria-controls={props.id}
        aria-pressed={visible}
        title={toggleLabel}
      >
        {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
    </div>
  );
}
