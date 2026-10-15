import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePrices } from '../hooks/usePrices';
import { useWallet } from '../hooks/useWallet';
import { formatRate, formatUsd, sanitizeAmountInput } from '../lib/format';
import type { TokenRef } from '../lib/tokenLogos';
import SlippageSettings from './SlippageSettings';
import TokenLogo from './TokenLogo';

/* ──────────────────────────────────────────────────────────────────────────
 *  Swap card for the Bitcoin network. Same look as the Sepolia swap card:
 *  token selector, live market rate (CoinGecko), balance.
 *  Bitcoin has no smart contracts, so the actual swap needs a cross-chain
 *  service (THORChain, Chainflip, ...). Until one is wired in, the button is
 *  disabled and nothing is faked.
 * ────────────────────────────────────────────────────────────────────────── */

interface BtcToken { id: string; symbol: string; name: string; coingeckoId: string; token: TokenRef }

const BTC_TOKENS: BtcToken[] = [
  { id: 'BTC', symbol: 'BTC', name: 'Bitcoin', coingeckoId: 'bitcoin', token: { family: 'bitcoin' } },
  { id: 'ETH', symbol: 'ETH', name: 'Ether', coingeckoId: 'ethereum', token: { family: 'evm', chainId: 1, address: null } },
  { id: 'USDC', symbol: 'USDC', name: 'USD Coin', coingeckoId: 'usd-coin', token: { family: 'evm', chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2E9Eb0cE3606eB48' } },
  { id: 'USDT', symbol: 'USDT', name: 'Tether USD', coingeckoId: 'tether', token: { family: 'evm', chainId: 1, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' } },
  { id: 'SOL', symbol: 'SOL', name: 'Solana', coingeckoId: 'solana', token: { family: 'solana', mint: null } },
  { id: 'BCH', symbol: 'BCH', name: 'Bitcoin Cash', coingeckoId: 'bitcoin-cash', token: { family: 'native', folder: 'bitcoincash' } },
  { id: 'LTC', symbol: 'LTC', name: 'Litecoin', coingeckoId: 'litecoin', token: { family: 'native', folder: 'litecoin' } },
  { id: 'DOGE', symbol: 'DOGE', name: 'Dogecoin', coingeckoId: 'dogecoin', token: { family: 'native', folder: 'doge' } },
  { id: 'XRP', symbol: 'XRP', name: 'XRP', coingeckoId: 'ripple', token: { family: 'native', folder: 'ripple' } },
  { id: 'BNB', symbol: 'BNB', name: 'BNB', coingeckoId: 'binancecoin', token: { family: 'evm', chainId: 56, address: null } },
];
const byId = (id: string) => BTC_TOKENS.find((t) => t.id === id) ?? BTC_TOKENS[0];

/** BTC balance of an address from mempool.space. Testnet addresses (tb1/m/n/2) use the testnet API. Returns BTC or null. */
export async function fetchBtcBalance(address: string, signal: AbortSignal): Promise<number | null> {
  const testnet = /^(tb1|[mn2])/i.test(address);
  try {
    const res = await fetch(`https://mempool.space/${testnet ? 'testnet/' : ''}api/address/${encodeURIComponent(address)}`, { signal });
    if (!res.ok) return null;
    const d = (await res.json()) as { chain_stats?: { funded_txo_sum: number; spent_txo_sum: number }; mempool_stats?: { funded_txo_sum: number; spent_txo_sum: number } };
    const sats = (d.chain_stats?.funded_txo_sum ?? 0) - (d.chain_stats?.spent_txo_sum ?? 0) + (d.mempool_stats?.funded_txo_sum ?? 0) - (d.mempool_stats?.spent_txo_sum ?? 0);
    return sats / 1e8;
  } catch {
    return null;
  }
}

const fmtBal = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 6 });

function TokenButton({ token, onPick, disabledId }: { token: BtcToken; onPick: (id: string) => void; disabledId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BTC_TOKENS.filter((t) => !q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Select token, currently ${token.symbol}`}
        className="flex shrink-0 items-center gap-2 rounded-full border border-blue-100 bg-blue-50 py-1.5 pl-1.5 pr-3 transition hover:bg-blue-100/70 focus-ring">
        <TokenLogo token={token.token} symbol={token.symbol} name={token.name} size={28} />
        <span className="font-display font-semibold">{token.symbol}</span>
        <span aria-hidden className="text-xs text-slate-500">▾</span>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onMouseDown={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Select a token">
          <div className="glass w-full max-w-sm rounded-3xl p-4" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Select a token</h3>
              <button className="text-slate-500 hover:text-cloud" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or symbol" className="mb-3 w-full rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-2.5 text-sm outline-none focus:border-altitude/60" />
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {list.map((t) => (
                <li key={t.id}>
                  <button disabled={t.id === disabledId} onClick={() => { onPick(t.id); setOpen(false); setQuery(''); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-blue-100/70 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${t.id === token.id ? 'bg-blue-100/70' : ''}`}>
                    <TokenLogo token={t.token} symbol={t.symbol} name={t.name} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.symbol}</span>
                      <span className="block truncate text-xs text-slate-500">{t.name}</span>
                    </span>
                  </button>
                </li>
              ))}
              {!list.length && <li className="px-3 py-6 text-center text-sm text-slate-500">No tokens match “{query}”.</li>}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default function BitcoinSwapCard({ initialFromSymbol }: { initialFromSymbol?: string } = {}) {
  const { activeBitcoin, connectFamily, connectingFamily } = useWallet();
  const { prices } = usePrices();
  // Start on the token being viewed (e.g. from the Explore Tokens page) when it is supported here.
  const startId = BTC_TOKENS.some((t) => t.id === initialFromSymbol) ? (initialFromSymbol as string) : 'BTC';
  const [fromId, setFromId] = useState(startId);
  const [toId, setToId] = useState(startId === 'BTC' ? 'USDC' : 'BTC');
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50);
  const [btcBalance, setBtcBalance] = useState<number | null>(null);

  const from = byId(fromId);
  const to = byId(toId);
  const connected = !!activeBitcoin;

  // Real BTC balance of the connected Bitcoin address.
  useEffect(() => {
    if (!activeBitcoin) { setBtcBalance(null); return; }
    const ctrl = new AbortController();
    void fetchBtcBalance(activeBitcoin, ctrl.signal).then((b) => { if (!ctrl.signal.aborted) setBtcBalance(b); });
    return () => ctrl.abort();
  }, [activeBitcoin]);

  const balanceOf = (t: BtcToken): string => (!connected ? '—' : t.id === 'BTC' ? (btcBalance === null ? '—' : fmtBal(btcBalance)) : '0');

  const pickFrom = (id: string) => { if (id === toId) setToId(fromId); setFromId(id); };
  const pickTo = (id: string) => { if (id === fromId) setFromId(toId); setToId(id); };
  const flip = () => { setFromId(toId); setToId(fromId); };

  const priceFrom = prices[from.coingeckoId]?.usd;
  const priceTo = prices[to.coingeckoId]?.usd;
  const rate = priceFrom && priceTo ? priceFrom / priceTo : null;
  const amountNum = Number(amount);
  const out = rate && amountNum > 0 ? amountNum * rate : null;
  const fromUsd = priceFrom && amountNum > 0 ? formatUsd(amountNum * priceFrom) : null;
  const toUsd = out !== null && priceTo ? formatUsd(out * priceTo) : null;
  const connecting = connectingFamily === 'bitcoin';

  return (
    <section id="swap" className="glass rounded-3xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Swap</h2>
        <SlippageSettings valueBps={slippageBps} onChange={setSlippageBps} />
      </div>

      <div className="field">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <label htmlFor="btc-amount-in">From</label>
          <span>Balance: {balanceOf(from)}</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <input id="btc-amount-in" inputMode="decimal" autoComplete="off" placeholder="0.0" value={amount} onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
            className="min-w-0 flex-1 bg-transparent font-display text-3xl font-semibold outline-none placeholder:text-slate-300" />
          <TokenButton token={from} onPick={pickFrom} disabledId={toId} />
        </div>
        <p className="mt-1 h-5 text-sm text-slate-500">{fromUsd ? `≈ ${fromUsd}` : ''}</p>
      </div>

      <div className="relative z-10 -my-3 flex justify-center">
        <button type="button" onClick={flip} aria-label="Reverse tokens" className="rounded-xl border border-blue-100 bg-panel p-2.5 text-lg shadow-lg transition hover:rotate-180 hover:border-horizon/60 focus-ring">⇅</button>
      </div>

      <div className="field">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>To (estimated)</span>
          <span>Balance: {balanceOf(to)}</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <output className={`min-w-0 flex-1 truncate font-display text-3xl font-semibold ${out !== null ? '' : 'text-slate-600'}`}>{out !== null ? formatRate(out) : '0.0'}</output>
          <TokenButton token={to} onPick={pickTo} disabledId={fromId} />
        </div>
        <p className="mt-1 h-5 text-sm text-slate-500">{toUsd ? `≈ ${toUsd}` : ''}</p>
      </div>

      {rate && (
        <dl className="mt-4 divide-y divide-blue-100 rounded-2xl border border-blue-100 px-4 py-2">
          <Row label="Market rate" value={`1 ${from.symbol} = ${formatRate(rate)} ${to.symbol}`} />
          <Row label="Slippage tolerance" value={`${(slippageBps / 100).toFixed(2)}%`} />
        </dl>
      )}

      <div className="mt-4">
        {!connected ? (
          <button className="btn-primary" disabled={connecting} onClick={() => void connectFamily('bitcoin')}>
            {connecting ? 'Check your wallet…' : 'Connect Wallet'}
          </button>
        ) : (
          <button className="btn-primary" disabled>Bitcoin swaps coming soon</button>
        )}
        {!connected && <p className="mt-3 text-center text-xs text-slate-500">Prices are live market estimates. Connect a wallet to see your Bitcoin balance.</p>}
      </div>
    </section>
  );
}