
import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '../components/Navbar';
import LiquidityPairLogo, {
  type PairToken,
} from '../components/LiquidityPairLogo';
import type { TokenRef } from '../lib/tokenLogos';
import { useWallet } from '../hooks/useWallet';
import {
  AddLiquidityButton,
  AddLiquidityDrawer,
  WalletRequiredModal,
} from '../components/AddLiquidity';

// =====================================================
// TYPES
// =====================================================

type ChainId = 'evm' | 'solana' | 'cardano';

interface PoolToken {
  s: string;
  name?: string;
  token: TokenRef;
  logoURI?: string | null;
}

interface Pool {
  id: string;
  a: PoolToken;
  b: PoolToken;
  chain: ChainId;
  version: string;
  fee: string;
  address: string;
  tvl: number;
  vol24: number;
  vol7: number;
  fee24: number;
  fee7: number;
  apr: number;
}

const CHAIN_META: Record<
  ChainId,
  {
    label: string;
    badge: string;
    family: 'EVM' | 'Non-EVM';
    symbol: string;
    usdRate: number;
    badgeClass: string;
  }
> = {
  evm: {
    label: 'Ethereum',
    badge: 'ETH',
    family: 'EVM',
    symbol: '$',
    usdRate: 1,
    badgeClass: 'bg-altitude/15 text-altitude',
  },
  solana: {
    label: 'Solana',
    badge: 'SOL',
    family: 'Non-EVM',
    symbol: '$',
    usdRate: 1,
    badgeClass: 'bg-emerald-400/15 text-emerald-600',
  },
  cardano: {
    label: 'Cardano',
    badge: 'ADA',
    family: 'Non-EVM',
    symbol: '₳',
    usdRate: 0.45,
    badgeClass: 'bg-horizon/15 text-horizon',
  },
};

// =====================================================
// TOKEN HELPERS
// =====================================================

const evmTok = (
  s: string,
  name: string,
  address: string | null,
  chainId = 1
): PoolToken => ({
  s,
  name,
  token: { family: 'evm', chainId, address },
});

const solTok = (
  s: string,
  name: string,
  mint: string | null
): PoolToken => ({
  s,
  name,
  token: { family: 'solana', mint },
});

const adaTok = (
  s: string,
  name: string,
  policyId: string | null = '',
  assetNameHex = ''
): PoolToken => ({
  s,
  name,
  token: { family: 'cardano', policyId, assetNameHex },
});

// =====================================================
// TOKEN DEFINITIONS
// =====================================================

const ADA = adaTok('ADA', 'Cardano', null);

const SNEK = adaTok(
  'SNEK',
  'Snek',
  '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f',
  '534e454b'
);

const HOSKY = adaTok(
  'HOSKY',
  'Hosky',
  'a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235',
  '484f534b59'
);

const NIGHT = adaTok('NIGHT', 'Night');
const ASCEND = adaTok('ASCEND', 'Ascend');
const USDCX = adaTok('USDCx', 'USDCx');

const ETH = evmTok('ETH', 'Ether', null);

const WETH = evmTok(
  'WETH',
  'Wrapped Ether',
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
);

const USDC = evmTok(
  'USDC',
  'USD Coin',
  '0xA0b86991c6218b36c1d19D4a2E9Eb0cE3606eB48'
);

const DAI = evmTok(
  'DAI',
  'Dai Stablecoin',
  '0x6B175474E89094C44Da98b954EedeAC495271d0F'
);

const WBTC = evmTok(
  'WBTC',
  'Wrapped BTC',
  '0x2260FAC5E5542a773Aa44fBfeDf7C193bc2C599'
);

const SOL = solTok('SOL', 'Solana', null);

const SOL_USDC = solTok(
  'USDC',
  'USD Coin',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
);

const JUP = solTok(
  'JUP',
  'Jupiter',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'
);

const BONK = solTok(
  'BONK',
  'Bonk',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
);

// =====================================================
// EXISTING POOL DATA - UNCHANGED DEMO VALUES
// =====================================================

const POOLS: Pool[] = [
  {
    id: 'night-ada',
    a: NIGHT,
    b: ADA,
    chain: 'cardano',
    version: 'V2',
    fee: '0.3%',
    address: 'f5808c...713169',
    tvl: 7.49e6,
    vol24: 1.81e6,
    vol7: 17.42e6,
    fee24: 5.43e3,
    fee7: 52.25e3,
    apr: 36.49,
  },
  {
    id: 'snek-ada',
    a: SNEK,
    b: ADA,
    chain: 'cardano',
    version: 'V2',
    fee: '1%',
    address: '279c90...a31b02',
    tvl: 4.54e6,
    vol24: 209.16e3,
    vol7: 2.84e6,
    fee24: 2.09e3,
    fee7: 28.43e3,
    apr: 33.14,
  },
  {
    id: 'hosky-ada',
    a: HOSKY,
    b: ADA,
    chain: 'cardano',
    version: 'V2',
    fee: '0.5%',
    address: 'a0028f...c4e7d1',
    tvl: 882.16e3,
    vol24: 188.21e3,
    vol7: 1.14e6,
    fee24: 941.05,
    fee7: 5.72e3,
    apr: 33.07,
  },
  {
    id: 'ascend-ada',
    a: ASCEND,
    b: ADA,
    chain: 'cardano',
    version: 'V2',
    fee: '1%',
    address: '5d1e04...90bb3a',
    tvl: 2.14e6,
    vol24: 108.29e3,
    vol7: 954.23e3,
    fee24: 1.08e3,
    fee7: 9.54e3,
    apr: 22.96,
  },
  {
    id: 'night-usdcx',
    a: NIGHT,
    b: USDCX,
    chain: 'cardano',
    version: 'V2',
    fee: '0.3%',
    address: 'b7721c...0fa8e5',
    tvl: 1.04e6,
    vol24: 96.21e3,
    vol7: 2.11e6,
    fee24: 288.62,
    fee7: 6.34e3,
    apr: 31.88,
  },
  {
    id: 'eth-usdc',
    a: ETH,
    b: USDC,
    chain: 'evm',
    version: 'V2',
    fee: '0.3%',
    address: '0x88e6...5f64',
    tvl: 12.8e6,
    vol24: 3.2e6,
    vol7: 21.5e6,
    fee24: 9.6e3,
    fee7: 64.5e3,
    apr: 27.4,
  },
  {
    id: 'weth-dai',
    a: WETH,
    b: DAI,
    chain: 'evm',
    version: 'V2',
    fee: '0.3%',
    address: '0xa478...c9d1',
    tvl: 3.66e6,
    vol24: 702.4e3,
    vol7: 5.1e6,
    fee24: 2.1e3,
    fee7: 15.3e3,
    apr: 20.9,
  },
  {
    id: 'wbtc-eth',
    a: WBTC,
    b: ETH,
    chain: 'evm',
    version: 'V2',
    fee: '0.3%',
    address: '0x3f01...b72e',
    tvl: 1.9e6,
    vol24: 241.7e3,
    vol7: 1.7e6,
    fee24: 725.1,
    fee7: 5.1e3,
    apr: 13.9,
  },
  {
    id: 'usdc-dai',
    a: USDC,
    b: DAI,
    chain: 'evm',
    version: 'V2',
    fee: '0.05%',
    address: '0xae46...01ab',
    tvl: 6.2e6,
    vol24: 2.4e6,
    vol7: 15.9e6,
    fee24: 1.2e3,
    fee7: 7.9e3,
    apr: 7.1,
  },
  {
    id: 'sol-usdc',
    a: SOL,
    b: SOL_USDC,
    chain: 'solana',
    version: 'CLMM',
    fee: '0.25%',
    address: '58oQCh...mWzp',
    tvl: 18.4e6,
    vol24: 9.6e6,
    vol7: 61.3e6,
    fee24: 24.0e3,
    fee7: 153.2e3,
    apr: 47.6,
  },
  {
    id: 'jup-sol',
    a: JUP,
    b: SOL,
    chain: 'solana',
    version: 'CLMM',
    fee: '0.3%',
    address: 'C1MgLo...Aq3d',
    tvl: 2.7e6,
    vol24: 840.2e3,
    vol7: 5.3e6,
    fee24: 2.5e3,
    fee7: 15.9e3,
    apr: 33.8,
  },
  {
    id: 'bonk-sol',
    a: BONK,
    b: SOL,
    chain: 'solana',
    version: 'V2',
    fee: '1%',
    address: 'Hs97TA...kD1r',
    tvl: 1.35e6,
    vol24: 455.9e3,
    vol7: 2.9e6,
    fee24: 4.6e3,
    fee7: 29.0e3,
    apr: 52.2,
  },
];

// =====================================================
// HELPERS
// =====================================================

const toPair = (t: PoolToken): PairToken => ({
  symbol: t.s,
  name: t.name,
  token: t.token,
  logoURI: t.logoURI,
});

const usd = (p: Pool, v: number) =>
  v * CHAIN_META[p.chain].usdRate;

function compact(n: number): string {
  const abs = Math.abs(n);
  const format = (v: number, unit: string) =>
    `${v.toFixed(2)}${unit}`;

  if (abs >= 1e9) return format(n / 1e9, 'B');
  if (abs >= 1e6) return format(n / 1e6, 'M');
  if (abs >= 1e3) return format(n / 1e3, 'K');

  return n.toFixed(2);
}

const money = (p: Pool, v: number) =>
  `${compact(v)} ${CHAIN_META[p.chain].symbol}`;

type Range = '1D' | '1W' | '1M' | '6M' | '1Y';
type Metric = 'volume' | 'fees' | 'tvl';

const RANGES: Record<
  Range,
  { bars: number; stepMs: number; days: number }
> = {
  '1D': { bars: 24, stepMs: 3_600_000, days: 1 },
  '1W': { bars: 28, stepMs: 6 * 3_600_000, days: 7 },
  '1M': { bars: 30, stepMs: 86_400_000, days: 30 },
  '6M': { bars: 26, stepMs: 7 * 86_400_000, days: 182 },
  '1Y': { bars: 24, stepMs: 15 * 86_400_000, days: 365 },
};

function seeded(seed: number) {
  let x = seed;

  return () =>
    ((x = (x * 1664525 + 1013904223) % 4294967296) /
      4294967296);
}

function buildSeries(
  metric: Metric,
  range: Range,
  total: number
) {
  const { bars, stepMs } = RANGES[range];

  const rnd = seeded(
    metric.length * 977 + range.length * 131 + bars
  );

  const raw = Array.from(
    { length: bars },
    () => 0.25 + rnd() * 0.75
  );

  raw[bars - 1] = 0.02;

  const sum = raw.reduce((a, b) => a + b, 0);
  const now = Date.now();

  return raw.map((r, i) => ({
    value:
      metric === 'tvl'
        ? total * (0.9 + r * 0.1)
        : (r / sum) * total,
    t: now - (bars - 1 - i) * stepMs,
  }));
}

function fmtDate(t: number, range: Range) {
  const d = new Date(t);

  if (range === '1D') {
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  if (range === '6M' || range === '1Y') {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    });
  }

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const METRICS: { id: Metric; label: string }[] = [
  { id: 'volume', label: 'Trading volume' },
  { id: 'fees', label: 'Fee generated' },
  { id: 'tvl', label: 'Total value locked' },
];

const FAV_KEY = 'pilotswap:fav-pools';

function loadFavs(): string[] {
  try {
    return JSON.parse(
      localStorage.getItem(FAV_KEY) ?? '[]'
    ) as string[];
  } catch {
    return [];
  }
}

type SortKey =
  | 'tvl'
  | 'vol24'
  | 'vol7'
  | 'fee24'
  | 'fee7'
  | 'apr';

const COLS: { key: SortKey; label: string }[] = [
  { key: 'tvl', label: 'TVL' },
  { key: 'vol24', label: '24H Vol' },
  { key: 'vol7', label: '7D Vol' },
  { key: 'fee24', label: '24H Fee' },
  { key: 'fee7', label: '7D Fee' },
  { key: 'apr', label: 'APR' },
];

// =====================================================
// MAIN LIQUIDITY PAGE
// =====================================================

export default function Liquidity() {
  const {
    isConnected,
    connect,
    isConnecting,
    activeSolana,
    activeBitcoin,
  } = useWallet();

  const anyWalletConnected =
    isConnected || !!activeSolana || !!activeBitcoin;

  const [gateOpen, setGateOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const onAddLiquidity = () =>
    anyWalletConnected
      ? setDrawerOpen(true)
      : setGateOpen(true);

  const [range, setRange] = useState<Range>('1W');
  const [metric, setMetric] = useState<Metric>('volume');
  const [hover, setHover] = useState<number | null>(null);

  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [chainFilter, setChainFilter] = useState<
    'all' | 'EVM' | 'Non-EVM' | ChainId
  >('all');

  const [sort, setSort] = useState<{
    key: SortKey;
    dir: 'asc' | 'desc';
  }>({
    key: 'tvl',
    dir: 'desc',
  });

  const [favs, setFavs] = useState<string[]>(loadFavs);
  const [copied, setCopied] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!filterRef.current?.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', close);

    return () =>
      document.removeEventListener('mousedown', close);
  }, []);

  const toggleFav = (id: string) => {
    setFavs((current) => {
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];

      try {
        localStorage.setItem(
          FAV_KEY,
          JSON.stringify(next)
        );
      } catch {
        // Storage unavailable
      }

      return next;
    });
  };

  // Existing demo totals
  const totals = useMemo(() => {
    const days = RANGES[range].days;

    const sum = (f: (p: Pool) => number) =>
      POOLS.reduce((a, p) => a + usd(p, f(p)), 0);

    const scale = (v24: number, v7: number) =>
      days === 1
        ? v24
        : days === 7
        ? v7
        : (v7 / 7) * days;

    return {
      volume: scale(
        sum((p) => p.vol24),
        sum((p) => p.vol7)
      ),
      fees: scale(
        sum((p) => p.fee24),
        sum((p) => p.fee7)
      ),
      tvl: sum((p) => p.tvl),
    };
  }, [range]);

  const series = useMemo(
    () => buildSeries(metric, range, totals[metric]),
    [metric, range, totals]
  );

  const maxV = Math.max(...series.map((d) => d.value));

  const shown =
    hover !== null
      ? series[hover]
      : series[series.length - 1];

  const prev =
    hover !== null
      ? series[Math.max(0, hover - 1)]
      : series[series.length - 2];

  const change =
    prev && prev.value > 0
      ? ((shown.value - prev.value) / prev.value) * 100
      : 0;

  const labelEvery = Math.ceil(series.length / 7);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = POOLS.filter((p) => {
      if (tab === 'mine') return false;

      const meta = CHAIN_META[p.chain];

      if (
        chainFilter !== 'all' &&
        chainFilter !== meta.family &&
        chainFilter !== p.chain
      ) {
        return false;
      }

      return (
        !q ||
        `${p.a.s}-${p.b.s}`.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        meta.label.toLowerCase().includes(q)
      );
    });

    return list.sort((x, y) => {
      const d =
        usd(x, x[sort.key] as number) -
        usd(y, y[sort.key] as number);

      const v =
        sort.key === 'apr'
          ? x.apr - y.apr
          : d;

      return sort.dir === 'asc' ? v : -v;
    });
  }, [tab, query, chainFilter, sort]);

  const copy = (addr: string) => {
    void navigator.clipboard?.writeText(addr);

    setCopied(addr);

    window.setTimeout(() => {
      setCopied((c) => (c === addr ? null : c));
    }, 1200);
  };

  const filterOptions: {
    id: typeof chainFilter;
    label: string;
  }[] = [
    { id: 'all', label: 'All chains' },
    { id: 'EVM', label: 'EVM only' },
    { id: 'Non-EVM', label: 'Non-EVM only' },
    { id: 'evm', label: 'Ethereum' },
    { id: 'solana', label: 'Solana' },
    { id: 'cardano', label: 'Cardano' },
  ];

  return (
    <div
      id="top"
      className="w-full min-w-0 max-w-full"
    >
      <Navbar />

      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">

        {/* PAGE HEADER */}
        <header className="flex min-w-0 flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Liquidity
            </h1>

            <p className="mt-1 break-words text-slate-500">
              Earn yield from pools across EVM and non-EVM chains
            </p>
          </div>

          <AddLiquidityButton onClick={onAddLiquidity} />
        </header>

        {/* =================================================
            POOL OVERVIEW - RESPONSIVE
        ================================================= */}

        <section
          className="glass mt-8 w-full min-w-0 max-w-full rounded-3xl p-3 sm:p-8"
          aria-label="Overview"
        >
          {/* OVERVIEW HEADER */}
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">

            <h2 className="text-lg font-semibold">
              Pool Overview
            </h2>

            {/* TIME RANGE */}
            <div
              className="flex max-w-full flex-wrap gap-1"
              role="tablist"
              aria-label="Time range"
            >
              {(Object.keys(RANGES) as Range[]).map(
                (r) => (
                  <button
                    key={r}
                    type="button"
                    role="tab"
                    aria-selected={range === r}
                    onClick={() => {
                      setRange(r);
                      setHover(null);
                    }}
                    className={`rounded-xl px-3 py-1.5 text-sm font-medium transition focus-ring ${
                      range === r
                        ? 'bg-blue-100/80 text-cloud'
                        : 'text-slate-500 hover:bg-blue-50'
                    }`}
                  >
                    {r}
                  </button>
                )
              )}
            </div>
          </div>

          {/* OVERVIEW CONTENT */}
          <div
            className="
              mt-6
              grid
              w-full
              min-w-0
              grid-cols-1
              gap-6
              lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]
            "
          >

            {/* =============================================
                FIX 1 - THREE METRIC CARDS IN ONE ROW
            ============================================= */}

            <div
              className="
                grid
                w-full
                min-w-0
                grid-cols-3
                gap-1
                rounded-2xl
                border
                border-dashed
                border-blue-100
                p-1
                sm:gap-2
                sm:p-2
              "
            >
              {METRICS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMetric(m.id);
                    setHover(null);
                  }}
                  aria-pressed={metric === m.id}
                  className={`
                    flex
                    w-full
                    min-w-0
                    min-h-[7.5rem]
                    flex-col
                    items-start
                    justify-between
                    gap-3
                    overflow-hidden
                    rounded-xl
                    p-1.5
                    text-left
                    transition
                    focus-ring
                    sm:min-h-[10rem]
                    sm:rounded-2xl
                    sm:p-4
                    ${
                      metric === m.id
                        ? 'bg-blue-50 ring-1 ring-blue-100'
                        : 'hover:bg-blue-50/60'
                    }
                  `}
                >
                  {/* ICON */}
                  <span
                    className={`
                      flex
                      h-7
                      w-7
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      text-xs
                      font-bold
                      sm:h-9
                      sm:w-9
                      sm:text-sm
                      ${
                        metric === m.id
                          ? 'bg-horizon text-white'
                          : 'bg-blue-100/70 text-slate-500'
                      }
                    `}
                  >
                    {m.id === 'volume'
                      ? '▮▮'
                      : m.id === 'fees'
                      ? '●'
                      : '$'}
                  </span>

                  {/* LABEL AND VALUE */}
                  <span className="block w-full min-w-0">
                    <span className="block break-words text-[10px] leading-tight text-slate-500 sm:text-sm">
                      {m.label}
                    </span>

                    <span
                      className="
                        mt-1
                        block
                        whitespace-nowrap
                        font-display
                        text-[clamp(0.55rem,2.5vw,1.25rem)]
                        font-semibold
                        leading-tight
                        tracking-tight
                        tabular-nums
                      "
                    >
                      ${compact(totals[m.id])}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {/* =============================================
                OVERVIEW CHART
            ============================================= */}

            <div className="w-full min-w-0 max-w-full">

              {/* CHART HEADER */}
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2 break-words font-display font-medium">
                  <span className="h-5 w-1.5 shrink-0 rounded-full bg-horizon/60" />

                  {
                    METRICS.find(
                      (m) => m.id === metric
                    )?.label
                  }
                </p>

                <div className="min-w-0 text-right">
                  <p className="break-words font-display text-xl font-semibold tabular-nums">
                    ${compact(shown.value)}
                  </p>

                  <p className="text-xs text-slate-500">
                    {fmtDate(shown.t, range)}{' '}

                    <span
                      className={
                        change >= 0
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }
                    >
                      {change >= 0 ? '▲' : '▼'}{' '}
                      {Math.abs(change).toFixed(2)}%
                    </span>
                  </p>
                </div>
              </div>

              {/* CHART BARS */}
              <div
                className="mt-4 flex h-40 w-full min-w-0 items-end gap-[3px]"
                onMouseLeave={() => setHover(null)}
                role="img"
                aria-label="Bar chart"
              >
                {series.map((d, i) => (
                  <div
                    key={i}
                    onMouseEnter={() => setHover(i)}
                    className="flex h-full min-w-0 flex-1 items-end"
                  >
                    <div
                      className={`w-full rounded-full transition-colors ${
                        hover === i
                          ? 'bg-altitude'
                          : 'bg-horizon/80'
                      }`}
                      style={{
                        height: `${Math.max(
                          3,
                          (d.value / maxV) * 100
                        )}%`,
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* CHART DATE LABELS */}
              <div className="mt-2 flex w-full min-w-0 text-[11px] text-slate-400">
                {series.map((d, i) => (
                  <span
                    key={i}
                    className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-center"
                  >
                    {i % labelEvery === 0
                      ? fmtDate(d.t, range)
                      : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* =================================================
            POOL TOOLBAR
        ================================================= */}

        <div className="mt-10 flex min-w-0 flex-wrap items-center justify-between gap-3">

          {/* TABS */}
          <div
            className="inline-flex max-w-full rounded-full bg-blue-50 p-1"
            role="tablist"
            aria-label="Pools view"
          >
            {(
              [
                ['all', 'All pools'],
                ['mine', 'My Positions'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition focus-ring ${
                  tab === id
                    ? 'bg-panel text-cloud shadow dark:bg-blue-200'
                    : 'text-slate-500 hover:text-cloud'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* SEARCH AND FILTER */}
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">

            {searchOpen && (
              <input
                autoFocus
                value={query}
                onChange={(e) =>
                  setQuery(e.target.value)
                }
                placeholder="Search pool, chain or address"
                className="w-full min-w-0 flex-1 rounded-full border border-blue-100 bg-panel px-4 py-2 text-sm outline-none focus:border-altitude/60 sm:w-64"
              />
            )}

            {/* SEARCH BUTTON */}
            <button
              type="button"
              onClick={() => {
                setSearchOpen((o) => !o);

                if (searchOpen) {
                  setQuery('');
                }
              }}
              aria-label="Search pools"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-panel hover:bg-blue-50 focus-ring"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>

            {/* =============================================
                FIX 2 - RESPONSIVE FILTER DROPDOWN
            ============================================= */}

            <div
              className="relative z-30 shrink-0"
              ref={filterRef}
            >
              <button
                type="button"
                onClick={() =>
                  setFilterOpen((o) => !o)
                }
                aria-expanded={filterOpen}
                aria-haspopup="menu"
                className="flex h-10 items-center gap-2 rounded-full bg-horizon px-5 text-sm font-medium text-white hover:brightness-110 focus-ring"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 7h16M7 12h10M10 17h4" />
                </svg>

                Filter

                {chainFilter !== 'all' && (
                  <span className="h-2 w-2 rounded-full bg-white" />
                )}
              </button>

              {/* FILTER MENU */}
              {filterOpen && (
                <div
                  role="menu"
                  className="
                    glass
                    absolute
                    left-0
                    right-auto
                    top-12
                    z-50
                    w-48
                    max-w-[calc(100vw-2rem)]
                    rounded-2xl
                    p-2
                    text-sm
                    shadow-xl
                    sm:left-auto
                    sm:right-0
                  "
                >
                  {filterOptions.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={
                        chainFilter === o.id
                      }
                      onClick={() => {
                        setChainFilter(o.id);
                        setFilterOpen(false);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50 ${
                        chainFilter === o.id
                          ? 'bg-blue-100/70 font-medium'
                          : ''
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =================================================
            MOBILE POOL LIST
        ================================================= */}

        <div className="mt-4 min-w-0 md:hidden">

          {/* SORT BY */}
          <label className="mb-3 flex items-center gap-2 text-sm text-slate-500">
            Sort by

            <select
              value={sort.key}
              onChange={(e) =>
                setSort({
                  key: e.target.value as SortKey,
                  dir: 'desc',
                })
              }
              className="rounded-full border border-blue-100 bg-panel px-3 py-1.5 text-sm text-cloud outline-none focus:border-altitude/60"
            >
              {COLS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-blue-100 px-3 py-12 text-center text-slate-500">
              {tab === 'mine' ? (
                isConnected ? (
                  <p>
                    You have no liquidity positions yet.
                  </p>
                ) : (
                  <>
                    <p>
                      Connect your wallet to see your positions.
                    </p>

                    <button
                      type="button"
                      onClick={() => void connect()}
                      disabled={isConnecting}
                      className="mt-4 rounded-xl bg-horizon px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60 focus-ring"
                    >
                      {isConnecting
                        ? 'Check your wallet…'
                        : 'Connect Wallet'}
                    </button>
                  </>
                )
              ) : (
                <p>No pools match your search or filter.</p>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((p) => {
                const meta = CHAIN_META[p.chain];
                const fav = favs.includes(p.id);

                const stats: [string, string][] = [
                  ['TVL', money(p, p.tvl)],
                  ['APR', `${p.apr.toFixed(2)}%`],
                  ['Vol 24H', money(p, p.vol24)],
                  ['Vol 7D', money(p, p.vol7)],
                  ['Fees 24H', money(p, p.fee24)],
                  ['Fees 7D', money(p, p.fee7)],
                ];

                return (
                  <li
                    key={p.id}
                    className="glass w-full min-w-0 rounded-2xl p-4"
                  >
                    {/* POOL HEADER */}
                    <div className="flex min-w-0 items-start gap-3">

                      <button
                        type="button"
                        onClick={() => toggleFav(p.id)}
                        aria-pressed={fav}
                        aria-label={
                          fav
                            ? 'Remove from favorites'
                            : 'Add to favorites'
                        }
                        className={`shrink-0 text-xl leading-none focus-ring ${
                          fav
                            ? 'text-amber-400'
                            : 'text-slate-400 hover:text-amber-400'
                        }`}
                      >
                        {fav ? '★' : '☆'}
                      </button>

                      <LiquidityPairLogo
                        a={toPair(p.a)}
                        b={toPair(p.b)}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display font-semibold">
                          {p.a.s}-{p.b.s}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">

                          <span className="rounded-full bg-horizon px-2 py-0.5 font-semibold text-white">
                            {p.version}
                          </span>

                          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-horizon">
                            {p.fee}
                          </span>

                          <span
                            className={`rounded-full px-2 py-0.5 font-semibold ${meta.badgeClass}`}
                          >
                            {meta.badge}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => copy(p.address)}
                          className="mt-1.5 max-w-full truncate font-mono text-xs text-slate-500 hover:text-cloud focus-ring"
                          title="Copy pool address"
                        >
                          {copied === p.address
                            ? 'Copied'
                            : p.address}
                        </button>
                      </div>
                    </div>

                    {/* POOL STATS */}
                    <dl className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 border-t border-blue-100/70 pt-3 text-sm">
                      {stats.map(([k, v]) => (
                        <div key={k} className="min-w-0">
                          <dt className="text-xs text-slate-500">
                            {k}
                          </dt>

                          <dd className="truncate font-medium tabular-nums">
                            {v}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* =================================================
            DESKTOP POOL TABLE
        ================================================= */}

        <div className="mt-4 hidden w-full min-w-0 overflow-x-auto md:block">
          <div className="min-w-[860px]">

            {/* TABLE HEADER */}
            <div className="grid grid-cols-[minmax(0,2.2fr)_repeat(6,minmax(0,1fr))] items-center rounded-2xl bg-blue-50 px-5 py-3 text-sm text-slate-500">
              <span>Name</span>

              {COLS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() =>
                    setSort((s) => ({
                      key: c.key,
                      dir:
                        s.key === c.key &&
                        s.dir === 'desc'
                          ? 'asc'
                          : 'desc',
                    }))
                  }
                  className="text-right hover:text-cloud focus-ring"
                  aria-label={`Sort by ${c.label}`}
                >
                  {c.label}
                  {sort.key === c.key
                    ? sort.dir === 'desc'
                      ? ' ↓'
                      : ' ↑'
                    : ''}
                </button>
              ))}
            </div>

            {/* TABLE ROWS */}
            {rows.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                {tab === 'mine' ? (
                  isConnected ? (
                    <p>
                      You have no liquidity positions yet.
                    </p>
                  ) : (
                    <>
                      <p>
                        Connect your wallet to see your positions.
                      </p>

                      <button
                        type="button"
                        onClick={() => void connect()}
                        disabled={isConnecting}
                        className="mt-4 rounded-xl bg-horizon px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60 focus-ring"
                      >
                        {isConnecting
                          ? 'Check your wallet…'
                          : 'Connect Wallet'}
                      </button>
                    </>
                  )
                ) : (
                  <p>No pools match your search or filter.</p>
                )}
              </div>
            ) : (
              <ul>
                {rows.map((p) => {
                  const meta = CHAIN_META[p.chain];
                  const fav = favs.includes(p.id);

                  return (
                    <li
                      key={p.id}
                      className="group grid grid-cols-[minmax(0,2.2fr)_repeat(6,minmax(0,1fr))] items-center border-b border-blue-100/70 px-5 py-4 text-sm transition last:border-0 hover:rounded-2xl hover:bg-blue-50/80"
                    >
                      {/* POOL NAME */}
                      <div className="flex min-w-0 items-center gap-3">

                        <button
                          type="button"
                          onClick={() => toggleFav(p.id)}
                          aria-pressed={fav}
                          aria-label={
                            fav
                              ? 'Remove from favorites'
                              : 'Add to favorites'
                          }
                          className={`shrink-0 text-lg leading-none focus-ring ${
                            fav
                              ? 'text-amber-400'
                              : 'text-slate-400 hover:text-amber-400'
                          }`}
                        >
                          {fav ? '★' : '☆'}
                        </button>

                        <LiquidityPairLogo
                          a={toPair(p.a)}
                          b={toPair(p.b)}
                        />

                        <div className="min-w-0">
                          <p className="truncate font-display font-semibold">
                            {p.a.s}-{p.b.s}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">

                            <span className="rounded-full bg-horizon px-2 py-0.5 font-semibold text-white">
                              {p.version}
                            </span>

                            <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-horizon">
                              {p.fee}
                            </span>

                            <span
                              className={`rounded-full px-2 py-0.5 font-semibold ${meta.badgeClass}`}
                            >
                              {meta.badge}
                            </span>

                            <button
                              type="button"
                              onClick={() => copy(p.address)}
                              className="font-mono text-slate-500 hover:text-cloud focus-ring"
                              title="Copy pool address"
                            >
                              {copied === p.address
                                ? 'Copied'
                                : p.address}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* STATISTICS */}
                      <span className="text-right font-medium tabular-nums">
                        {money(p, p.tvl)}
                      </span>

                      <span className="text-right font-medium tabular-nums">
                        {money(p, p.vol24)}
                      </span>

                      <span className="text-right font-medium tabular-nums">
                        {money(p, p.vol7)}
                      </span>

                      <span className="text-right font-medium tabular-nums">
                        {money(p, p.fee24)}
                      </span>

                      <span className="text-right font-medium tabular-nums">
                        {money(p, p.fee7)}
                      </span>

                      <span className="text-right font-medium tabular-nums">
                        {p.apr.toFixed(2)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </main>

      {/* WALLET MODAL */}
      {gateOpen && (
        <WalletRequiredModal
          onClose={() => setGateOpen(false)}
        />
      )}

      {/* ADD LIQUIDITY DRAWER */}
      {drawerOpen && (
        <AddLiquidityDrawer
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
