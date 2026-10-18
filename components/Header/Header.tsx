import Image from 'next/image';
import Link from 'next/link';
import { lock } from '@/app/auth-actions';
import styles from './Header.module.css';

export default function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/">
        <Image src="/icon.svg?v=2" width={38} height={38} alt="" unoptimized />
        pixelar<span>.</span>
      </Link>
      <nav aria-label="Main navigation">
        {signedIn ? (
          <>
            <Link href="/profile">Profile</Link>
            <form action={lock}>
              <button type="submit">Sign out</button>
            </form>
          </>
        ) : (
          <>
            <Link href="/?signin=1" scroll={false}>
              Sign in
            </Link>
            <Link href="/register">Create account</Link>
          </>
        )}
      </nav>
    </header>
  );
}
