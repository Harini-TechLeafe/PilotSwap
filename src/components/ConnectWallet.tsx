import { useEffect, useRef, useState } from 'react';
import { ACTIVE_CHAIN } from '../config/chains';
import { METAMASK_MISSING, useWallet, type NonEvmFamily } from '../hooks/useWallet';
import { shortAddress } from '../lib/format';

export const METAMASK_DOWNLOAD = 'https://metamask.io/download/';

export default function ConnectWallet() {
  const {
    account, isConnecting, connect, disconnect, isInstalled, selectedWallet,
    evmAccounts, solanaAccounts, bitcoinAccounts, activeSolana, activeBitcoin,
    solanaAvailable, bitcoinAvailable, connectingFamily, isSwitching, connectFamily, switchAccount,
  } = useWallet();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (addr: string) => {
    void navigator.clipboard.writeText(addr);
    setCopied(addr);
    window.setTimeout(() => setCopied((c) => (c === addr ? null : c)), 1500);
  };

  const sections: {
    id: 'evm' | NonEvmFamily;
    label: string;
    badge: string;
    badgeClass: string;
    list: string[];
    active: string | null;
    available: boolean;
  }[] = [
    { id: 'evm', label: 'Ethereum', badge: 'ETH', badgeClass: 'bg-altitude/20 text-altitude', list: evmAccounts, active: account, available: true },
    { id: 'solana', label: 'Solana', badge: 'SOL', badgeClass: 'bg-emerald-400/15 text-emerald-600', list: solanaAccounts, active: activeSolana, available: solanaAvailable },
    { id: 'bitcoin', label: 'Bitcoin', badge: 'BTC', badgeClass: 'bg-horizon/20 text-horizon', list: bitcoinAccounts, active: activeBitcoin, available: bitcoinAvailable },
  ];
  /*
   * Wallets never tell websites their own account names, so we number the accounts in the order the
   * wallet shared them with PilotSwap and keep that order stable when you switch (Account 1, Account 2, ...).
   */
  const seenOrder = useRef<string[]>([]);
  for (const a of evmAccounts) {
    const k = a.toLowerCase();
    if (!seenOrder.current.includes(k)) seenOrder.current.push(k);
  }
  const accountLabel = (addr: string) => {
    const i = seenOrder.current.indexOf(addr.toLowerCase());
    return `Account ${i === -1 ? 1 : i + 1}`;
  };

  const [open, setOpen] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && (setOpen(false), setShowMissing(false));
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!account) {
    return (
      <div className="relative" ref={ref}>
        <button
          className="rounded-xl bg-horizon px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60 focus-ring"
          disabled={isConnecting}
          onClick={() => void connect()}
        >
          {isConnecting ? 'Check your wallet…' : 'Connect Wallet'}
        </button>
        {showMissing && !isInstalled && (
          <div role="alert" className="glass absolute right-0 top-12 z-50 w-72 rounded-xl p-3.5 text-sm">
            <p className="text-slate-700">{METAMASK_MISSING}</p>
            <a className="mt-2 inline-block font-medium text-horizon hover:underline" href={METAMASK_DOWNLOAD} target="_blank" rel="noopener noreferrer">
              Get MetaMask
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2" ref={ref}>
      {/* Connected wallet: wallet logo + account name (like "MetaMask · Account 1") */}
      <button
        className="flex items-center gap-2 rounded-xl bg-horizon py-2 pl-2 pr-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 focus-ring"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`${selectedWallet?.info.name ?? 'Wallet'} · ${account}`}
      >
        {selectedWallet?.info.icon ? (
          <img src={selectedWallet.info.icon} alt={`${selectedWallet.info.name} logo`} width={24} height={24} className="h-6 w-6 rounded-md bg-white/90 p-0.5" />
        ) : (
          <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20 text-xs">👛</span>
        )}
        <span>{accountLabel(account)}</span>
        <span aria-hidden className={`text-xs transition ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div role="menu" className="glass absolute right-0 top-12 z-50 w-[min(92vw,22rem)] rounded-2xl p-2 text-sm">
          <div className="mb-1 flex items-center gap-2.5 px-2.5 pb-2 pt-1.5">
            {selectedWallet?.info.icon && <img src={selectedWallet.info.icon} alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />}
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{selectedWallet?.info.name ?? 'Wallet'} · {accountLabel(account)}</p>
              <p className="truncate font-mono text-xs text-slate-500">{shortAddress(account)}</p>
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
                      <button
                        role="menuitemradio"
                        aria-checked={isActive}
                        disabled={isSwitching}
                        title={isActive ? 'Active in your wallet' : 'Switch to this address in your wallet'}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left disabled:opacity-60 focus-ring"
                        onClick={() => { if (!isActive) void switchAccount(sec.id, addr); }}
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-blue-200'}`} />
                        {sec.id === 'evm' && <span className="shrink-0 font-medium text-slate-800">{accountLabel(addr)}</span>}
                        <span className={`truncate font-mono ${sec.id === 'evm' ? 'text-xs text-slate-500' : 'text-slate-800'}`}>{shortAddress(addr)}</span>
                        {isActive && <span className="ml-auto text-[11px] text-emerald-600">Active</span>}
                      </button>
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
              ) : sec.id === 'evm' ? (
                <p className="px-2 py-2 text-slate-500">No Ethereum address shared.</p>
              ) : sec.available ? (
                <button
                  className="w-full rounded-lg px-2 py-2 text-left text-horizon hover:bg-blue-50 disabled:opacity-60 focus-ring"
                  disabled={connectingFamily === sec.id}
                  onClick={() => void connectFamily(sec.id as NonEvmFamily)}
                >
                  {connectingFamily === sec.id ? 'Check your wallet…' : `Connect ${sec.label} account`}
                </button>
              ) : (
                <p className="px-2 py-2 text-slate-500">Not available in this wallet yet</p>
              )}
            </div>
          ))}

          <p className="px-2.5 pb-1 pt-1.5 text-xs leading-relaxed text-slate-500">
            Click an address to switch it in your wallet. Swaps run on {ACTIVE_CHAIN.name} (Ethereum) only.
          </p>
          <div className="mt-1 border-t border-blue-100 pt-1">
            <button className="w-full rounded-lg px-3 py-2 text-left text-rose-600 hover:bg-blue-100/70" onClick={() => { void disconnect(); setOpen(false); }}>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
