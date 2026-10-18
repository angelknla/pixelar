import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentAccount } from '@/lib/session';
export default async function HomePage() {
  const account = await getCurrentAccount();
  if (account) redirect('/games');
  return (
    <section className="landing">
      <span className="eyebrow">Games. Movies. TV.</span>
      <h1>
        Great games.
        <br />Great stories.
        <br />
        <span>One library.</span>
      </h1>
      <p>
        A home for the games you’ll play, the shows you’ll binge, and the releases you can’t wait
        for.
      </p>
      <div className="inline">
        <Link className="primary buttonLink" href="/register">
          Start your collection ↗
        </Link>
        <Link href="/login">Sign in</Link>
      </div>
      <div className="landingStickers" aria-hidden="true">
        <span>PLAY ✦</span>
        <span>WATCH ◉</span>
        <span>REPEAT ↻</span>
      </div>
    </section>
  );
}
