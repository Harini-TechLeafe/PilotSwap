import { useMemo } from 'react';
import MarketIcon from '../components/MarketIcon';
import MarketTicker from '../components/MarketTicker';
import Sparkline from '../components/Sparkline';
import { MARKET_TOKENS } from '../config/market';
import { useMarket } from '../hooks/useMarket';
import { formatCompactUsd, formatUsd } from '../lib/format';
import { LINKS } from '../lib/router';

function Change({ value }: { value?: number }) {
  if (value === undefined || !Number.isFinite(value)) return <span className="text-slate-400">—</span>;
  const flat = Math.abs(value) < 0.005;
  const up = value >= 0;
  return (
    <span className={`tabular-nums ${flat ? 'text-slate-500' : up ? 'text-emerald-600' : 'text-rose-600'}`}>
      {flat ? '' : up ? '▲ ' : '▼ '}{Math.abs(value).toFixed(2)}%
    </span>
  );
}

const GRID = 'grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-4 px-4 sm:px-5 md:grid-cols-[2rem_minmax(0,1.6fr)_1fr_0.7fr_0.7fr_1fr] lg:grid-cols-[2rem_minmax(0,1.6fr)_1fr_0.7fr_0.7fr_1fr_130px]';

export default function Explore() {
  const { tickers, sparks, loading, error, refresh } = useMarket();

  // Highest 24h volume first, like a "top tokens" board.
  const rows = useMemo(
    () => [...MARKET_TOKENS].sort((a, b) => (tickers[b.pair]?.volume ?? 0) - (tickers[a.pair]?.volume ?? 0)).slice(0, 10),
    [tickers],
  );

  return (
    <div className="pb-16 pt-8 sm:pt-10">
      {/* RUNNING WIDGET */}
      <MarketTicker tickers={tickers} sparks={sparks} loading={loading} error={error} onRetry={refresh} />

      {/* TOP 10 TOKENS */}
      <section aria-labelledby="tokens-title" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="tokens-title" className="text-2xl font-semibold">Tokens</h2>
            <p className="mt-2 text-slate-500">Top 10 by 24h trading volume. Tap a token to see its live chart and swap it.</p>
          </div>
        </div>

        <div className="glass mt-6 overflow-hidden rounded-2xl">
          <div className={`${GRID} border-b border-blue-100 bg-blue-50/70 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500`}>
            <span>#</span>
            <span>Token</span>
            <span className="text-right md:text-left">Price</span>
            <span className="hidden text-right md:block">1H</span>
            <span className="hidden text-right md:block">1D</span>
            <span className="hidden text-right md:block">Volume</span>
            <span className="hidden text-right lg:block">1D chart</span>
          </div>
          <ul className="divide-y divide-blue-100">
            {rows.map((m, i) => {
              const t = tickers[m.pair];
              return (
                <li key={m.symbol}>
                  <a href={LINKS.token(m.symbol)} aria-label={`Open ${m.name} (${m.symbol})`} className={`${GRID} py-4 transition hover:bg-blue-50/80 focus-ring`}>
                    <span className="text-slate-500 tabular-nums">{i + 1}</span>
                    <span className="flex min-w-0 items-center gap-3">
                      <MarketIcon token={m} size={40} />
                      <span className="min-w-0">
                        <span className="block truncate font-display text-lg font-semibold leading-tight">{m.name}</span>
                        <span className="block text-sm text-slate-500">{m.symbol}</span>
                      </span>
                    </span>
                    <span className="text-right md:text-left">
                      <span className="block font-display text-lg font-semibold tabular-nums">{t ? formatUsd(t.price) : loading ? <span className="text-slate-400">…</span> : '—'}</span>
                      <span className="block text-sm md:hidden"><Change value={t?.change24h} /></span>
                    </span>
                    <span className="hidden text-right text-sm md:block"><Change value={t?.change1h} /></span>
                    <span className="hidden text-right text-sm md:block"><Change value={t?.change24h} /></span>
                    <span className="hidden text-right text-sm tabular-nums md:block">{t ? formatCompactUsd(t.volume) : '—'}</span>
                    <span className="hidden justify-self-end lg:block"><Sparkline values={sparks[m.pair]} width={120} height={36} /></span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
