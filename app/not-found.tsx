import Link from 'next/link';

const NotFound = () => {
  return (
    <section>
      <h1>Page not found</h1>
      <Link href="/">Go home</Link>
    </section>
  );
};

export default NotFound;
