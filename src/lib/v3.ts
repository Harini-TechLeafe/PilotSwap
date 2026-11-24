import type { Address } from 'viem';

/** V3 price/tick helpers (price = raw token1 per raw token0). */
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;
const Q96 = 2n ** 96n;

/** Sort two token addresses in canonical order (token0 < token1). */
export function sortTokens(a: Address, b: Address): [Address, Address, boolean] {
  const swapped = a.toLowerCase() > b.toLowerCase();
  return swapped ? [b, a, true] : [a, b, false];
}

function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/** sqrtPriceX96 = sqrt(amount1 / amount0) * 2^96, from the raw deposit ratio. */
export function sqrtPriceX96FromAmounts(amount0: bigint, amount1: bigint): bigint {
  if (amount0 <= 0n || amount1 <= 0n) throw new Error('Both amounts must be greater than zero.');
  return isqrt((amount1 << 192n) / amount0);
}

/** Convert sqrtPriceX96 to a plain number price (raw token1 per raw token0). */
export function priceFromSqrtX96(sqrtPriceX96: bigint): number {
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  return sqrtPrice * sqrtPrice;
}

export function tickFromPrice(price: number): number {
  if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be a positive finite number.');
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

export const floorToSpacing = (tick: number, spacing: number) => Math.floor(tick / spacing) * spacing;
export const ceilToSpacing = (tick: number, spacing: number) => Math.ceil(tick / spacing) * spacing;

export type RangeMode = 'full' | 'wide' | 'narrow';
export const RANGE_OPTIONS: { id: RangeMode; label: string; hint: string; pct: number | null }[] = [
  { id: 'full', label: 'Full range', hint: 'Always in range', pct: null },
  { id: 'wide', label: '±50%', hint: 'Balanced', pct: 0.5 },
  { id: 'narrow', label: '±10%', hint: 'Concentrated, higher fees', pct: 0.1 },
];

/** Tick range for a position, aligned to the fee tier's spacing and clamped to V3 limits. */
export function tickRange(currentTick: number, spacing: number, mode: RangeMode): { tickLower: number; tickUpper: number } {
  if (!Number.isFinite(currentTick) || !Number.isInteger(spacing) || spacing <= 0) {
    throw new Error('A finite tick and positive tick spacing are required.');
  }
  const minT = ceilToSpacing(MIN_TICK, spacing);
  const maxT = floorToSpacing(MAX_TICK, spacing);
  const pct = RANGE_OPTIONS.find((range) => range.id === mode)?.pct ?? null;
  if (pct === null) return { tickLower: minT, tickUpper: maxT };
  const down = Math.log(1 - pct) / Math.log(1.0001);
  const up = Math.log(1 + pct) / Math.log(1.0001);
  let lower = Math.max(minT, floorToSpacing(currentTick + down, spacing));
  let upper = Math.min(maxT, ceilToSpacing(currentTick + up, spacing));
  if (upper <= lower) upper = lower + spacing;
  if (lower >= upper) lower = upper - spacing;
  return { tickLower: lower, tickUpper: upper };
}

/** Raw token1 per token0 needed for an in-range position; null for a single-sided range. */
export function token1PerToken0(sqrtPriceX96: bigint, tickLower: number, tickUpper: number): number | null {
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  const sqrtLower = Math.pow(1.0001, tickLower / 2);
  const sqrtUpper = Math.pow(1.0001, tickUpper / 2);
  if (sqrtPrice <= sqrtLower || sqrtPrice >= sqrtUpper) return null;
  const amount0Factor = 1 / sqrtPrice - 1 / sqrtUpper;
  const amount1Factor = sqrtPrice - sqrtLower;
  return amount0Factor > 0 ? amount1Factor / amount0Factor : null;
}
