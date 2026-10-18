'use client';
import { useEffect } from 'react';
export default function Theme({ theme }: { theme: 'system' | 'light' | 'dark' }) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  }, [theme]);
  return null;
}
