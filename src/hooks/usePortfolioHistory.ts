import { useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { ENV } from '../config/env';
import { TOKENS } from '../config/tokens';

export type Range = '1' | '7' | '30';
export interface Point { t: number; v: number }

type Series = [number, number][]; // [timestamp ms, usd]
const CACHE = new Map<string, { at: number; data: Series }>();
const TTL = 5 * 60_000;

async function fetchChart(id: string, days: Range, signal: AbortSignal): Promise<Series> {
  const key = `${id}:${days}`;
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`, {
    signal,
    headers: ENV.coingeckoApiKey ? { 'x-cg-demo-api-key': ENV.coingeckoApiKey } : undefined,
  });
  if (!res.ok) throw new Error(res.status === 429 ? 'CoinGecko rate limit reached. Retrying in a minute.' : `CoinGecko error ${res.status}`);
  const json = (await res.json()) as { prices?: Series };
  const data = json.prices ?? [];
  CACHE.set(key, { at: Date.now(), data });
  return data;
}

/**
 * Value of the wallet's CURRENT holdings over time:
 *   value(t) = Σ  balance(token) × price(token, t)
 * Balances are held constant (we don't replay past transfers), so the line shows how
 * market prices moved what you own today.
 */
export function usePortfolioHistory(balances: Record<string, bigint>, range: Range, enabled: boolean) {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token amounts as plain numbers, only for tokens you actually hold.
  const holdings = useMemo(
    () =>
      TOKENS.flatMap((t) => {
        const b = balances[t.id];
        return b && b > 0n ? [{ id: t.coingeckoId, amount: Number(formatUnits(b, t.decimals)) }] : [];
      }),
    [balances],
  );
  const holdingsKey = holdings.map((h) => `${h.id}=${h.amount}`).join('|');

  useEffect(() => {
    if (!enabled || !holdings.length) {
      setPoints([]);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const ids = [...new Set(holdings.map((h) => h.id))];
        const charts = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await fetchChart(id, range, ctrl.signal)] as const)));
        // Use the densest series as the time grid; read the others at the latest price at or before each tick.
        const grid = ids.map((id) => charts[id]).reduce((a, b) => (b.length > a.length ? b : a)).map(([t]) => t);
        const cursor: Record<string, number> = {};
        const priceAt = (id: string, t: number): number => {
          const s = charts[id];
          let i = cursor[id] ?? 0;
          while (i + 1 < s.length && s[i + 1][0] <= t) i++;
          cursor[id] = i;
          return s[i]?.[1] ?? 0;
        };
        setPoints(grid.map((t) => ({ t, v: holdings.reduce((sum, h) => sum + h.amount * priceAt(h.id, t), 0) })));
        setError(null);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError((e as Error).message || 'Could not load price history.');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), TTL);
    return () => {
      ctrl.abort();
      window.clearInterval(timer);
    };
  }, [holdingsKey, range, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { points, loading, error };
}
