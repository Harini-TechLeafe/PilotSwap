import { useEffect } from 'react';
import Navbar from '../components/Navbar';
import { Link } from '../lib/router';

export default function NotFound() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = '404 – Page not found | PilotSwap';

    const robotsMeta = document.createElement('meta');
    robotsMeta.name = 'robots';
    robotsMeta.content = 'noindex';
    document.head.appendChild(robotsMeta);

    return () => {
      document.title = previousTitle;
      robotsMeta.remove();
    };
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center sm:py-28">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">404 Not Found</h1>
        <p className="mt-4 text-slate-600">The page you are looking for could not be found.</p>
        <Link
          to="/"
          className="mt-8 rounded-xl bg-altitude px-6 py-2.5 font-medium text-white transition hover:opacity-90 focus-ring"
        >
          Go back home
        </Link>
      </main>
    </div>
  );
}
