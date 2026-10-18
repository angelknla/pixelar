import SignInModal from '@components/AuthForm/SignInModal';
import { ArrowUpRight, LogIn } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentAccount } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';
export default async function HomePage() {
  const account = await getCurrentAccount();
  if (account) redirect('/games');
  return (
    <section className="landing">
      <div className="landingContent">
        <span className="eyebrow">Games. Movies. TV.</span>
        <h1>
          Great games.
          <br />
          Great stories.
          <br />
          <span>One library.</span>
        </h1>
        <p>
          A home for the games you’ll play, the shows you’ll binge, and the releases you can’t wait
          for.
        </p>
        <div className="landingActions">
          <Link className="primary buttonLink" href="/register">
            Start your collection <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <Link className="buttonLink landingSignIn" href="/?signin=1" scroll={false}>
            <LogIn size={18} aria-hidden="true" /> Sign in
          </Link>
        </div>
      </div>
      <div className="landingArtwork" aria-hidden="true">
        <Image
          src="/icon.svg?v=2"
          alt=""
          width={320}
          height={320}
          preload
          unoptimized
          loading="eager"
        />
      </div>
      <div className="landingStickers" aria-hidden="true">
        <span>PLAY ✦</span>
        <span>WATCH ◉</span>
        <span>REPEAT ↻</span>
      </div>
      <Suspense fallback={null}>
        <SignInModal available={isSupabaseConfigured() && Boolean(process.env.APP_PASSCODE)} />
      </Suspense>
    </section>
  );
}
