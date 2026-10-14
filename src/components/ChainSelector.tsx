import { useEffect, useRef, useState } from 'react';
import { useChain } from '../chains/ChainContext';
import { CHAINS } from '../chains/registry';
import { ACTIVE_CHAIN, SUPPORTED_CHAINS, chainName } from '../config/chains';
import { useWallet } from '../hooks/useWallet';
import { shortAddress } from '../lib/format';
import type { TokenRef } from '../lib/tokenLogos';
import TokenLogo from './TokenLogo';

interface Item {
  key: string;
  name: string;
  badge: string;
  /** Network identity used to load the real network logo. */
  logo: TokenRef;
  sub: string;
  current: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

/** Testnets use their parent network's logo (Sepolia → Ethereum, Base Sepolia → Base, ...). */
const PARENT_EVM: Record<number, number> = { 11155111: 1, 84532: 8453, 421614: 42161, 11155420: 10 };
const evmLogo = (id: number): TokenRef => ({ family: 'evm', chainId: PARENT_EVM[id] ?? id, address: null });
const FAMILY_LOGO: Record<string, TokenRef> = {
  solana: { family: 'solana', mint: null },
  cardano: { family: 'cardano', policyId: null },
  bitcoin: { family: 'bitcoin' },
};

const NetworkIcon = ({ item, size = 32 }: { item: Pick<Item, 'badge' | 'logo' | 'name'>; size?: number }) => (
  <TokenLogo token={item.logo} symbol={item.badge} name={item.name} alt={`${item.name} logo`} size={size} />
);

/**
 * Network button. Shows "Network" until something is in use; then shows the network name.
 * The list is ordered: 1) the network you are using now, 2) EVM networks added in
 * config/chains.ts (SUPPORTED_CHAINS), 3) other chains added in chains/registry.ts.
 */
export default function ChainSelector() {
  const { chain, setChainId } = useChain();
  const { account, chainId, isConnected, switchNetwork } = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, []);

  const evmSelected = chain.family === 'evm';
  const usingEvmId = evmSelected && isConnected && chainId !== null ? chainId : null;

  const items: Item[] = [];

  // EVM networks added in code (config/chains.ts), plus the wallet's current chain if it is not in that list
  const evmIds = Object.keys(SUPPORTED_CHAINS).map(Number);
  if (usingEvmId !== null && !evmIds.includes(usingEvmId)) evmIds.unshift(usingEvmId);
  for (const id of evmIds) {
    const c = SUPPORTED_CHAINS[id];
    const isActiveConfig = id === ACTIVE_CHAIN.id;
    items.push({
      key: `evm-${id}`,
      name: c?.name ?? chainName(id),
      badge: 'ETH',
      logo: evmLogo(id),
      sub: usingEvmId === id && account ? shortAddress(account) : isActiveConfig ? 'Used for swaps' : c ? 'Set VITE_CHAIN_ID to use' : 'Not supported for swaps',
      current: usingEvmId === id,
      disabled: !isActiveConfig,
      onSelect: () => {
        setChainId('evm');
        if (isConnected && chainId !== ACTIVE_CHAIN.id) void switchNetwork();
        setOpen(false);
      },
    });
  }

  // Other chains added in chains/registry.ts (Solana, Cardano, Bitcoin, ...)
  for (const c of CHAINS) {
    if (c.family === 'evm') continue;
    items.push({
      key: c.id,
      name: c.name,
      badge: c.badge,
      logo: FAMILY_LOGO[c.family] ?? { family: 'evm', chainId: -1, address: null },
      sub: c.supported ? 'Live' : 'Coming soon',
      current: !evmSelected && chain.id === c.id,
      onSelect: () => { setChainId(c.id); setOpen(false); },
    });
  }

  // Current network first, everything else keeps its order
  const ordered = [...items.filter((i) => i.current), ...items.filter((i) => !i.current)];
  const current = ordered.find((i) => i.current) ?? null;

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost focus-ring flex items-center gap-2" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {current ? <NetworkIcon item={current} size={24} /> : <span aria-hidden className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100/80 text-xs text-horizon">◎</span>}
        <span>{current ? current.name : 'Network'}</span>
        <span aria-hidden className={`text-xs transition ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        /* Solid white panel (no see-through blur) so the page behind never shows through the text. */
        <div role="menu" className="absolute right-0 top-12 z-50 w-[min(92vw,22rem)] rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-2xl shadow-slate-900/15">
          <p className="px-1 font-display text-base font-semibold text-slate-900">Select network</p>
          <p className="px-1 pb-2 text-xs text-slate-600">Choose a blockchain network for your wallet.</p>

          <ul className="space-y-1">
            {ordered.map((i) => (
              <li key={i.key}>
                <button
                  role="menuitemradio"
                  aria-checked={i.current}
                  disabled={i.disabled && !i.current}
                  onClick={i.onSelect}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition focus-ring disabled:cursor-not-allowed ${i.current ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                >
                  <NetworkIcon item={i} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-semibold ${i.current ? 'text-black' : 'text-slate-500'}`}>{i.name}</span>
                    <span className={`block truncate font-mono text-[11px] ${i.current ? 'text-slate-700' : 'text-slate-400'}`}>{i.sub}</span>
                  </span>
                  {i.current && <span aria-label="In use" className="text-emerald-600">✓</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
