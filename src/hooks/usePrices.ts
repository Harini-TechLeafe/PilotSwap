import { useCallback, useEffect, useState } from 'react';
import { ENV } from '../config/env';
import { TOKENS } from '../config/tokens';

export interface TokenPrice {
  usd: number;
  /** 24-hour change in percent (can be undefined if CoinGecko omits it). */
  change24h?: number;
}

type PriceMap = Record<string, TokenPrice>; // keyed by CoinGecko id

const REFRESH_MS = 60_000;
const IDS = [...new Set([...TOKENS.map((t) => t.coingeckoId), 'bitcoin', 'ethereum', 'usd-coin', 'tether', 'solana'])].join(',');
const PRICE_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${IDS}&vs_currencies=usd&include_24hr_change=true`;

/** Live USD prices from CoinGecko for every token in TOKENS. Refreshes every 60 s. */
export function usePrices() {
  const [prices, setPrices] = useState<PriceMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(PRICE_URL, {
        signal,
        headers: ENV.coingeckoApiKey ? { 'x-cg-demo-api-key': ENV.coingeckoApiKey } : undefined,
      });
      if (!res.ok) throw new Error(res.status === 429 ? 'Rate limited by CoinGecko. Retrying shortly.' : `CoinGecko error ${res.status}`);
      const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
      const next: PriceMap = {};
      for (const [id, v] of Object.entries(data)) {
        if (typeof v.usd === 'number') next[id] = { usd: v.usd, change24h: v.usd_24h_change };
      }
      setPrices(next);
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message || 'Could not load prices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    const id = window.setInterval(() => void load(ctrl.signal), REFRESH_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(id);
    };
  }, [load]);

  return { prices, loading, error, updatedAt, refresh: () => load() };
}
