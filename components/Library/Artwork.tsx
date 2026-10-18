'use client';
import { Gamepad2, MonitorPlay } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import type { ItemKind } from '@/types/library';
export default function Artwork({
  url,
  title,
  kind,
  eager = false,
}: {
  url: string | null;
  title: string;
  kind: ItemKind;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className={`artwork ${kind === 'game' ? 'gameArt' : 'screenArt'}`}>
      {url && url !== failed ? (
        <Image
          src={url}
          alt={title}
          fill
          unoptimized
          loading={eager ? 'eager' : 'lazy'}
          sizes="(max-width: 650px) 45vw, 240px"
          onError={() => setFailed(url)}
        />
      ) : (
        <div className="artPlaceholder">
          {kind === 'game' ? <Gamepad2 size={42} /> : <MonitorPlay size={42} />}
          <span>{title || 'Your next favourite'}</span>
        </div>
      )}
    </div>
  );
}
