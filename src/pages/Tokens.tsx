import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { Link } from '../lib/router';
import { ValueChart } from '../components/PortfolioCard';
import ChainComingSoon from '../components/ChainComingSoon';
import BitcoinSwapCard, { fetchBtcBalance } from '../components/BitcoinSwapCard';
import SolanaSwapCard from '../components/SolanaSwapCard';
import Navbar from '../components/Navbar';
import PriceTicker from '../components/PriceTicker';
import Sparkline from '../components/Sparkline';
import SwapCard from '../components/SwapCard';
import TokenLogo from '../components/TokenLogo';
import { useChain } from '../chains/ChainContext';
import { ACTIVE_CHAIN } from '../config/chains';
import { getToken, isTokenConfigured } from '../config/tokens';
import { useBalances } from '../hooks/useBalances';
import { useMarket } from '../hooks/useMarket';
import { useSolana } from '../hooks/useSolana';
import { SOLANA_RECOMMENDED } from '../lib/solanaWallets';
import { SOL_DECIMALS } from '../lib/solana';
import { useSparklines } from '../hooks/useSparklines';
import { useTokenChart } from '../hooks/useTokenChart';
import { useWallet } from '../hooks/useWallet';
import { EXPLORE_TOKENS, change1h, findExploreToken, formatCompactUsd, formatPrice, type ChartRange, type ExploreToken, type Quote } from '../lib/binance';
import { formatAmount, formatUsd } from '../lib/format';

const LINE = '#1550E8'; // brand blue, same as the portfolio chart

const RANGES: { id: ChartRange; label: string; words: string }[] = [
  { id: 'live', label: 'Live', words: 'in the last hour' },
  { id: '1', label: '24H', words: 'in the last 24 hours' },
  { id: '7', label: '7D', words: 'in the last 7 days' },
  { id: '30', label: '30D', words: 'in the last 30 days' },
];

/** Y-axis labels for prices: whole dollars for big numbers, more decimals for small ones. */
function gridPrice(n: number, span: number): string {
  const digits = n >= 1000 ? (span < 5 ? 2 : 0) : n >= 1 ? (span < 0.05 ? 4 : 2) : n >= 0.01 ? 5 : 6;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function ChangePill({ change }: { change: number }) {
  const up = change >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
      {up ? '▲' : '▼'} {up ? '+' : '−'}{Math.abs(change).toFixed(2)}%
    </span>
  );
}

/** "/tokens" = list, "/tokens/usdc" = that token. */
export default function Tokens({ path }: { path: string }) {
  const slug = path.startsWith('/tokens/') ? decodeURIComponent(path.slice('/tokens/'.length)).split(/[/?]/)[0] : '';
  const market = useMarket();
  const { account, isConnected, isWrongNetwork } = useWallet();
  const { chain } = useChain();
  const evm = chain.family === 'evm';
  const ready = isConnected && !isWrongNetwork && evm;
  const { balances, loading: balancesLoading, refresh } = useBalances(account, ready);
  const token = slug ? findExploreToken(slug) : undefined;
  const sparks = useSparklines();

  // Rank by 24h trading volume once, when the first full set of prices arrives (so rows do not jump around).
  const [order, setOrder] = useState<string[] | null>(null);
  useEffect(() => {
    if (order !== null || EXPLORE_TOKENS.some((t) => !market.quotes[t.slug])) return;
    setOrder([...EXPLORE_TOKENS].sort((a, b) => (market.quotes[b.slug]?.volume ?? 0) - (market.quotes[a.slug]?.volume ?? 0)).map((t) => t.slug));
  }, [market.quotes, order]);
  const ranked = useMemo(() => (order ? order.map((sl) => findExploreToken(sl)!) : EXPLORE_TOKENS), [order]);

  return (
    <div id="top">
      <Navbar />
      {/* The card widget only shows on the token list, not on a single token's page. */}
      {!token && <PriceTicker tokens={ranked} quotes={market.quotes} sparks={sparks} loading={market.loading} error={market.error} />}
      <main className={`mx-auto max-w-6xl px-4 pb-16 sm:px-6 ${token ? 'pt-10' : 'pt-4'}`}>
        {token ? (
          <TokenDetail
            key={token.slug}
            token={token}
            quote={market.quotes[token.slug]}
            marketLoading={market.loading}
            balances={balances}
            balancesLoading={balancesLoading}
            refreshBalances={refresh}
            evm={evm}
          />
        ) : (
          <>
            {slug && (
              <p role="alert" className="mb-6 rounded-2xl border border-horizon/30 bg-horizon/5 p-3.5 text-sm text-slate-700">
                We could not find a token called “{slug}”. Pick one from the list below.
              </p>
            )}
            <TokenList tokens={ranked} market={market} sparks={sparks} />
          </>
        )}
      </main>
    </div>
  );
}

/* ─────────────────────────────── LIST ─────────────────────────────── */

const ROW = 'grid grid-cols-[1.25rem_minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(0,0.95fr)] items-center gap-x-2 md:gap-x-3 md:grid-cols-[1.75rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)]';

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-300">—</span>;
  const flat = Math.abs(value) < 0.005;
  return (
    <span className={`text-sm font-semibold tabular-nums ${flat ? 'text-slate-500' : value > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
      {flat ? '' : value > 0 ? '▲ ' : '▼ '}{Math.abs(value).toFixed(2)}%
    </span>
  );
}

function TokenList({ tokens, market, sparks }: { tokens: ExploreToken[]; market: ReturnType<typeof useMarket>; sparks: Record<string, number[]> }) {
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tokens</h1>
        <p className="mt-2 text-sm text-slate-500 sm:text-base">Top 10 by 24h trading volume. Tap a token to see your balance, its live chart and swap it.</p>
      </div>

      <section className="glass mt-6 overflow-hidden rounded-3xl" aria-label="Top 10 tokens">
        <div className={`${ROW} border-b border-blue-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-6`}>
          <span>#</span>
          <span>Token</span>
          <span>Price</span>
          <span className="hidden text-right md:block">1H</span>
          <span className="text-right">1D</span>
          <span className="hidden text-right md:block">Volume</span>
          <span className="hidden text-right md:block">1D chart</span>
        </div>

        {market.error && (
          <div role="alert" className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">{market.error}</p>
            <button type="button" className="btn-ghost" onClick={market.retry}>Try again</button>
          </div>
        )}

        <ul className="divide-y divide-blue-100">
          {tokens.map((t, i) => {
            const q = market.quotes[t.slug];
            return (
              <li key={t.slug}>
                <Link to={`/tokens/${t.slug}`} className={`${ROW} px-4 py-3.5 transition hover:bg-blue-50/70 focus-ring sm:px-6`} aria-label={`${t.name} (${t.symbol})`}>
                  <span className="text-sm tabular-nums text-slate-500">{i + 1}</span>
                  <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <TokenLogo token={t.logo} symbol={t.symbol} name={t.name} size={32} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-cloud">{t.name}</span>
                      <span className="block text-sm text-slate-500">{t.symbol}</span>
                    </span>
                  </span>
                  <span className="truncate font-display text-sm font-semibold tabular-nums sm:text-base">{q ? formatPrice(q.price) : <span className="text-slate-300">{market.loading ? '…' : '—'}</span>}</span>
                  <span className="hidden text-right md:block"><Change value={q ? change1h(sparks[t.slug], q.price) : null} /></span>
                  <span className="text-right"><Change value={q ? q.change : null} /></span>
                  <span className="hidden text-right text-sm tabular-nums text-slate-600 md:block">{q ? formatCompactUsd(q.volume) : '—'}</span>
                  <span className="hidden justify-end md:flex"><Sparkline values={sparks[t.slug]} className="h-8 w-28" /></span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/* ────────────────────────────── DETAIL ────────────────────────────── */

function TokenDetail({ token, quote, marketLoading, balances, balancesLoading, refreshBalances, evm }: {
  token: ExploreToken;
  quote: Quote | null | undefined;
  marketLoading: boolean;
  balances: Record<string, bigint>;
  balancesLoading: boolean;
  refreshBalances: () => Promise<void>;
  evm: boolean;
}) {
  const { chain } = useChain();
  const [range, setRange] = useState<ChartRange>('live');
  const { points, loading: chartLoading, error: chartError } = useTokenChart(token, range, quote?.price ?? null);

  const start = points[0]?.v ?? 0;
  const end = points[points.length - 1]?.v ?? 0;
  const change = points.length > 1 ? end - start : 0;
  const changePct = start > 0 ? (change / start) * 100 : 0;
  const up = change >= 0;
  const rangeWords = RANGES.find((r) => r.id === range)!.words;

  return (
    <>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm font-medium">
        <Link to="/tokens" className="rounded-lg px-1.5 py-0.5 text-slate-600 transition hover:bg-blue-50 hover:text-cloud focus-ring">Tokens</Link>
        <span className="text-slate-400" aria-hidden>/</span>
        <span className="text-cloud" aria-current="page">{token.symbol}</span>
      </nav>

      <div className="mt-4 flex items-center gap-3">
        <TokenLogo token={token.logo} symbol={token.symbol} name={token.name} size={48} />
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{token.name}</h1>
          <p className="text-sm text-slate-500">{token.symbol}</p>
        </div>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* LEFT: balance + chart + stats */}
        <div className="min-w-0 space-y-6">
          <BalanceCard token={token} quote={quote} balances={balances} loading={balancesLoading} />

          <section className="glass overflow-hidden rounded-2xl" aria-label={`${token.symbol} price chart`}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
              <div aria-live="polite">
                <p className="font-display text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">
                  {quote ? formatPrice(quote.price) : <span className="text-slate-300">{marketLoading ? 'Loading…' : '—'}</span>}
                </p>
                {points.length > 1 ? (
                  <p className="mt-2 text-sm">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                      {up ? '▲' : '▼'} {up ? '+' : '−'}{Math.abs(changePct).toFixed(2)}%
                    </span>{' '}
                    <span className="text-slate-500">{rangeWords}</span>
                  </p>
                ) : quote ? (
                  <p className="mt-2"><ChangePill change={quote.change} /> <span className="text-sm text-slate-500">24h</span></p>
                ) : null}
              </div>
              <div role="radiogroup" aria-label="Time range" className="inline-flex max-w-full overflow-x-auto rounded-xl border border-blue-100 bg-panel p-1">
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    role="radio"
                    aria-checked={range === r.id}
                    onClick={() => setRange(r.id)}
                    className={`shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition focus-ring sm:px-3 ${range === r.id ? 'bg-horizon text-white' : 'text-slate-500 hover:bg-blue-50 hover:text-cloud'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-5 pt-3 sm:p-6 sm:pt-3">
              <div className={`transition-opacity ${chartLoading && points.length ? 'opacity-60' : ''}`}>
                {chartError && !points.length ? (
                  <Empty text={chartError} />
                ) : points.length < 2 ? (
                  <Empty text="Loading live price chart…" />
                ) : (
                  <ValueChart points={points} color={LINE} range={range} start={start} fmt={formatPrice} gridFmt={gridPrice} />
                )}
              </div>
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Updates live
              </p>
            </div>
          </section>

          <dl className="glass grid grid-cols-3 divide-x divide-blue-100 rounded-2xl text-center" aria-label="24 hour stats">
            <Stat label="24h high" value={quote ? formatPrice(quote.high) : '—'} />
            <Stat label="24h low" value={quote ? formatPrice(quote.low) : '—'} />
            <Stat label="24h volume" value={quote ? formatCompactUsd(quote.volume) : '—'} />
          </dl>
        </div>

        {/* RIGHT: the same swap box as the home page */}
        <div className="min-w-0">
          {!evm ? (
            chain.family === 'bitcoin' ? <BitcoinSwapCard key={token.slug} initialFromSymbol={token.symbol} /> : chain.family === 'solana' ? <SolanaSwapCard key={token.slug} initialFromSymbol={token.symbol} /> : <ChainComingSoon chain={chain} />
          ) : (
            <>
              <SwapCard key={token.slug} initialFromId={token.tokenId} onSwapped={() => void refreshBalances()} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-1.5 py-4 sm:px-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{label}</dt>
      <dd className="mt-1 break-words font-display text-sm font-semibold tabular-nums sm:text-lg">{value}</dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-blue-100 px-6 text-center text-sm text-slate-500">{text}</div>;
}

const CARD_BTN = 'rounded-xl bg-white px-4 py-2 font-display text-sm font-semibold text-horizon transition hover:bg-white/90 disabled:opacity-70 focus-ring';

/** Solana "Connect Wallet" button: lists the detected Solana wallets (same choices as the navbar button). */
function SolanaConnectButton() {
  const { wallets, connecting, connect } = useSolana();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const detected = new Set(wallets.map((w) => w.name.toLowerCase()));
  const missing = SOLANA_RECOMMENDED.filter((r) => !detected.has(r.name.toLowerCase()));
  return (
    <div className="relative" ref={ref}>
      <button type="button" className={CARD_BTN} disabled={connecting} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {connecting ? 'Check your wallet…' : 'Connect Wallet'}
      </button>
      {open && (
        <div role="menu" className="glass absolute right-0 top-12 z-50 w-[min(86vw,18rem)] max-h-72 overflow-y-auto rounded-2xl p-2 text-sm text-cloud">
          <p className="px-2.5 pb-1 pt-1 text-xs uppercase tracking-wider text-slate-500">Solana wallets</p>
          {wallets.map((w) => (
            <button key={w.id} type="button" disabled={connecting} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-blue-50 disabled:opacity-60 focus-ring" onClick={() => { setOpen(false); void connect(w); }}>
              {w.icon ? <img src={w.icon} alt="" width={28} height={28} className="h-7 w-7 rounded-lg" /> : <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100/70">👛</span>}
              <span className="font-medium">{w.name}</span>
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

/**
 * "Your balance" card: how much of this token the connected wallet holds.
 * Works for EVERY token in the Explore list and follows the selected network:
 * Ethereum (EVM wallet), Solana (Solana wallet) or Bitcoin (Bitcoin wallet).
 * Not connected -> a Connect Wallet button for that network. Connected -> the balance (0 if the wallet holds none).
 */
function BalanceCard({ token, quote, balances, loading }: { token: ExploreToken; quote: Quote | null | undefined; balances: Record<string, bigint>; loading: boolean }) {
  const { chain } = useChain();
  const { isConnected, isConnecting, isWrongNetwork, connect, switchNetwork, activeBitcoin, connectFamily, connectingFamily } = useWallet();
  const sol = useSolana();
  const family = chain.family;

  // Bitcoin balance (only BTC itself has one on this network)
  const [btcBal, setBtcBal] = useState<number | null>(null);
  useEffect(() => {
    if (family !== 'bitcoin' || !activeBitcoin || token.symbol !== 'BTC') { setBtcBal(null); return; }
    const ctrl = new AbortController();
    void fetchBtcBalance(activeBitcoin, ctrl.signal).then((b) => { if (!ctrl.signal.aborted) setBtcBal(b); });
    return () => ctrl.abort();
  }, [family, activeBitcoin, token.symbol]);

  const own = token.tokenId ? getToken(token.tokenId) : null;
  const evmBal = own ? balances[own.id] : undefined;

  const connected = family === 'evm' ? isConnected : family === 'solana' ? !!sol.address : family === 'bitcoin' ? !!activeBitcoin : false;

  let main: ReactNode;
  let sub: ReactNode = ' ';
  let action: ReactNode = null;

  if (!connected) {
    main = '—';
    sub = 'Connect your wallet to see your balance';
    if (family === 'solana') action = <SolanaConnectButton />;
    else if (family === 'bitcoin') action = <button type="button" onClick={() => void connectFamily('bitcoin')} disabled={connectingFamily === 'bitcoin'} className={CARD_BTN}>{connectingFamily === 'bitcoin' ? 'Check your wallet…' : 'Connect Wallet'}</button>;
    else if (family === 'evm') action = <button type="button" onClick={() => void connect()} disabled={isConnecting} className={CARD_BTN}>{isConnecting ? 'Check your wallet…' : 'Connect Wallet'}</button>;
    else sub = `${chain.name} wallets are not supported yet`;
  } else if (family === 'evm') {
    if (isWrongNetwork) {
      main = '—';
      sub = `Switch to ${ACTIVE_CHAIN.name} to see your balance`;
      action = <button type="button" onClick={() => void switchNetwork()} className={CARD_BTN}>Switch Network</button>;
    } else if (!own || !isTokenConfigured(own)) {
      main = `0 ${token.symbol}`; // this token does not exist on the test network
    } else if (evmBal === undefined) {
      main = loading ? 'Loading…' : '—';
    } else {
      const usd = quote ? Number(formatUnits(evmBal, own.decimals)) * quote.price : null;
      main = `${formatAmount(evmBal, own.decimals, 6)} ${own.symbol}`;
      sub = usd !== null ? `≈ ${formatUsd(usd)}${own.id === 'TBTC' ? ' (test token, valued at the real BTC price)' : ''}` : ' ';
    }
  } else if (family === 'solana') {
    const portfolio = sol.portfolio;
    if (!portfolio) {
      main = sol.loading ? 'Loading…' : '—';
    } else {
      const raw = token.symbol === 'SOL' ? portfolio.sol : portfolio.tokens.find((t) => t.symbol === token.symbol)?.amount ?? 0n;
      const decimals = token.symbol === 'SOL' ? SOL_DECIMALS : portfolio.tokens.find((t) => t.symbol === token.symbol)?.decimals ?? 6;
      main = `${formatAmount(raw, decimals, 6)} ${token.symbol}`;
      const usd = quote ? Number(formatUnits(raw, decimals)) * quote.price : null;
      sub = raw > 0n && usd !== null ? `≈ ${formatUsd(usd)}` : ' ';
    }
  } else {
    // Bitcoin network
    if (token.symbol === 'BTC') {
      main = btcBal === null ? 'Loading…' : `${btcBal.toLocaleString('en-US', { maximumFractionDigits: 6 })} BTC`;
      sub = btcBal !== null && quote ? `≈ ${formatUsd(btcBal * quote.price)}` : ' ';
    } else {
      main = `0 ${token.symbol}`;
    }
  }

  return (
    <section aria-label={`Your ${token.symbol} balance`} className="rounded-2xl bg-gradient-to-br from-horizon to-altitude p-5 text-white shadow-lg shadow-blue-600/25">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">Your balance</p>
          <p className="mt-1 break-all font-display text-3xl font-bold tabular-nums sm:text-4xl">{main}</p>
          <p className="mt-1 text-sm tabular-nums text-white/85">{sub}</p>
        </div>
        {action}
      </div>
    </section>
  );
}
