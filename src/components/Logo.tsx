import { Link } from '../lib/router';

const BASE = import.meta.env.BASE_URL;

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`flex shrink-0 items-center gap-2 sm:gap-3 ${className}`} aria-label="PilotSwap home">
      {/* Icon cropped from the brand logo. White tile on the light blue/white theme. */}
      <span className="flex h-10 w-10 items-center sm:h-12 sm:w-12 justify-center rounded-2xl border border-blue-100 bg-white p-1.5 shadow-md shadow-blue-900/10">
        <img src={`${BASE}logo-icon.png`} alt="" width={40} height={28} className="h-auto w-full" draggable={false} />
      </span>
      <span className="hidden font-display text-xl font-bold min-[420px]:inline sm:text-2xl tracking-tight text-cloud">PilotSwap</span>
    </Link>
  );
}
