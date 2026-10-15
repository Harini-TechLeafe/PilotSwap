import { useEffect, useRef, useState } from 'react';
import { useChain } from '../chains/ChainContext';
import { CHAINS } from '../chains/registry';
import { ACTIVE_CHAIN, SUPPORTED_CHAINS, chainName } from '../config/chains';
import { useWallet } from '../hooks/useWallet';
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
  /** true = network the app is actually used with for swaps (listed first, full colour) */
  used: boolean;
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

/** Non-EVM networks used for swaps. Add an id from chains/registry.ts here to move a network to the top. */
const USED_CHAIN_IDS = ['bitcoin', 'solana'];

const NetworkIcon = ({ item, size = 32 }: { item: Pick<Item, 'badge' | 'logo' | 'name'>; size?: number }) => (
  <TokenLogo token={item.logo} symbol={item.badge} name={item.name} alt={`${item.name} logo`} size={size} />
);

/**
 * Network button. Shows the name of the selected network (Sepolia, Solana, Bitcoin, ...).
 * The list is ordered: 1) the network you are using now, 2) EVM networks added in
 * config/chains.ts (SUPPORTED_CHAINS), 3) other chains added in chains/registry.ts.
 */
export default function ChainSelector() {
  const { chain, setChainId } = useChain();
  const { chainId, isConnected, switchNetwork } = useWallet();
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
  // Ethereum (Sepolia) selected: show the wallet's chain when connected, otherwise Sepolia itself,
  // so the button shows the network name just like Solana and Bitcoin do (instead of "Network").
  const usingEvmId = evmSelected ? (isConnected && chainId !== null ? chainId : ACTIVE_CHAIN.id) : null;

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
      sub: isActiveConfig ? 'Used for swaps' : 'Coming soon',
      used: isActiveConfig,
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
      sub: USED_CHAIN_IDS.includes(c.id) ? 'Used for swaps' : 'Coming soon',
      used: USED_CHAIN_IDS.includes(c.id),
      current: !evmSelected && chain.id === c.id,
      onSelect: () => { setChainId(c.id); setOpen(false); },
    });
  }

  // Networks used for swaps go on top, everything else ("Coming soon") follows below in a lighter style.
  // Order of the "Used for swaps" networks at the top: Bitcoin, Solana, then Ethereum (Sepolia).
  const TOP_ORDER = ['bitcoin', 'solana', 'evm'];
  const rank = (i: Item) => TOP_ORDER.indexOf(i.key.startsWith('evm-') ? 'evm' : i.key);
  const ordered = [...items.filter((i) => i.used).sort((a, b) => rank(a) - rank(b)), ...items.filter((i) => !i.used)];
  const current = ordered.find((i) => i.current) ?? null;

  return (
    <div className="sm:relative" ref={ref}>
      <button className="btn-ghost focus-ring flex items-center gap-1.5 !px-2.5 sm:gap-2 sm:!px-3.5" aria-label={current ? `Network: ${current.name}` : 'Select network'} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {current ? <NetworkIcon item={current} size={24} /> : <span aria-hidden className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100/80 text-xs text-horizon">◎</span>}
        <span className="hidden sm:inline">{current ? current.name : 'Network'}</span>
        <span aria-hidden className={`text-xs transition ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        /* Solid white panel (no see-through blur) so the page behind never shows through the text. */
        <div role="menu" className="absolute inset-x-3 top-full z-50 mt-2 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border sm:inset-x-auto sm:right-0 sm:top-12 sm:mt-0 sm:w-[22rem] border-slate-200 bg-panel p-3 text-sm shadow-2xl shadow-black/15">
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
                  {/* "Coming soon" networks get a faded logo so the used ones stand out */}
                  <span className={`shrink-0 ${i.used || i.current ? '' : 'opacity-50'}`}><NetworkIcon item={i} /></span>
                  <span className="min-w-0 flex-1">
                    {/* Selected = black. Used for swaps = dark grey. Coming soon = light grey. */}
                    <span className={`block truncate font-semibold ${i.current ? 'text-cloud' : i.used ? 'text-slate-800' : 'text-slate-400'}`}>{i.name}</span>
                    <span className={`block truncate font-mono text-[11px] ${i.current ? 'text-slate-700' : i.used ? 'text-slate-500' : 'text-slate-300'}`}>{i.sub}</span>
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
