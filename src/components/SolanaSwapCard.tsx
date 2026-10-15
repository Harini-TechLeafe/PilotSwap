import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Token } from '../config/tokens';
import { usePrices } from '../hooks/usePrices';
import { useSolana } from '../hooks/useSolana';
import { DEFAULT_SLIPPAGE_BPS } from '../config/contracts';
import { formatAmount, formatRate, formatUsd, parseAmount, sanitizeAmountInput } from '../lib/format';
import { SOL_DECIMALS, SOL_FEE_RESERVE } from '../lib/solana';
import SlippageSettings from './SlippageSettings';
import TokenIcon from './TokenIcon';

/** Same look as the Ethereum swap card, for Solana. Balances come from the connected wallet; the output is a live market estimate. */
interface SolSwapToken extends Token {
  mint: string | null;
}

const SOL_TOKEN: SolSwapToken = { id: 'SOL', mint: null, symbol: 'SOL', name: 'Solana', decimals: SOL_DECIMALS, address: null, isNative: true, color: '#9945FF', glyph: '◎', coingeckoId: 'solana' };
// Circle's devnet USDC (same mint as in config/solanaTokens.ts)
const USDC_TOKEN: SolSwapToken = { id: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', symbol: 'USDC', name: 'USD Coin (devnet)', decimals: 6, address: null, isNative: false, color: '#2775CA', glyph: '$', coingeckoId: 'usd-coin' };

/** Popular Solana tokens always offered in the picker. Mints are the Solana MAINNET mints: on devnet the wallet holds none of them, so balances show 0 and only the market estimate works. */
const POPULAR_TOKENS: SolSwapToken[] = [
  { id: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', name: 'Jupiter', decimals: 6, address: null, isNative: false, color: '#2BA5A0', glyph: 'J', coingeckoId: 'jupiter-exchange-solana' },
  { id: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', symbol: 'RAY', name: 'Raydium', decimals: 6, address: null, isNative: false, color: '#5A4FE8', glyph: 'R', coingeckoId: 'raydium' },
  { id: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', name: 'Bonk', decimals: 5, address: null, isNative: false, color: '#F28C1B', glyph: 'B', coingeckoId: 'bonk' },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Selector({ value, tokens, balances, disabledId, onChange }: {
  value: SolSwapToken; tokens: SolSwapToken[]; balances: Record<string, bigint>; disabledId: string; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const q = query.trim().toLowerCase();
  const list = tokens.filter((t) => !q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex shrink-0 items-center gap-2 rounded-full border border-blue-100 bg-blue-50 py-1.5 pl-1.5 pr-3 transition hover:bg-blue-100/70 focus-ring" aria-label={`Select token, currently ${value.symbol}`}>
        <TokenIcon token={value} size={28} />
        <span className="font-display font-semibold">{value.symbol}</span>
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
                  <button
                    disabled={t.id === disabledId}
                    onClick={() => { onChange(t.id); setOpen(false); setQuery(''); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-blue-100/70 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${t.id === value.id ? 'bg-blue-100/70' : ''}`}
                  >
                    <TokenIcon token={t} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.symbol}</span>
                      <span className="block truncate text-xs text-slate-500">{t.name}</span>
                    </span>
                    <span className="font-mono text-sm text-slate-600">{formatAmount(balances[t.id] ?? 0n, t.decimals, 4)}</span>
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

export default function SolanaSwapCard({ initialFromSymbol }: { initialFromSymbol?: string } = {}) {
  const { address, portfolio, loading } = useSolana();
  const { prices } = usePrices();
  // Start on the token being viewed (e.g. from the Explore Tokens page) when it is available here.
  const startToken = [SOL_TOKEN, USDC_TOKEN, ...POPULAR_TOKENS].find((t) => t.symbol === initialFromSymbol) ?? SOL_TOKEN;
  const [fromId, setFromId] = useState(startToken.id);
  const [toId, setToId] = useState(startToken.id === USDC_TOKEN.id ? SOL_TOKEN.id : USDC_TOKEN.id);
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);

  // SOL + USDC always, plus every other token the wallet holds
  const tokens = useMemo<SolSwapToken[]>(() => {
    const extra: SolSwapToken[] = (portfolio?.tokens ?? [])
      .filter((t) => t.mint !== USDC_TOKEN.mint && !POPULAR_TOKENS.some((p) => p.mint === t.mint))
      .map((t) => ({ id: t.mint, mint: t.mint, symbol: t.symbol, name: t.name, decimals: t.decimals, address: null, isNative: false, color: '#64748B', glyph: t.symbol.slice(0, 1).toUpperCase(), coingeckoId: '' }));
    return [SOL_TOKEN, USDC_TOKEN, ...POPULAR_TOKENS, ...extra];
  }, [portfolio]);

  const balances = useMemo(() => {
    const m: Record<string, bigint> = { [SOL_TOKEN.id]: portfolio?.sol ?? 0n };
    for (const t of portfolio?.tokens ?? []) m[t.mint] = t.amount;
    return m;
  }, [portfolio]);

  const fromToken = tokens.find((t) => t.id === fromId) ?? SOL_TOKEN;
  const toToken = tokens.find((t) => t.id === toId) ?? USDC_TOKEN;
  const fromBal = balances[fromToken.id] ?? 0n;
  const toBal = balances[toToken.id] ?? 0n;
  const connected = !!address;

  const priceFrom = prices[fromToken.coingeckoId]?.usd;
  const priceTo = prices[toToken.coingeckoId]?.usd;
  const amountNum = Number(amount);
  const marketRate = priceFrom && priceTo ? priceFrom / priceTo : null;
  const out = marketRate && amountNum > 0 ? amountNum * marketRate : null;
  const parsed = parseAmount(amount, fromToken.decimals);
  const overBalance = connected && parsed !== null && parsed > fromBal;
  const fromUsd = priceFrom && amountNum > 0 ? formatUsd(amountNum * priceFrom) : null;
  const toUsd = out !== null && priceTo ? formatUsd(out * priceTo) : null;

  const flip = () => { setFromId(toId); setToId(fromId); setAmount(''); };
  const setMax = () => {
    const max = fromToken.isNative ? (fromBal > SOL_FEE_RESERVE ? fromBal - SOL_FEE_RESERVE : 0n) : fromBal;
    setAmount(formatAmount(max, fromToken.decimals, fromToken.decimals).replace(/,/g, ''));
  };
  const pick = (setter: (id: string) => void, other: string, setOther: (id: string) => void) => (id: string) => {
    if (id === other) setOther(id === fromId ? toId : fromId);
    setter(id);
  };

  return (
    <section id="swap" className="glass rounded-3xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Swap</h2>
        <SlippageSettings valueBps={slippageBps} onChange={setSlippageBps} />
      </div>

      {/* FROM */}
      <div className="field">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <label htmlFor="sol-amount-in">From</label>
          <span>Balance: {!connected ? '—' : loading && !portfolio ? '…' : formatAmount(fromBal, fromToken.decimals, 4)}</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <input
            id="sol-amount-in" inputMode="decimal" autoComplete="off" placeholder="0.0" value={amount}
            onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
            className={`min-w-0 flex-1 bg-transparent font-display text-3xl font-semibold outline-none placeholder:text-slate-300 ${overBalance ? 'text-rose-600' : ''}`}
          />
          {connected && <button type="button" onClick={setMax} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-horizon hover:bg-blue-100/70">MAX</button>}
          <Selector value={fromToken} tokens={tokens} balances={balances} disabledId={toToken.id} onChange={pick(setFromId, toId, setToId)} />
        </div>
        <p className="mt-1 h-5 text-sm text-slate-500">{fromUsd ? `≈ ${fromUsd}` : ''}</p>
      </div>

      {/* FLIP */}
      <div className="relative z-10 -my-3 flex justify-center">
        <button type="button" onClick={flip} aria-label="Reverse tokens" className="rounded-xl border border-blue-100 bg-panel p-2.5 text-lg shadow-lg transition hover:rotate-180 hover:border-horizon/60 focus-ring">⇅</button>
      </div>

      {/* TO */}
      <div className="field">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>To (estimated)</span>
          <span>Balance: {connected ? formatAmount(toBal, toToken.decimals, 4) : '—'}</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <output className={`min-w-0 flex-1 truncate font-display text-3xl font-semibold ${out !== null ? '' : 'text-slate-600'}`}>{out !== null ? formatRate(out) : '0.0'}</output>
          <Selector value={toToken} tokens={tokens} balances={balances} disabledId={fromToken.id} onChange={pick(setToId, fromId, setFromId)} />
        </div>
        <p className="mt-1 h-5 text-sm text-slate-500">{toUsd ? `≈ ${toUsd}` : ''}</p>
      </div>

      {marketRate && (
        <dl className="mt-4 divide-y divide-blue-100 rounded-2xl border border-blue-100 px-4 py-2">
          <Row label="Market rate" value={`1 ${fromToken.symbol} = ${formatRate(marketRate)} ${toToken.symbol}`} />
          <Row label="Slippage tolerance" value={`${(slippageBps / 100).toFixed(2)}%`} />
        </dl>
      )}

      {/* ACTION */}
      <div className="mt-4">
        {overBalance ? (
          <button className="btn-primary" disabled>Insufficient {fromToken.symbol} balance</button>
        ) : (
          <button className="btn-primary" disabled>Swap is not available on Solana yet</button>
        )}
        <p className="mt-3 text-center text-xs text-slate-500">Prices are live market estimates. Use your wallet to send or receive.</p>
      </div>
    </section>
  );
}
