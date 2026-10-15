import { useEffect, useRef, useState } from 'react';
import { useSolana } from '../hooks/useSolana';
import { useWallet } from '../hooks/useWallet';
import { shortAddress } from '../lib/format';
import { SOLANA_RECOMMENDED } from '../lib/solanaWallets';

/** Navbar button used while the Solana network is selected: wallet list when disconnected, address menu when connected. */
export default function SolanaConnect() {
  const { wallets, address, connecting, connect, disconnect, selected } = useSolana();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  // Ethereum / Bitcoin addresses from the main wallet, shown in the same menu as Sepolia / Bitcoin
  const { account: evmAccount, evmAccounts, bitcoinAccounts, activeBitcoin } = useWallet();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (address) {
    const walletName = selected?.name ?? 'Solana wallet';
    // Same layout as the Sepolia / Bitcoin wallet menu (ConnectWallet.tsx): Ethereum, Solana and Bitcoin addresses.
    const sections = [
      { id: 'evm', label: 'Ethereum', badge: 'ETH', badgeClass: 'bg-altitude/20 text-altitude', list: evmAccounts, active: evmAccount },
      { id: 'solana', label: 'Solana', badge: 'SOL', badgeClass: 'bg-emerald-400/15 text-emerald-600', list: [address], active: address },
      { id: 'bitcoin', label: 'Bitcoin', badge: 'BTC', badgeClass: 'bg-horizon/20 text-horizon', list: bitcoinAccounts, active: activeBitcoin },
    ];
    const copy = (addr: string) => {
      void navigator.clipboard.writeText(addr);
      setCopied(addr);
      window.setTimeout(() => setCopied((c) => (c === addr ? null : c)), 1500);
    };

    return (
      <div className="relative flex items-center gap-2" ref={ref}>
        {/* Connected wallet: wallet logo + account name (same blue button as Sepolia / Bitcoin) */}
        <button
          className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-horizon py-2 pl-2 pr-2.5 text-sm sm:gap-2 sm:pr-3 font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 focus-ring"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="menu"
          title={`${walletName} · ${address}`}
        >
          {selected?.icon ? (
            <img src={selected.icon} alt={`${walletName} logo`} width={24} height={24} className="h-6 w-6 rounded-md bg-white/90 p-0.5" />
          ) : (
            <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20 text-xs">👛</span>
          )}
          <span>Account 1</span>
          <span aria-hidden className={`text-xs transition ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {open && (
          <div role="menu" className="absolute right-0 top-12 z-50 max-h-[calc(100dvh-6rem)] w-[min(92vw,22rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-panel p-2 text-sm shadow-2xl shadow-black/15">
            <div className="mb-1 flex items-center gap-2.5 px-2.5 pb-2 pt-1.5">
              {selected?.icon && <img src={selected.icon} alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />}
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{walletName} · Account 1</p>
                <p className="truncate font-mono text-xs text-slate-500">{shortAddress(address)}</p>
              </div>
            </div>
            <p className="px-2.5 pb-1.5 text-xs uppercase tracking-wider text-slate-500">Your addresses</p>

            {sections.map((sec) => (
              <div key={sec.id} className="mb-1 rounded-xl bg-blue-50 p-1.5">
                <div className="flex items-center gap-2 px-1.5 py-1">
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${sec.badgeClass}`}>{sec.badge}</span>
                  <span className="font-medium text-slate-800">{sec.label}</span>
                </div>
                {sec.list.length > 0 ? (
                  sec.list.map((addr) => {
                    const isActive = addr === sec.active;
                    return (
                      <div key={addr} className={`flex items-center gap-1 rounded-lg ${isActive ? 'bg-blue-100/70' : 'hover:bg-blue-50'}`}>
                        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-blue-200'}`} />
                          {sec.id === 'evm' && <span className="shrink-0 font-medium text-slate-800">Account {evmAccounts.findIndex((a) => a === addr) + 1}</span>}
                          <span className={`truncate font-mono ${sec.id === 'evm' ? 'text-xs text-slate-500' : 'text-slate-800'}`}>{shortAddress(addr)}</span>
                          {isActive && <span className="ml-auto text-[11px] text-emerald-600">Active</span>}
                        </div>
                        <button
                          className="shrink-0 rounded-lg px-2 py-2 text-xs text-slate-600 hover:bg-blue-100/70 hover:text-cloud focus-ring"
                          onClick={() => copy(addr)}
                          aria-label={`Copy ${sec.label} address`}
                        >
                          {copied === addr ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p className="px-2 py-2 text-slate-500">Not connected</p>
                )}
              </div>
            ))}

            <p className="px-2.5 pb-1 pt-1.5 text-xs leading-relaxed text-slate-500">
              Copy an address to receive funds. On this screen you are using Solana Devnet.
            </p>
            <div className="mt-1 border-t border-blue-100 pt-1">
              <button className="w-full rounded-lg px-3 py-2 text-left text-rose-600 hover:bg-blue-100/70" onClick={() => { void disconnect(); setOpen(false); }}>
                Disconnect from PilotSwap
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const detected = new Set(wallets.map((w) => w.name.toLowerCase()));
  const missing = SOLANA_RECOMMENDED.filter((r) => !detected.has(r.name.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button
        className="whitespace-nowrap rounded-xl bg-horizon px-3 py-2.5 text-sm font-semibold sm:px-4 text-white transition hover:brightness-110 disabled:opacity-60 focus-ring"
        disabled={connecting}
        onClick={() => setOpen((o) => !o)}
      >
        {connecting ? 'Check your wallet…' : 'Connect Wallet'}
      </button>
      {open && (
        <div role="menu" className="glass absolute right-0 top-12 z-50 w-[min(92vw,18rem)] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl p-2 text-sm">
          <p className="px-2.5 pb-1 pt-1 text-xs uppercase tracking-wider text-slate-500">Solana wallets</p>
          {wallets.map((w) => (
            <button key={w.id} disabled={connecting} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-blue-50 disabled:opacity-60 focus-ring" onClick={() => { setOpen(false); void connect(w); }}>
              {w.icon ? <img src={w.icon} alt="" width={28} height={28} className="h-7 w-7 rounded-lg" /> : <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100/70">👛</span>}
              <span className="font-medium text-slate-800">{w.name}</span>
              <span className="ml-auto text-xs text-emerald-600">Detected</span>
            </button>
          ))}
          {missing.map((r) => (
            <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-slate-600 hover:bg-blue-50 focus-ring">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100/70">⬇</span>
              <span>{r.name}</span>
              <span className="ml-auto text-xs text-horizon">Install</span>
            </a>
          ))}
          <p className="px-2.5 pb-1 pt-2 text-xs leading-relaxed text-slate-500">After installing a wallet, reload this page. Set the wallet to Devnet.</p>
        </div>
      )}
    </div>
  );
}
