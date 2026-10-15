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
  const active = path === '/liquidity' ? '/liquidity' : path.startsWith('/tokens') ? '/tokens' : '/';

  const linkClass = (to: string) =>
    `rounded-xl px-4 py-2 text-base font-medium transition focus-ring ${
      active === to ? 'bg-blue-100/80 text-cloud' : 'text-slate-600 hover:bg-blue-50 hover:text-cloud'
    }`;

  const renderLink = (l: (typeof LINKS)[number]) => (
    <Link key={l.to} to={l.to} className={linkClass(l.to)} aria-current={active === l.to ? 'page' : undefined}>
      {l.label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-blue-100/70 bg-night/70 backdrop-blur-xl">
      <div className="flex h-[4.5rem] w-full items-center justify-between gap-2 px-3 sm:h-24 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 lg:gap-10">
          <Logo />
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
            {LINKS.map(renderLink)}
          </nav>
        </div>
        {/* Right side: theme toggle + Network button + Connect Wallet button */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <ChainSelector />
          {chain.family === 'solana' ? <SolanaConnect /> : <ConnectWallet />}
        </div>
      </div>
      <nav className="flex justify-center gap-1 border-t border-blue-100/70 py-1.5 sm:hidden" aria-label="Primary mobile">
        {LINKS.map(renderLink)}
      </nav>
    </header>
  );
}
