import { useEffect, useMemo, useRef, useState } from 'react';
import Logo from '../components/Logo';
import Navbar from '../components/Navbar';
import LiquidityPairLogo, { type PairToken } from '../components/LiquidityPairLogo';
import type { TokenRef } from '../lib/tokenLogos';
import { useWallet } from '../hooks/useWallet';

/* ──────────────────────────────────────────────────────────────────────────
 *  Liquidity page: pool overview + all pools across EVM and non-EVM chains.
 *  NOTE: pool numbers below are DEMO data. Replace POOLS with a real indexer /
 *  subgraph / DEX API per chain (Minswap for Cardano, Uniswap V2 for EVM, ...).
 *  Values are stored in each pool's own quote currency (₳ for Cardano, $ for others).
 * ────────────────────────────────────────────────────────────────────────── */

type ChainId = 'evm' | 'solana' | 'cardano';

const CHAIN_META: Record<ChainId, { label: string; badge: string; family: 'EVM' | 'Non-EVM'; symbol: string; usdRate: number; badgeClass: string }> = {
  evm: { label: 'Ethereum', badge: 'ETH', family: 'EVM', symbol: '$', usdRate: 1, badgeClass: 'bg-altitude/15 text-altitude' },
  solana: { label: 'Solana', badge: 'SOL', family: 'Non-EVM', symbol: '$', usdRate: 1, badgeClass: 'bg-emerald-400/15 text-emerald-600' },
  cardano: { label: 'Cardano', badge: 'ADA', family: 'Non-EVM', symbol: '₳', usdRate: 0.45, badgeClass: 'bg-horizon/15 text-horizon' }, // demo ADA→USD rate
};

/** One side of a pool. `token` is the NETWORK-SPECIFIC identity used to look up the logo (never the symbol).
 *  When your pool API returns token ids / logo URLs, map them into this shape (see tokenFrom* helpers). */
interface PoolToken { s: string; name?: string; token: TokenRef; logoURI?: string | null }

interface Pool {
  id: string;
  a: PoolToken;
  b: PoolToken;
  chain: ChainId;
  version: string;
  fee: string;
  address: string;
  tvl: number; vol24: number; vol7: number; fee24: number; fee7: number; apr: number;
}

// Token helpers: build a PoolToken from each chain's own identifier format.
const evmTok = (s: string, name: string, address: string | null, chainId = 1): PoolToken => ({ s, name, token: { family: 'evm', chainId, address } });
const solTok = (s: string, name: string, mint: string | null): PoolToken => ({ s, name, token: { family: 'solana', mint } });
// Cardano native assets need policyId + asset-name hex. An empty policyId = "not known yet" → neutral fallback icon.
const adaTok = (s: string, name: string, policyId: string | null = '', assetNameHex = ''): PoolToken => ({ s, name, token: { family: 'cardano', policyId, assetNameHex } });

const ADA = adaTok('ADA', 'Cardano', null);
const SNEK = adaTok('SNEK', 'Snek', '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f', '534e454b');
const HOSKY = adaTok('HOSKY', 'Hosky', 'a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235', '484f534b59');
const NIGHT = adaTok('NIGHT', 'Night'); // TODO: fill policyId + assetNameHex from the pool API
const ASCEND = adaTok('ASCEND', 'Ascend'); // TODO
const USDCX = adaTok('USDCx', 'USDCx'); // TODO

const ETH = evmTok('ETH', 'Ether', null);
const WETH = evmTok('WETH', 'Wrapped Ether', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
const USDC = evmTok('USDC', 'USD Coin', '0xA0b86991c6218b36c1d19D4a2E9Eb0cE3606eB48');
const DAI = evmTok('DAI', 'Dai Stablecoin', '0x6B175474E89094C44Da98b954EedeAC495271d0F');
const WBTC = evmTok('WBTC', 'Wrapped BTC', '0x2260FAC5E5542a773Aa44fBfeDf7C193bc2C599');

const SOL = solTok('SOL', 'Solana', null);
const SOL_USDC = solTok('USDC', 'USD Coin', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const JUP = solTok('JUP', 'Jupiter', 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN');
const BONK = solTok('BONK', 'Bonk', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');

const POOLS: Pool[] = [
  { id: 'night-ada', a: NIGHT, b: ADA, chain: 'cardano', version: 'V2', fee: '0.3%', address: 'f5808c...713169', tvl: 7.49e6, vol24: 1.81e6, vol7: 17.42e6, fee24: 5.43e3, fee7: 52.25e3, apr: 36.49 },
  { id: 'snek-ada', a: SNEK, b: ADA, chain: 'cardano', version: 'V2', fee: '1%', address: '279c90...a31b02', tvl: 4.54e6, vol24: 209.16e3, vol7: 2.84e6, fee24: 2.09e3, fee7: 28.43e3, apr: 33.14 },
  { id: 'hosky-ada', a: HOSKY, b: ADA, chain: 'cardano', version: 'V2', fee: '0.5%', address: 'a0028f...c4e7d1', tvl: 882.16e3, vol24: 188.21e3, vol7: 1.14e6, fee24: 941.05, fee7: 5.72e3, apr: 33.07 },
  { id: 'ascend-ada', a: ASCEND, b: ADA, chain: 'cardano', version: 'V2', fee: '1%', address: '5d1e04...90bb3a', tvl: 2.14e6, vol24: 108.29e3, vol7: 954.23e3, fee24: 1.08e3, fee7: 9.54e3, apr: 22.96 },
  { id: 'night-usdcx', a: NIGHT, b: USDCX, chain: 'cardano', version: 'V2', fee: '0.3%', address: 'b7721c...0fa8e5', tvl: 1.04e6, vol24: 96.21e3, vol7: 2.11e6, fee24: 288.62, fee7: 6.34e3, apr: 31.88 },
  { id: 'eth-usdc', a: ETH, b: USDC, chain: 'evm', version: 'V2', fee: '0.3%', address: '0x88e6...5f64', tvl: 12.8e6, vol24: 3.2e6, vol7: 21.5e6, fee24: 9.6e3, fee7: 64.5e3, apr: 27.4 },
  { id: 'weth-dai', a: WETH, b: DAI, chain: 'evm', version: 'V2', fee: '0.3%', address: '0xa478...c9d1', tvl: 3.66e6, vol24: 702.4e3, vol7: 5.1e6, fee24: 2.1e3, fee7: 15.3e3, apr: 20.9 },
  { id: 'wbtc-eth', a: WBTC, b: ETH, chain: 'evm', version: 'V2', fee: '0.3%', address: '0x3f01...b72e', tvl: 1.9e6, vol24: 241.7e3, vol7: 1.7e6, fee24: 725.1, fee7: 5.1e3, apr: 13.9 },
  { id: 'usdc-dai', a: USDC, b: DAI, chain: 'evm', version: 'V2', fee: '0.05%', address: '0xae46...01ab', tvl: 6.2e6, vol24: 2.4e6, vol7: 15.9e6, fee24: 1.2e3, fee7: 7.9e3, apr: 7.1 },
  { id: 'sol-usdc', a: SOL, b: SOL_USDC, chain: 'solana', version: 'CLMM', fee: '0.25%', address: '58oQCh...mWzp', tvl: 18.4e6, vol24: 9.6e6, vol7: 61.3e6, fee24: 24.0e3, fee7: 153.2e3, apr: 47.6 },
  { id: 'jup-sol', a: JUP, b: SOL, chain: 'solana', version: 'CLMM', fee: '0.3%', address: 'C1MgLo...Aq3d', tvl: 2.7e6, vol24: 840.2e3, vol7: 5.3e6, fee24: 2.5e3, fee7: 15.9e3, apr: 33.8 },
  { id: 'bonk-sol', a: BONK, b: SOL, chain: 'solana', version: 'V2', fee: '1%', address: 'Hs97TA...kD1r', tvl: 1.35e6, vol24: 455.9e3, vol7: 2.9e6, fee24: 4.6e3, fee7: 29.0e3, apr: 52.2 },
];

const toPair = (t: PoolToken): PairToken => ({ symbol: t.s, name: t.name, token: t.token, logoURI: t.logoURI });

const usd = (p: Pool, v: number) => v * CHAIN_META[p.chain].usdRate;

function compact(n: number): string {
  const abs = Math.abs(n);
  const f = (v: number, u: string) => `${v.toFixed(2)}${u}`;
  if (abs >= 1e9) return f(n / 1e9, 'B');
  if (abs >= 1e6) return f(n / 1e6, 'M');
  if (abs >= 1e3) return f(n / 1e3, 'K');
  return n.toFixed(2);
}
const money = (p: Pool, v: number) => `${compact(v)} ${CHAIN_META[p.chain].symbol}`;

/* ── overview chart ─────────────────────────────────────────────────────── */
type Range = '1D' | '1W' | '1M' | '6M' | '1Y';
type Metric = 'volume' | 'fees' | 'tvl';
const RANGES: Record<Range, { bars: number; stepMs: number; days: number }> = {
  '1D': { bars: 24, stepMs: 3_600_000, days: 1 },
  '1W': { bars: 28, stepMs: 6 * 3_600_000, days: 7 },
  '1M': { bars: 30, stepMs: 86_400_000, days: 30 },
  '6M': { bars: 26, stepMs: 7 * 86_400_000, days: 182 },
  '1Y': { bars: 24, stepMs: 15 * 86_400_000, days: 365 },
};

function seeded(seed: number) {
  let x = seed;
  return () => ((x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

function buildSeries(metric: Metric, range: Range, total: number) {
  const { bars, stepMs } = RANGES[range];
  const rnd = seeded(metric.length * 977 + range.length * 131 + bars);
  const raw = Array.from({ length: bars }, () => 0.25 + rnd() * 0.75);
  raw[bars - 1] = 0.02; // current period has barely started
  const sum = raw.reduce((a, b) => a + b, 0);
  const now = Date.now();
  return raw.map((r, i) => ({ value: metric === 'tvl' ? total * (0.9 + r * 0.1) : (r / sum) * total, t: now - (bars - 1 - i) * stepMs }));
}

function fmtDate(t: number, range: Range) {
  const d = new Date(t);
  if (range === '1D') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (range === '6M' || range === '1Y') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const METRICS: { id: Metric; label: string }[] = [
  { id: 'volume', label: 'Trading volume' },
  { id: 'fees', label: 'Fee generated' },
  { id: 'tvl', label: 'Total value locked' },
];

/* ── small UI bits ──────────────────────────────────────────────────────── */
const FAV_KEY = 'pilotswap:fav-pools';
function loadFavs(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]') as string[]; } catch { return []; }
}

type SortKey = 'tvl' | 'vol24' | 'vol7' | 'fee24' | 'fee7' | 'apr';
const COLS: { key: SortKey; label: string }[] = [
  { key: 'tvl', label: 'TVL' }, { key: 'vol24', label: '24H Vol' }, { key: 'vol7', label: '7D Vol' },
  { key: 'fee24', label: '24H Fee' }, { key: 'fee7', label: '7D Fee' }, { key: 'apr', label: 'APR' },
];

export default function Liquidity() {
  const { isConnected, connect, isConnecting } = useWallet();
  const [range, setRange] = useState<Range>('1W');
  const [metric, setMetric] = useState<Metric>('volume');
  const [hover, setHover] = useState<number | null>(null);

  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [chainFilter, setChainFilter] = useState<'all' | 'EVM' | 'Non-EVM' | ChainId>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'tvl', dir: 'desc' });
  const [favs, setFavs] = useState<string[]>(loadFavs);
  const [copied, setCopied] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => !filterRef.current?.contains(e.target as Node) && setFilterOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggleFav = (id: string) => {
    setFavs((f) => {
      const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
      try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  };

  // Totals in USD across all chains (demo). 1W stats use 7D numbers; others scale from 24H.
  const totals = useMemo(() => {
    const days = RANGES[range].days;
    const sum = (f: (p: Pool) => number) => POOLS.reduce((a, p) => a + usd(p, f(p)), 0);
    const scale = (v24: number, v7: number) => (days === 1 ? v24 : days === 7 ? v7 : (v7 / 7) * days);
    return {
      volume: scale(sum((p) => p.vol24), sum((p) => p.vol7)),
      fees: scale(sum((p) => p.fee24), sum((p) => p.fee7)),
      tvl: sum((p) => p.tvl),
    };
  }, [range]);

  const series = useMemo(() => buildSeries(metric, range, totals[metric]), [metric, range, totals]);
  const maxV = Math.max(...series.map((d) => d.value));
  const shown = hover !== null ? series[hover] : series[series.length - 1];
  const prev = hover !== null ? series[Math.max(0, hover - 1)] : series[series.length - 2];
  const change = prev && prev.value > 0 ? ((shown.value - prev.value) / prev.value) * 100 : 0;
  const labelEvery = Math.ceil(series.length / 7);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = POOLS.filter((p) => {
      if (tab === 'mine') return false; // no positions until real data is wired
      const meta = CHAIN_META[p.chain];
      if (chainFilter !== 'all' && chainFilter !== meta.family && chainFilter !== p.chain) return false;
      return !q || `${p.a.s}-${p.b.s}`.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) || meta.label.toLowerCase().includes(q);
    });
    return list.sort((x, y) => {
      const d = usd(x, x[sort.key] as number) - usd(y, y[sort.key] as number);
      const v = sort.key === 'apr' ? x.apr - y.apr : d;
      return sort.dir === 'asc' ? v : -v;
    });
  }, [tab, query, chainFilter, sort]);

  const copy = (addr: string) => {
    void navigator.clipboard?.writeText(addr);
    setCopied(addr);
    window.setTimeout(() => setCopied((c) => (c === addr ? null : c)), 1200);
  };

  const filterOptions: { id: typeof chainFilter; label: string }[] = [
    { id: 'all', label: 'All chains' }, { id: 'EVM', label: 'EVM only' }, { id: 'Non-EVM', label: 'Non-EVM only' },
    { id: 'evm', label: 'Ethereum' }, { id: 'solana', label: 'Solana' }, { id: 'cardano', label: 'Cardano' },
  ];

  return (
    <div id="top">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
        <header>
          <h1 className="text-4xl font-bold tracking-tight">Liquidity</h1>
          <p className="mt-1 text-slate-500">Earn yield from pools across EVM and non-EVM chains</p>
        </header>

        {/* OVERVIEW */}
        <section className="glass mt-8 rounded-3xl p-5 sm:p-8" aria-label="Overview">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Pool Overview</h2>
            <div className="flex gap-1" role="tablist" aria-label="Time range">
              {(Object.keys(RANGES) as Range[]).map((r) => (
                <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)}
                  className={`rounded-xl px-3.5 py-1.5 text-sm font-medium transition focus-ring ${range === r ? 'bg-blue-100/80 text-cloud' : 'text-slate-500 hover:bg-blue-50'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {/* metric cards */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-dashed border-blue-100 p-2">
              {METRICS.map((m) => (
                <button key={m.id} onClick={() => { setMetric(m.id); setHover(null); }} aria-pressed={metric === m.id}
                  className={`flex min-h-[10rem] flex-col justify-between rounded-2xl p-3 text-left transition focus-ring sm:p-4 ${metric === m.id ? 'bg-blue-50 ring-1 ring-blue-100' : 'hover:bg-blue-50/60'}`}>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${metric === m.id ? 'bg-horizon text-white' : 'bg-blue-100/70 text-slate-500'}`}>
                    {m.id === 'volume' ? '▮▮' : m.id === 'fees' ? '●' : '$'}
                  </span>
                  <span>
                    <span className="block text-xs text-slate-500 sm:text-sm">{m.label}</span>
                    <span className="mt-1 block font-display text-base font-semibold tabular-nums sm:text-xl">${compact(totals[m.id])}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* chart */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-2 font-display font-medium"><span className="h-5 w-1.5 rounded-full bg-horizon/60" />{METRICS.find((m) => m.id === metric)?.label}</p>
                <div className="text-right">
                  <p className="font-display text-xl font-semibold tabular-nums">${compact(shown.value)}</p>
                  <p className="text-xs text-slate-500">
                    {fmtDate(shown.t, range)}{' '}
                    <span className={change >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%</span>
                  </p>
                </div>
              </div>
              <div className="mt-4 flex h-40 items-end gap-[3px]" onMouseLeave={() => setHover(null)} role="img" aria-label="Bar chart">
                {series.map((d, i) => (
                  <div key={i} onMouseEnter={() => setHover(i)} className="flex h-full flex-1 items-end">
                    <div className={`w-full rounded-full transition-colors ${hover === i ? 'bg-altitude' : 'bg-horizon/80'}`} style={{ height: `${Math.max(3, (d.value / maxV) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex text-[11px] text-slate-400">
                {series.map((d, i) => (
                  <span key={i} className="flex-1 overflow-visible whitespace-nowrap text-center">{i % labelEvery === 0 ? fmtDate(d.t, range) : ''}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* TOOLBAR */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full bg-blue-50 p-1" role="tablist" aria-label="Pools view">
            {([['all', 'All pools'], ['mine', 'My Positions']] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition focus-ring ${tab === id ? 'bg-white text-cloud shadow' : 'text-slate-500 hover:text-cloud'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {searchOpen && (
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pool, chain or address"
                className="w-48 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm outline-none focus:border-altitude/60 sm:w-64" />
            )}
            <button onClick={() => { setSearchOpen((o) => !o); if (searchOpen) setQuery(''); }} aria-label="Search pools"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-100 bg-white hover:bg-blue-50 focus-ring">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            </button>
            <div className="relative" ref={filterRef}>
              <button onClick={() => setFilterOpen((o) => !o)} aria-expanded={filterOpen} aria-haspopup="menu"
                className="flex h-10 items-center gap-2 rounded-full bg-horizon px-5 text-sm font-medium text-white hover:brightness-110 focus-ring">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M7 12h10M10 17h4" /></svg>
                Filter{chainFilter !== 'all' && <span className="h-2 w-2 rounded-full bg-white" />}
              </button>
              {filterOpen && (
                <div role="menu" className="glass absolute right-0 top-12 z-30 w-48 rounded-2xl p-2 text-sm">
                  {filterOptions.map((o) => (
                    <button key={o.id} role="menuitemradio" aria-checked={chainFilter === o.id} onClick={() => { setChainFilter(o.id); setFilterOpen(false); }}
                      className={`w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50 ${chainFilter === o.id ? 'bg-blue-100/70 font-medium' : ''}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
           
          </div>
        </div>

        {/* POOL TABLE */}
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[minmax(0,2.2fr)_repeat(6,minmax(0,1fr))] items-center rounded-2xl bg-blue-50 px-5 py-3 text-sm text-slate-500">
              <span>Name</span>
              {COLS.map((c) => (
                <button key={c.key} onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))}
                  className="text-right hover:text-cloud focus-ring" aria-label={`Sort by ${c.label}`}>
                  {c.label}{sort.key === c.key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
                </button>
              ))}
            </div>

            {rows.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                {tab === 'mine' ? (
                  isConnected ? (
                    <p>You have no liquidity positions yet.</p>
                  ) : (
                    <>
                      <p>Connect your wallet to see your positions.</p>
                      <button onClick={() => void connect()} disabled={isConnecting} className="mt-4 rounded-xl bg-horizon px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60 focus-ring">
                        {isConnecting ? 'Check your wallet…' : 'Connect Wallet'}
                      </button>
                    </>
                  )
                ) : <p>No pools match your search or filter.</p>}
              </div>
            ) : (
              <ul>
                {rows.map((p) => {
                  const meta = CHAIN_META[p.chain];
                  const fav = favs.includes(p.id);
                  return (
                    <li key={p.id} className="group grid grid-cols-[minmax(0,2.2fr)_repeat(6,minmax(0,1fr))] items-center border-b border-blue-100/70 px-5 py-4 text-sm transition last:border-0 hover:rounded-2xl hover:bg-blue-50/80">
                      <div className="flex min-w-0 items-center gap-3">
                        <button onClick={() => toggleFav(p.id)} aria-pressed={fav} aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
                          className={`text-lg leading-none focus-ring ${fav ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'}`}>{fav ? '★' : '☆'}</button>
                        <LiquidityPairLogo a={toPair(p.a)} b={toPair(p.b)} />
                        <div className="min-w-0">
                          <p className="truncate font-display font-semibold">{p.a.s}-{p.b.s}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="rounded-full bg-horizon px-2 py-0.5 font-semibold text-white">{p.version}</span>
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-horizon">{p.fee}</span>
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${meta.badgeClass}`}>{meta.badge}</span>
                            <button onClick={() => copy(p.address)} className="font-mono text-slate-500 hover:text-cloud focus-ring" title="Copy pool address">
                              {copied === p.address ? 'Copied' : p.address}
                            </button>
                          </div>
                        </div>
                      </div>
                      <span className="text-right font-medium tabular-nums">{money(p, p.tvl)}</span>
                      <span className="text-right font-medium tabular-nums">{money(p, p.vol24)}</span>
                      <span className="text-right font-medium tabular-nums">{money(p, p.vol7)}</span>
                      <span className="text-right font-medium tabular-nums">{money(p, p.fee24)}</span>
                      <span className="text-right font-medium tabular-nums">{money(p, p.fee7)}</span>
                      <span className="text-right font-medium tabular-nums">{p.apr.toFixed(2)}%</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">Demo data for layout. Cardano pools are shown in ₳, other chains in $. Overview totals are in USD.</p>
      </main>

      <footer className="border-t border-blue-100/70 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo />
          <p>Testnet software. Do not use real funds.</p>
        </div>
      </footer>
    </div>
  );
}
