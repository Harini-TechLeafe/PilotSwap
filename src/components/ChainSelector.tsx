import { useEffect, useRef, useState } from 'react';
import { ACTIVE_CHAIN, CONFIGURED_EVM_CHAIN_IDS, SUPPORTED_CHAINS, chainName } from '../config/chains';
import { saveSelectedChainId } from '../config/env';
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
  onSelect?: () => void;
}

/** Testnets use their parent network's logo. */
const PARENT_EVM: Record<number, number> = { 1: 1, 56: 56, 11155111: 1, 84532: 8453, 421614: 42161, 11155420: 10, 97: 56 };
const evmLogo = (id: number): TokenRef => ({ family: 'evm', chainId: PARENT_EVM[id] ?? id, address: null });

const NetworkIcon = ({ item, size = 32 }: { item: Pick<Item, 'badge' | 'logo' | 'name'>; size?: number }) => (
  <TokenLogo token={item.logo} symbol={item.badge} name={item.name} alt={`${item.name} logo`} size={size} />
);

/**
 * Network button for the configured EVM networks.
 */
export default function ChainSelector() {
  const { chainId, isConnected } = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, []);

  const items: Item[] = CONFIGURED_EVM_CHAIN_IDS.map((id) => {
    const c = SUPPORTED_CHAINS[id];
    const isActiveConfig = id === ACTIVE_CHAIN.id;
    return {
      key: `evm-${id}`,
      name: c?.name ?? chainName(id),
      badge: c?.nativeCurrency.symbol ?? 'ETH',
      logo: evmLogo(id),
      sub: isActiveConfig ? 'Active for swaps' : 'Switch to this network',
      current: isActiveConfig,
      onSelect: () => {
        setOpen(false);
        if (id !== ACTIVE_CHAIN.id) {
          saveSelectedChainId(id);
          window.location.reload();
          return;
        }
        if (isConnected && chainId !== id) window.location.reload();
      },
    };
  });
  const ordered = items;
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
          <p className="px-1 pb-2 text-xs text-slate-600">Choose the EVM network PilotSwap should use.</p>

          <ul className="space-y-1">
            {ordered.map((i) => (
              <li key={i.key}>
                <button
                  role="menuitemradio"
                  aria-checked={i.current}
                  disabled={i.current}
                  onClick={i.onSelect}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition focus-ring disabled:cursor-not-allowed ${i.current ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                >
                  <span className="shrink-0"><NetworkIcon item={i} /></span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-semibold ${i.current ? 'text-cloud' : 'text-slate-800'}`}>{i.name}</span>
                    <span className={`block truncate font-mono text-[11px] ${i.current ? 'text-slate-700' : 'text-slate-500'}`}>{i.sub}</span>
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
