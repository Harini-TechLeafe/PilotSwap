import { formatUnits, parseUnits } from 'viem';

export const shortAddress = (a: string): string => `${a.slice(0, 6)}...${a.slice(-4)}`;

export function formatAmount(value: bigint, decimals: number, maxFrac = 6): string {
  const [int, frac = ''] = formatUnits(value, decimals).split('.');
  const trimmed = frac.slice(0, maxFrac).replace(/0+$/, '');
  if (int === '0' && !trimmed && value > 0n) return `<0.${'0'.repeat(maxFrac - 1)}1`;
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

/** Strict decimal parser: no negatives, no exponents, no excess decimals. */
export function parseAmount(input: string, decimals: number): bigint | null {
  const v = input.trim();
  if (!v || v === '.' || !/^\d*\.?\d*$/.test(v)) return null;
  const [, frac = ''] = v.split('.');
  if (frac.length > decimals) return null;
  const norm = (v.startsWith('.') ? `0${v}` : v).replace(/\.$/, '');
  try {
    return parseUnits(norm, decimals);
  } catch {
    return null;
  }
}

export function sanitizeAmountInput(raw: string): string {
  let s = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const parts = s.split('.');
  if (parts.length > 2) s = `${parts[0]}.${parts.slice(1).join('')}`;
  return s;
}

export function formatRate(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

/** USD price: 2 decimals for >= $1, more precision for sub-dollar prices (e.g. DAI $0.9998). */
export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const frac = n >= 1 ? 2 : n >= 0.01 ? 4 : 6;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: frac });
}
