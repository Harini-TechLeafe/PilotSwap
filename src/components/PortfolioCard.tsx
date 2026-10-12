import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { TOKENS } from '../config/tokens';
import { usePortfolioHistory, type Point, type Range } from '../hooks/usePortfolioHistory';
import type { TokenPrice } from '../hooks/usePrices';
import { useWallet } from '../hooks/useWallet';
import { formatAmount, formatUsd } from '../lib/format';

/**
 * Chart colours (validated for colour-blind separation in this order).
 * Separate from the token icon colours on purpose: ETH and WETH icons are nearly the same hue.
 * Every colour is also paired with the token's name, so colour is never the only cue.
 */
const SERIES: Record<string, string> = { ETH: '#2a78d6', WETH: '#e87ba4', USDC: '#1baf7a', DAI: '#4a3aa7', TBTC: '#eb6834' };
const UP = '#059669';   // emerald-600
const DOWN = '#e11d48'; // rose-600

const RANGES: { id: Range; label: string; words: string }[] = [
  { id: '1', label: '24H', words: 'in the last 24 hours' },
  { id: '7', label: '7D', words: 'in the last 7 days' },
  { id: '30', label: '30D', words: 'in the last 30 days' },
];

interface Props {
  balances: Record<string, bigint>;
  balancesLoading: boolean;
  prices: Record<string, TokenPrice>;
}

export default function PortfolioCard({ balances, balancesLoading, prices }: Props) {
  const { isConnected, isWrongNetwork, connect, switchNetwork } = useWallet();
  const ready = isConnected && !isWrongNetwork;
  const [range, setRange] = useState<Range>('7');

  // ── Today's value, token by token: amount × live price ──
  const rows = useMemo(
    () =>
      TOKENS.map((t) => {
        const amount = balances[t.id] ?? 0n;
        const price = prices[t.coingeckoId]?.usd;
        const usd = price !== undefined ? Number(formatUnits(amount, t.decimals)) * price : 0;
        return { token: t, amount, price, usd };
      }),
    [balances, prices],
  );
  const total = rows.reduce((s, r) => s + r.usd, 0);
  const pricesReady = Object.keys(prices).length > 0;

  const { points: history, loading: historyLoading, error } = usePortfolioHistory(balances, range, ready);
  // End the line exactly on today's headline number.
  const points = useMemo<Point[]>(() => (history.length && total > 0 ? [...history, { t: Date.now(), v: total }] : history), [history, total]);
  const start = points[0]?.v ?? 0;
  const change = points.length ? total - start : 0;
  const changePct = start > 0 ? (change / start) * 100 : 0;
  const up = change >= 0;
  const rangeWords = RANGES.find((r) => r.id === range)!.words;

  if (!isConnected || isWrongNetwork) {
    return (
      <Shell range={range} setRange={setRange} showRange={false}>
        <div className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-4xl font-bold text-slate-300">$—</p>
            <p className="mt-1 text-sm text-slate-500">{isWrongNetwork ? 'Switch to the supported network to see your total balance.' : 'Connect your wallet to see the total value of your tokens in US dollars.'}</p>
          </div>
          <button className="rounded-2xl bg-horizon px-5 py-3 font-display font-semibold text-white transition hover:brightness-110 focus-ring" onClick={() => void (isWrongNetwork ? switchNetwork() : connect())}>
            {isWrongNetwork ? 'Switch Network' : 'Connect Wallet'}
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell range={range} setRange={setRange} showRange>
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.5fr)] lg:gap-8">
        {/* LEFT: the number + where it sits */}
        <div className="min-w-0">
          <p className="text-sm text-slate-500">Worth today</p>
          <p className="mt-1 font-display text-4xl font-bold tabular-nums tracking-tight sm:text-5xl" aria-live="polite">
            {!pricesReady || (balancesLoading && !Object.keys(balances).length) ? <span className="text-slate-300">Loading…</span> : formatUsd(total)}
          </p>
          {points.length > 1 && (
            <p className="mt-2 text-sm">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {up ? '▲' : '▼'} {up ? '+' : '−'}{formatUsd(Math.abs(change))} ({Math.abs(changePct).toFixed(2)}%)
              </span>{' '}
              <span className="text-slate-500">{up ? 'up' : 'down'} {rangeWords}</span>
            </p>
          )}

          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Where your money is</p>
          <AllocationBar rows={rows} total={total} />
          <ul className="mt-3 space-y-1.5">
            {rows.map(({ token, amount, price, usd }) => {
              const pct = total > 0 ? (usd / total) * 100 : 0;
              const empty = amount === 0n;
              return (
                <li key={token.id} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 text-sm ${empty ? 'opacity-50' : ''}`}>
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[token.id] ?? '#94a3b8' }} aria-hidden />
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-cloud">{token.symbol}</span>{' '}
                    <span className="text-slate-500 tabular-nums">
                      {formatAmount(amount, token.decimals, 4)} × {price !== undefined ? formatUsd(price) : '—'}
                    </span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="font-semibold text-cloud">{formatUsd(usd)}</span>
                    <span className="ml-2 inline-block w-11 text-slate-500">{empty ? '—' : pct < 0.1 ? '<0.1%' : `${pct.toFixed(1)}%`}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* RIGHT: how the value moved */}
        <div className="min-w-0">
          <p className="text-sm text-slate-500">
            How your balance moved {rangeWords} <span className="text-slate-400">· live from CoinGecko</span>
          </p>
          <div className={`mt-2 transition-opacity ${historyLoading && points.length ? 'opacity-60' : ''}`}>
            {total === 0 ? (
              <Empty text="No priced tokens in this wallet yet. Receive some tokens to see your balance chart." />
            ) : error && !points.length ? (
              <Empty text={error} />
            ) : points.length < 2 ? (
              <Empty text="Loading price history…" />
            ) : (
              <ValueChart points={points} color={up ? UP : DOWN} range={range} start={start} />
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            The line shows what the tokens you hold <b>now</b> were worth at each moment. These are testnet tokens shown at real market prices (tBTC uses the BTC price), so it is a preview, not real money.
          </p>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, range, setRange, showRange }: { children: ReactNode; range: Range; setRange: (r: Range) => void; showRange: boolean }) {
  return (
    <section id="portfolio" aria-labelledby="portfolio-title" className="pb-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 id="portfolio-title" className="text-2xl font-semibold">Total wallet balance</h2>
        {showRange && (
          <div role="radiogroup" aria-label="Time range" className="inline-flex rounded-xl border border-blue-100 bg-white p-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                role="radio"
                aria-checked={range === r.id}
                onClick={() => setRange(r.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition focus-ring ${range === r.id ? 'bg-horizon text-white' : 'text-slate-500 hover:bg-blue-50 hover:text-cloud'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="glass overflow-hidden rounded-2xl">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-blue-100 px-6 text-center text-sm text-slate-500">{text}</div>;
}

// ── 100% bar: each token's share of the total, 2px gaps between segments ──
function AllocationBar({ rows, total }: { rows: { token: { id: string; symbol: string }; usd: number }[]; total: number }) {
  const parts = rows.filter((r) => r.usd > 0);
  if (!parts.length || total <= 0) return <div className="mt-2 h-3 rounded-full bg-blue-50" aria-hidden />;
  return (
    <div className="mt-2 flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.token.symbol} ${((p.usd / total) * 100).toFixed(1)}%`).join(', ')}>
      {parts.map((p) => (
        <span
          key={p.token.id}
          title={`${p.token.symbol}: ${formatUsd(p.usd)} (${((p.usd / total) * 100).toFixed(1)}%)`}
          className="h-full transition-[filter] hover:brightness-110"
          style={{ flexGrow: p.usd, flexBasis: 0, minWidth: 4, background: SERIES[p.token.id] ?? '#94a3b8' }}
        />
      ))}
    </div>
  );
}

// ── Area chart with High/Low markers, a dashed "start" line, and a hover crosshair ──
const H = 220;
const PAD = { top: 26, right: 8, bottom: 26, left: 8 };

function fmtTime(t: number, range: Range): string {
  const d = new Date(t);
  return range === '1'
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + (range === '7' ? `, ${d.toLocaleTimeString(undefined, { hour: 'numeric' })}` : '');
}
function fmtTick(t: number, range: Range): string {
  const d = new Date(t);
  return range === '1' ? d.toLocaleTimeString(undefined, { hour: 'numeric' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ValueChart({ points, color, range, start }: { points: Point[]; color: string; range: Range; start: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const t0 = points[0].t, t1 = points[points.length - 1].t;
    let lo = Infinity, hi = -Infinity, iLo = 0, iHi = 0;
    points.forEach((p, i) => { if (p.v < lo) { lo = p.v; iLo = i; } if (p.v > hi) { hi = p.v; iHi = i; } });
    const span = hi - lo || hi * 0.01 || 1;
    const yMin = lo - span * 0.12, yMax = hi + span * 0.12;
    const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0 || 1)) * (w - PAD.left - PAD.right);
    const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
    const area = `${line}L${x(t1).toFixed(1)} ${H - PAD.bottom}L${x(t0).toFixed(1)} ${H - PAD.bottom}Z`;
    const ticks = Array.from({ length: 4 }, (_, k) => t0 + ((t1 - t0) * (k + 0.5)) / 4);
    return { x, y, line, area, iLo, iHi, ticks };
  }, [points, w]);

  const nearest = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    const px = clientX - r.left;
    let best = 0, dist = Infinity;
    points.forEach((p, i) => { const d = Math.abs(geo.x(p.t) - px); if (d < dist) { dist = d; best = i; } });
    return best;
  };
  const onMove = (e: PointerEvent) => setHover(nearest(e.clientX));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setHover((h) => Math.min(points.length - 1, Math.max(0, (h ?? points.length - 1) + (e.key === 'ArrowRight' ? 1 : -1))));
    }
  };

  const hp = hover !== null ? points[hover] : null;
  const gid = `pf-grad-${color.slice(1)}`;
  const label = (i: number, text: string, above: boolean) => {
    const px = geo.x(points[i].t), py = geo.y(points[i].v);
    const anchor = px < 60 ? 'start' : px > w - 60 ? 'end' : 'middle';
    return (
      <g>
        <circle cx={px} cy={py} r={4} fill="#fff" stroke={color} strokeWidth={2} />
        <text x={px} y={above ? py - 10 : py + 18} textAnchor={anchor} className="fill-slate-600 text-[11px] font-medium">{text}</text>
      </g>
    );
  };

  return (
    <div ref={wrap} className="relative select-none">
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        className="block touch-none outline-none focus-visible:ring-2 focus-visible:ring-altitude rounded-lg"
        tabIndex={0}
        role="img"
        aria-label={`Balance chart: from ${formatUsd(start)} to ${formatUsd(points[points.length - 1].v)}. Use left and right arrow keys to read values.`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* baseline + start reference */}
        <line x1={PAD.left} x2={w - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="#dbeafe" />
        <line x1={PAD.left} x2={w - PAD.right} y1={geo.y(start)} y2={geo.y(start)} stroke="#94a3b8" strokeDasharray="3 4" strokeWidth={1} />
        <text x={w - PAD.right} y={geo.y(start) - 5} textAnchor="end" className="fill-slate-400 text-[10px]">start {formatUsd(start)}</text>

        <path d={geo.area} fill={`url(#${gid})`} />
        <path d={geo.line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {geo.iHi !== geo.iLo && label(geo.iHi, `High ${formatUsd(points[geo.iHi].v)}`, true)}
        {geo.iHi !== geo.iLo && label(geo.iLo, `Low ${formatUsd(points[geo.iLo].v)}`, false)}
        {/* "now" dot */}
        <circle cx={geo.x(points[points.length - 1].t)} cy={geo.y(points[points.length - 1].v)} r={4.5} fill={color} stroke="#fff" strokeWidth={2} />

        {geo.ticks.map((t) => (
          <text key={t} x={geo.x(t)} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[11px]">{fmtTick(t, range)}</text>
        ))}

        {hp && (
          <g pointerEvents="none">
            <line x1={geo.x(hp.t)} x2={geo.x(hp.t)} y1={PAD.top - 8} y2={H - PAD.bottom} stroke="#0B1F4D" strokeOpacity={0.25} />
            <circle cx={geo.x(hp.t)} cy={geo.y(hp.v)} r={5} fill={color} stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>

      {hp && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm shadow-lg shadow-blue-900/10"
          style={{ left: Math.min(Math.max(geo.x(hp.t) - 80, 0), w - 160), width: 160 }}
        >
          <p className="font-display text-base font-bold tabular-nums text-cloud">{formatUsd(hp.v)}</p>
          <p className={`text-xs font-medium tabular-nums ${hp.v >= start ? 'text-emerald-700' : 'text-rose-700'}`}>
            {hp.v >= start ? '▲ +' : '▼ −'}{formatUsd(Math.abs(hp.v - start))} vs start
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{hover === points.length - 1 ? 'Now' : fmtTime(hp.t, range)}</p>
        </div>
      )}
    </div>
  );
}
