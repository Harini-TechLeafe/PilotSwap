import { Link } from '../lib/router';
import { APP_VERSION_LABEL } from '../config/version';

const BASE = import.meta.env.BASE_URL;

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`flex shrink-0 items-center gap-2 sm:gap-3 ${className}`} aria-label={`PilotSwap home, ${APP_VERSION_LABEL}`}>
      {/* Brand icon on a transparent background (no tile). Scales up with the screen size. */}
      <img
        src={`${BASE}logo-icon.png`}
        alt=""
        width={798}
        height={582}
        className="h-12 w-auto drop-shadow-[0_4px_10px_rgba(37,99,235,0.25)] sm:h-16 lg:h-[4.5rem]"
        draggable={false}
      />
      <span className="hidden font-display text-lg font-semibold tracking-tight text-cloud min-[420px]:inline sm:text-xl">PilotSwap</span>
      <span className="hidden rounded-full border border-blue-200/70 bg-blue-100/70 px-2.5 py-0.5 text-xs font-semibold text-blue-700 min-[420px]:inline sm:text-sm dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
        {APP_VERSION_LABEL}
      </span>
    </Link>
  );
}
