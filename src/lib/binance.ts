import type { TokenRef } from './tokenLogos';

/**
 * Binance public market-data helpers (no API key needed).
 * `data-api.binance.vision` is Binance's market-data-only host and works in regions where
 * `api.binance.com` is blocked, so it is tried first. The normal host is the fallback.
 */
const REST_HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];
export const WS_HOSTS = ['wss://data-stream.binance.vision', 'wss://stream.binance.com:9443'];

/**
 * ─────────────────────────────────────────────────────────────
 *  EXPLORE LIST — the tokens shown on the Explore Tokens page.
 *  Add or remove a line to change the list.
 *   • pair     Binance spot symbol used for price + chart
 *   • invert   true when the pair is quoted the other way round (USDT is read from USDC/USDT)
 *   • tokenId  id from config/tokens.ts when PilotSwap can read the wallet balance and swap it
 *              (omit it for tokens that do not exist on your test network yet)
 * ─────────────────────────────────────────────────────────────
 */
export interface ExploreToken {
  /** Used in the URL: #tokens/<slug> */
  slug: string;
  symbol: string;
  name: string;
  pair: string;
  invert?: boolean;
  tokenId?: string;
  logo: TokenRef;
}

export const EXPLORE_TOKENS: ExploreToken[] = [
  { slug: 'btc', symbol: 'BTC', name: 'Bitcoin', pair: 'BTCUSDT', tokenId: 'TBTC', logo: { family: 'bitcoin' } },
  { slug: 'eth', symbol: 'ETH', name: 'Ether', pair: 'ETHUSDT', tokenId: 'ETH', logo: { family: 'evm', chainId: 1, address: null } },
  { slug: 'usdt', symbol: 'USDT', name: 'Tether USD', pair: 'USDCUSDT', invert: true, logo: { family: 'evm', chainId: 1, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' } },
  { slug: 'xrp', symbol: 'XRP', name: 'XRP', pair: 'XRPUSDT', logo: { family: 'native', folder: 'ripple' } },
  { slug: 'bnb', symbol: 'BNB', name: 'BNB', pair: 'BNBUSDT', logo: { family: 'evm', chainId: 56, address: null } },
  { slug: 'sol', symbol: 'SOL', name: 'Solana', pair: 'SOLUSDT', logo: { family: 'solana', mint: null } },
  { slug: 'usdc', symbol: 'USDC', name: 'USD Coin', pair: 'USDCUSDT', tokenId: 'USDC', logo: { family: 'evm', chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2E9Eb0cE3606eB48' } },
  { slug: 'trx', symbol: 'TRX', name: 'TRON', pair: 'TRXUSDT', logo: { family: 'native', folder: 'tron' } },
  { slug: 'doge', symbol: 'DOGE', name: 'Dogecoin', pair: 'DOGEUSDT', logo: { family: 'native', folder: 'doge' } },
  { slug: 'ada', symbol: 'ADA', name: 'Cardano', pair: 'ADAUSDT', logo: { family: 'cardano', policyId: null } },
];

export const findExploreToken = (slug: string): ExploreToken | undefined => EXPLORE_TOKENS.find((t) => t.slug === slug.toLowerCase());

/** Raw 24h numbers for one Binance pair, exactly as Binance reports them. */
export interface RawTicker { last: number; open: number; high: number; low: number; quoteVolume: number }

/** What the UI shows for one token (already flipped for inverted pairs). */
export interface Quote { price: number; change: number; high: number; low: number; volume: number }

export function toQuote(t: ExploreToken, r?: RawTicker): Quote | null {
  if (!r || !(r.last > 0)) return null;
  const flip = (n: number) => (t.invert ? (n > 0 ? 1 / n : 0) : n);
  const price = flip(r.last);
  const open = flip(r.open);
  return {
    price,
    change: open > 0 ? ((price - open) / open) * 100 : 0,
    high: t.invert ? flip(r.low) : r.high,
    low: t.invert ? flip(r.high) : r.low,
    volume: r.quoteVolume,
  };
}

export const PAIRS = [...new Set(EXPLORE_TOKENS.map((t) => t.pair))];

/** GET a Binance REST path, trying each host in turn. */
export async function binanceGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let last: unknown = null;
  for (const host of REST_HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, { signal });
      if (res.ok) return (await res.json()) as T;
      last = new Error(`Binance error ${res.status}`);
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error('Could not reach Binance.');
}

interface Ticker24h { symbol: string; lastPrice: string; openPrice: string; highPrice: string; lowPrice: string; quoteVolume: string }

export async function fetchTickers(signal?: AbortSignal): Promise<Record<string, RawTicker>> {
  const rows = await binanceGet<Ticker24h[]>(`/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(PAIRS))}`, signal);
  const out: Record<string, RawTicker> = {};
  for (const r of rows) out[r.symbol] = { last: +r.lastPrice, open: +r.openPrice, high: +r.highPrice, low: +r.lowPrice, quoteVolume: +r.quoteVolume };
  return out;
}

export type ChartRange = 'live' | '1' | '7' | '30';
export const KLINES: Record<ChartRange, { interval: string; limit: number }> = {
  live: { interval: '1m', limit: 60 },
  '1': { interval: '5m', limit: 288 },
  '7': { interval: '1h', limit: 168 },
  '30': { interval: '4h', limit: 180 },
};

/** Closing prices for a token over the chosen range. */
export async function fetchCandles(t: ExploreToken, range: ChartRange, signal?: AbortSignal): Promise<{ t: number; v: number }[]> {
  const { interval, limit } = KLINES[range];
  const rows = await binanceGet<(string | number)[][]>(`/api/v3/klines?symbol=${t.pair}&interval=${interval}&limit=${limit}`, signal);
  return rows
    .map((k) => ({ t: Number(k[0]), v: t.invert ? 1 / Number(k[4]) : Number(k[4]) }))
    .filter((p) => Number.isFinite(p.v) && p.v > 0);
}

/** USD price with sensible precision: $67,234.50 · $178.2345 · $0.23412 */
export function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const max = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 5 : 6;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: max });
}

/** 1.23B / 456.7M / 12.3K */
export function formatCompactUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return '$' + n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 });
}

/** Last day of closing prices for one Binance pair (15-minute candles), used for the small charts. */
export async function fetchSparkPair(pair: string, signal?: AbortSignal): Promise<number[]> {
  const rows = await binanceGet<(string | number)[][]>(`/api/v3/klines?symbol=${pair}&interval=15m&limit=96`, signal);
  return rows.map((k) => Number(k[4])).filter((n) => Number.isFinite(n) && n > 0);
}

/** Change over roughly the last hour, from 15-minute closes (4 candles back) to the live price. */
export function change1h(closes: number[] | undefined, price: number | undefined): number | null {
  if (!closes || closes.length < 6 || !price) return null;
  const ref = closes[closes.length - 5];
  return ref > 0 ? ((price - ref) / ref) * 100 : null;
}
