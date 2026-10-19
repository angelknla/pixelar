'use client';

const ErrorPage = ({ reset }: { reset: () => void }) => {
  return (
    <section>
      <h1>Something went wrong</h1>
      <p>
        Try again. If you have just set up Pixelar, make sure the updated library schema has been
        run in Supabase.
      </p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
};

export default ErrorPage;
