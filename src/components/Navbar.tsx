import ConnectWallet from './ConnectWallet';
import Logo from './Logo';
import ChainSelector from './ChainSelector';

const LINKS = [
  { href: '#swap', label: 'Swap' },
  { href: '#tokens', label: 'Tokens' },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-blue-100/70 bg-night/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden gap-1 sm:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3.5 py-2 text-sm text-slate-600 transition hover:bg-blue-50 hover:text-cloud focus-ring">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2"><ChainSelector /><ConnectWallet /></div>
      </div>
      <nav className="flex justify-center gap-1 border-t border-blue-100/70 py-1.5 sm:hidden" aria-label="Primary mobile">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} className="rounded-lg px-4 py-1.5 text-sm text-slate-600 hover:bg-blue-50">
            {l.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
