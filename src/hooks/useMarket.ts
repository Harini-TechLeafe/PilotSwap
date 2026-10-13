import { useCallback, useEffect, useMemo, useState } from 'react';
import { EXPLORE_TOKENS, PAIRS, WS_HOSTS, fetchTickers, toQuote, type Quote, type RawTicker } from '../lib/binance';

const STREAMS = PAIRS.map((p) => `${p.toLowerCase()}@miniTicker`).join('/');

/**
 * Live prices for every token on the Explore page.
 *  1. One REST call for the first paint (and again every 30 s as a safety net).
 *  2. A Binance WebSocket pushes new prices; they are batched once per second to keep the page smooth.
 * Reconnects by itself and alternates between the two Binance hosts.
 */
export function useMarket() {
  const [raw, setRaw] = useState<Record<string, RawTicker>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const loadRest = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchTickers(signal);
      setRaw((prev) => ({ ...prev, ...data }));
      setError(null);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError('Could not reach Binance. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void loadRest(ctrl.signal);
    const id = window.setInterval(() => void loadRest(ctrl.signal), 30_000);
    return () => { ctrl.abort(); window.clearInterval(id); };
  }, [loadRest, attempt]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let hostIdx = 0;
    let fails = 0;
    let timer: number | undefined;
    const buffer: Record<string, RawTicker> = {};

    const flush = window.setInterval(() => {
      const keys = Object.keys(buffer);
      if (!keys.length) return;
      const batch = keys.map((k) => [k, buffer[k]] as const);
      keys.forEach((k) => delete buffer[k]);
      setRaw((prev) => ({ ...prev, ...Object.fromEntries(batch) }));
      setError(null);
    }, 1000);

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(`${WS_HOSTS[hostIdx % WS_HOSTS.length]}/stream?streams=${STREAMS}`);
      } catch {
        return;
      }
      ws.onopen = () => { fails = 0; };
      ws.onmessage = (ev) => {
        try {
          const d = (JSON.parse(String(ev.data)) as { data?: { e?: string; s: string; c: string; o: string; h: string; l: string; q: string } }).data;
          if (d && d.e === '24hrMiniTicker') buffer[d.s] = { last: +d.c, open: +d.o, high: +d.h, low: +d.l, quoteVolume: +d.q };
        } catch { /* ignore malformed frame */ }
      };
      ws.onerror = () => ws?.close();
      ws.onclose = () => {
        if (closed) return;
        hostIdx++;
        fails++;
        timer = window.setTimeout(connect, Math.min(15_000, 1000 * 2 ** fails));
      };
    };
    connect();

    return () => {
      closed = true;
      window.clearTimeout(timer);
      window.clearInterval(flush);
      ws?.close();
    };
  }, []);

  const quotes = useMemo(() => {
    const out: Record<string, Quote | null> = {};
    for (const t of EXPLORE_TOKENS) out[t.slug] = toQuote(t, raw[t.pair]);
    return out;
  }, [raw]);

  const hasData = Object.values(quotes).some(Boolean);
  const retry = useCallback(() => { setLoading(true); setError(null); setAttempt((n) => n + 1); }, []);

  return { quotes, loading: loading && !hasData, error: hasData ? null : error, retry };
}
