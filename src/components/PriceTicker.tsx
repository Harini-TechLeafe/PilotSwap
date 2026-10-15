import { Link } from '../lib/router';
import { formatCompactUsd, formatPrice, type ExploreToken, type Quote } from '../lib/binance';
import Sparkline from './Sparkline';
import TokenLogo from './TokenLogo';

interface Props {
  tokens: ExploreToken[];
  quotes: Record<string, Quote | null>;
  sparks: Record<string, number[]>;
  loading: boolean;
  error: string | null;
}

/** Scrolling row of live market cards. Hover to pause, click a card to open the token. */
export default function PriceTicker({ tokens, quotes, sparks, loading, error }: Props) {
  const items = tokens.filter((t) => quotes[t.slug]);

  if (!items.length) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6" role="status">
        <p className="rounded-2xl border border-blue-100 bg-panel/70 p-4 text-sm text-slate-500">
          {loading ? <span className="animate-pulse">Loading live prices…</span> : error ?? 'Live prices are not available right now.'}
        </p>
      </div>
    );
  }

  return (
    <div className="ticker overflow-hidden py-6 [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]" role="region" aria-label="Live market prices">
      <div className="ticker-track flex w-max">
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex shrink-0 gap-4 pr-4" aria-hidden={copy === 1}>
            {items.map((t) => {
              const q = quotes[t.slug]!;
              const flat = Math.abs(q.change) < 0.005;
              const up = q.change >= 0;
              return (
                <li key={t.slug} className="w-[260px] shrink-0">
                  <Link
                    to={`/tokens/${t.slug}`}
                    tabIndex={copy === 1 ? -1 : undefined}
                    className="glass block rounded-2xl p-4 transition hover:-translate-y-0.5 hover:border-horizon/40 focus-ring"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <TokenLogo token={t.logo} symbol={t.symbol} name={t.name} size={40} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-cloud">{t.name}</p>
                          <p className="text-xs text-slate-500">{t.symbol}</p>
                        </div>
                      </div>
                      <Sparkline values={sparks[t.slug]} className="h-8 w-20 shrink-0" />
                    </div>
                    <p className="mt-3 flex items-baseline gap-2 tabular-nums">
                      <span className="font-display text-2xl font-bold text-cloud">{formatPrice(q.price)}</span>
                      <span className={`text-sm font-semibold ${flat ? 'text-slate-500' : up ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {flat ? '' : up ? '▲ ' : '▼ '}{Math.abs(q.change).toFixed(2)}%
                      </span>
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="tabular-nums"><b className="font-semibold text-cloud">{formatCompactUsd(q.volume)}</b> 24h volume</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 font-medium text-slate-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> Binance
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </div>
  );
}
