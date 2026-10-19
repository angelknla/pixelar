'use client';

import { useEffect } from 'react';

const Theme = ({ theme }: { theme: 'system' | 'light' | 'dark' }) => {
  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  }, [theme]);

  return null;
};

export default Theme;
