'use client';
import { useEffect, useState } from 'react';
import { countdown } from '@/lib/library';
import type { MetadataFields } from '@/types/library';
export default function Countdown({
  fields,
  timezone,
}: {
  fields: MetadataFields;
  timezone: string;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const value = now ? countdown(fields, timezone, now) : null;
  return value ? <span className="countdown">{value}</span> : null;
}
