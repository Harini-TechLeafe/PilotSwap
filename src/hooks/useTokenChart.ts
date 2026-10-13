import { useEffect, useMemo, useState } from 'react';
import { fetchCandles, type ChartRange, type ExploreToken } from '../lib/binance';
import type { Point } from './usePortfolioHistory';

/**
 * Price history for one token from Binance candles. The last point follows `livePrice`
 * (fed by the WebSocket), so the line keeps moving while you watch it.
 */
export function useTokenChart(token: ExploreToken, range: ChartRange, livePrice: number | null) {
  const [base, setBase] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBase([]);
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const pts = await fetchCandles(token, range, ctrl.signal);
        setBase(pts);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError('Could not load the price chart from Binance.');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };
    void load();
    const id = window.setInterval(() => void load(), range === 'live' ? 15_000 : 60_000);
    return () => { ctrl.abort(); window.clearInterval(id); };
  }, [token, range]);

  const points = useMemo<Point[]>(() => {
    if (!base.length) return base;
    const lastT = base[base.length - 1].t;
    return livePrice && livePrice > 0 ? [...base, { t: Math.max(Date.now(), lastT + 1), v: livePrice }] : base;
  }, [base, livePrice]);

  return { points, loading, error };
}
