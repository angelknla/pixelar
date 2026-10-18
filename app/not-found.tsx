import Link from 'next/link';

export default function NotFound() {
  return (
    <section>
      <h1>Page not found</h1>
      <Link href="/">Go home</Link>
    </section>
  );
}
