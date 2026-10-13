import { useEffect, useState } from 'react';
import { EXPLORE_TOKENS, PAIRS, fetchSparkPair } from '../lib/binance';

/** One day of prices per token (for the mini charts). Refreshes every 5 minutes. */
export function useSparklines() {
  const [data, setData] = useState<Record<string, number[]>>({});

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      const byPair: Record<string, number[]> = {};
      await Promise.all(PAIRS.map(async (p) => {
        try { byPair[p] = await fetchSparkPair(p, ctrl.signal); } catch { /* leave this chart empty */ }
      }));
      if (ctrl.signal.aborted) return;
      const out: Record<string, number[]> = {};
      for (const t of EXPLORE_TOKENS) {
        const closes = byPair[t.pair];
        if (closes?.length) out[t.slug] = t.invert ? closes.map((n) => 1 / n) : closes;
      }
      setData((prev) => ({ ...prev, ...out }));
    };
    void load();
    const id = window.setInterval(() => void load(), 5 * 60_000);
    return () => { ctrl.abort(); window.clearInterval(id); };
  }, []);

  return data;
}
