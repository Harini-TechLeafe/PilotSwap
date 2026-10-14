import { useEffect, useState } from 'react';
import ConnectWallet from './ConnectWallet';
import Logo from './Logo';
import ChainSelector from './ChainSelector';

const LINKS = [
  { href: '#swap', label: 'Swap' },
  { href: '#tokens', label: 'Explore Tokens' },
  { href: '#liquidity', label: 'Liquidity' },
];

export default function Navbar() {
  const current = () => (window.location.hash === '#liquidity' ? '#liquidity' : window.location.hash.startsWith('#tokens') ? '#tokens' : '#swap');
  const [active, setActive] = useState(current);
  useEffect(() => {
    const h = () => setActive(current());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const linkClass = (href: string) =>
    `rounded-xl px-4 py-2 text-base font-medium transition focus-ring ${
      active === href ? 'bg-blue-100/80 text-cloud' : 'text-slate-600 hover:bg-blue-50 hover:text-cloud'
    }`;

  const renderLink = (l: (typeof LINKS)[number]) => (
    <a key={l.href} href={l.href} onClick={() => setActive(l.href)} className={linkClass(l.href)} aria-current={active === l.href ? 'page' : undefined}>
      {l.label}
    </a>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-blue-100/70 bg-night/70 backdrop-blur-xl">
      <div className="flex h-20 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 lg:gap-10">
          <Logo />
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
            {LINKS.map(renderLink)}
          </nav>
        </div>
        {/* Right side: Network button + Connect Wallet button */}
        <div className="flex items-center gap-2">
          <ChainSelector />
          <ConnectWallet />
        </div>
      </div>
      <nav className="flex justify-center gap-1 border-t border-blue-100/70 py-1.5 sm:hidden" aria-label="Primary mobile">
        {LINKS.map(renderLink)}
      </nav>
    </header>
  );
}
