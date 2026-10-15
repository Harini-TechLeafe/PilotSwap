
import ConnectWallet from './ConnectWallet';
import Logo from './Logo';
import ChainSelector from './ChainSelector';
import SolanaConnect from './SolanaConnect';
import ThemeToggle from './ThemeToggle';

import { useChain } from '../chains/ChainContext';
import { Link, usePath } from '../lib/router';

const LINKS = [
  { to: '/', label: 'Swap' },
  { to: '/tokens', label: 'Explore Tokens' },
  { to: '/liquidity', label: 'Liquidity' },
];

export default function Navbar() {
  const { chain } = useChain();
  const path = usePath();

  const active =
    path === '/liquidity'
      ? '/liquidity'
      : path.startsWith('/tokens')
        ? '/tokens'
        : '/';

  const linkClass = (to: string) =>
    `rounded-xl px-4 py-2 text-base font-medium transition focus-ring ${
      active === to
        ? 'bg-blue-100/80 text-cloud'
        : 'text-slate-600 hover:bg-blue-50 hover:text-cloud'
    }`;

  const renderDesktopLink = (
    link: (typeof LINKS)[number]
  ) => (
    <Link
      key={link.to}
      to={link.to}
      className={linkClass(link.to)}
      aria-current={active === link.to ? 'page' : undefined}
    >
      {link.label}
    </Link>
  );

  return (
    <>
      {/* =========================================
          TOP NAVBAR
      ========================================= */}

      <header className="sticky top-0 z-40 w-full border-b border-blue-100/70 bg-night/70 backdrop-blur-xl">

        {/* =========================================
            DESKTOP NAVBAR
        ========================================= */}

        <div className="hidden h-20 w-full items-center justify-between gap-4 px-6 lg:flex lg:px-8">

          {/* LEFT SIDE */}
          <div className="flex min-w-0 items-center gap-6 lg:gap-10">
            <Logo />

            <nav
              className="flex items-center gap-1"
              aria-label="Primary navigation"
            >
              {LINKS.map(renderDesktopLink)}
            </nav>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex min-w-0 items-center gap-2">
            <ThemeToggle />

            <ChainSelector />

            {chain.family === 'solana' ? (
              <SolanaConnect />
            ) : (
              <ConnectWallet />
            )}
          </div>
        </div>

        {/* =========================================
            MOBILE TOP NAVBAR - SINGLE ROW
        ========================================= */}

        <div className="flex h-16 w-full min-w-0 items-center justify-between gap-1 px-2 lg:hidden">

          {/* LOGO */}
          <div className="min-w-0 shrink-0">
            <Logo />
          </div>

          {/* THEME, NETWORK, WALLET */}
          <div className="flex min-w-0 items-center justify-end gap-1">

            {/* DARK / LIGHT MODE */}
            <ThemeToggle />

            {/* BLOCKCHAIN NETWORK */}
            <ChainSelector />

            {/* CONNECT WALLET */}
            <div className="min-w-0">
              {chain.family === 'solana' ? (
                <SolanaConnect />
              ) : (
                <ConnectWallet />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =========================================
          MOBILE BOTTOM NAVIGATION - THREE ITEMS
      ========================================= */}

      <nav
        className="
          fixed
          bottom-0
          left-0
          right-0
          z-50
          grid
          grid-cols-3
          border-t
          border-blue-100
          bg-panel/95
          px-2
          pt-2
          pb-[env(safe-area-inset-bottom)]
          shadow-lg
          backdrop-blur-xl
          lg:hidden
        "
        aria-label="Mobile bottom navigation"
      >

        {/* SWAP */}
        <Link
          to="/"
          aria-current={active === '/' ? 'page' : undefined}
          className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition focus-ring ${
            active === '/'
              ? 'bg-blue-50 text-horizon'
              : 'text-slate-500 hover:text-cloud'
          }`}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 7h14l-4-4" />
            <path d="m21 7-4 4" />
            <path d="M17 17H3l4-4" />
            <path d="m3 17 4 4" />
          </svg>

          <span>Swap</span>
        </Link>

        {/* EXPLORE TOKENS */}
        <Link
          to="/tokens"
          aria-current={active === '/tokens' ? 'page' : undefined}
          className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition focus-ring ${
            active === '/tokens'
              ? 'bg-blue-50 text-horizon'
              : 'text-slate-500 hover:text-cloud'
          }`}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m15.5 8.5-2.5 5-5 2.5 2.5-5z" />
          </svg>

          <span>Explore</span>
        </Link>

        {/* LIQUIDITY */}
        <Link
          to="/liquidity"
          aria-current={active === '/liquidity' ? 'page' : undefined}
          className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition focus-ring ${
            active === '/liquidity'
              ? 'bg-blue-50 text-horizon'
              : 'text-slate-500 hover:text-cloud'
          }`}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3c-3 4-7 8.1-7 12a7 7 0 0 0 14 0c0-3.9-4-8-7-12z" />
          </svg>

          <span>Liquidity</span>
        </Link>
      </nav>
    </>
  );
}
