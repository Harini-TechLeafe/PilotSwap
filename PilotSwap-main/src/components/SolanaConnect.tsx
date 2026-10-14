import { useEffect, useRef, useState } from 'react';
import { useSolana } from '../hooks/useSolana';
import { shortAddress } from '../lib/format';
import { SOLANA_RECOMMENDED } from '../lib/solanaWallets';

/** Navbar button used while the Solana network is selected: wallet list when disconnected, address menu when connected. */
export default function SolanaConnect() {
  const { wallets, address, connecting, connect, disconnect, selected } = useSolana();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (address) {
    return (
      <div className="relative" ref={ref}>
        <button className="btn-ghost focus-ring font-mono" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
          {shortAddress(address)}
        </button>
        {open && (
          <div role="menu" className="glass absolute right-0 top-12 z-50 w-64 rounded-2xl p-2 text-sm">
            <p className="px-2.5 pt-1 text-xs uppercase tracking-wider text-slate-500">{selected?.name ?? 'Solana wallet'}</p>
            <button
              className="mt-1 w-full rounded-lg px-3 py-2 text-left font-mono text-slate-800 hover:bg-blue-50"
              onClick={() => { void navigator.clipboard.writeText(address); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}
            >
              {shortAddress(address)} <span className="float-right font-sans text-xs text-slate-500">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button className="mt-1 w-full rounded-lg px-3 py-2 text-left text-rose-600 hover:bg-blue-100/70" onClick={() => { void disconnect(); setOpen(false); }}>
              Disconnect
            </button>
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
        className="rounded-xl bg-horizon px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60 focus-ring"
        disabled={connecting}
        onClick={() => setOpen((o) => !o)}
      >
        {connecting ? 'Check your wallet…' : 'Connect Solana'}
      </button>
      {open && (
        <div role="menu" className="glass absolute right-0 top-12 z-50 w-72 rounded-2xl p-2 text-sm">
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
