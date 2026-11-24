import { getAddress, isAddress, zeroAddress, type Address } from 'viem';
import { ACTIVE_CHAIN, IS_BNB_CHAIN } from './chains';
import { ENV } from './env';

const NATIVE = ACTIVE_CHAIN.nativeCurrency;

export interface Token {
  /** Unique id used as a React key and balance-map key. */
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  /** null for the native coin (ETH). */
  address: Address | null;
  isNative: boolean;
  /** Icon styling (no remote images needed). */
  color: string;
  glyph: string;
  /** CoinGecko coin id used for the live USD price (https://api.coingecko.com/api/v3/coins/list). */
  coingeckoId: string;
}

/** Returns a checksummed address, or null if the value is empty/invalid/zero. */
export function parseAddress(value?: string): Address | null {
  if (!value || !isAddress(value, { strict: false }) || value.toLowerCase() === zeroAddress) return null;
  return getAddress(value);
}

/**
 * ─────────────────────────────────────────────────────────────
 *  TOKEN LIST  — add new tokens by appending an object below.
 *  Token addresses come from .env so you never hard-code unverified ones.
 *  IMPORTANT: `decimals` must match the on-chain token.
 *    - Mainnet USDC uses 6 decimals, but testnet MockToken USDC often uses 18.
 *    - Override per-chain via VITE_<NETWORK>_USDC_DECIMALS / VITE_<NETWORK>_USDT_DECIMALS (SEPOLIA, BSC_TESTNET, MAINNET, BSC_MAINNET).
 *    - If unsure, check the decimals() function on your deployed contract in etherscan.
 * ─────────────────────────────────────────────────────────────
 */
export const TOKENS: Token[] = ([
  // ids 'ETH' / 'WETH' stay as internal keys ("the gas coin" / "its wrapped version"); symbol and name follow the active chain.
  { id: 'ETH', symbol: NATIVE.symbol, name: NATIVE.name, decimals: 18, address: null, isNative: true, color: IS_BNB_CHAIN ? '#E0A800' : '#4F63E0', glyph: IS_BNB_CHAIN ? 'B' : 'Ξ', coingeckoId: IS_BNB_CHAIN ? 'binancecoin' : 'ethereum' },
  { id: 'WETH', symbol: IS_BNB_CHAIN ? 'WBNB' : 'WETH', name: IS_BNB_CHAIN ? 'Wrapped BNB' : 'Wrapped Ether', decimals: 18, address: parseAddress(ENV.wethAddress), isNative: false, color: '#7C5CE0', glyph: 'W', coingeckoId: IS_BNB_CHAIN ? 'wbnb' : 'weth' },
  { id: 'USDC', symbol: 'USDC', name: 'USD Coin', decimals: ENV.usdcDecimals, address: parseAddress(ENV.usdcAddress), isNative: false, color: '#2775CA', glyph: '$', coingeckoId: 'usd-coin' },
  { id: 'DAI', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, address: parseAddress(ENV.daiAddress), isNative: false, color: '#0095FF', glyph: '◈', coingeckoId: 'dai' },
  // USDT: real Tether on the mainnets; on the testnets it is the MockUSDT you deploy (address in .env).
  { id: 'USDT', symbol: 'USDT', name: 'Tether USD', decimals: ENV.usdtDecimals, address: parseAddress(ENV.usdtAddress), isNative: false, color: '#26A17B', glyph: '₮', coingeckoId: 'tether' },
]);

// Tiny change-notification so screens re-render when a token's decimals are corrected from the chain.
let decimalsVersion = 0;
const decimalsListeners = new Set<() => void>();
export const subscribeDecimals = (cb: () => void): (() => void) => {
  decimalsListeners.add(cb);
  return () => { decimalsListeners.delete(cb); };
};
export const getDecimalsVersion = (): number => decimalsVersion;

/** Update a token's decimals at runtime (used after on-chain verification) and tell the UI. */
export function setTokenDecimals(id: string, decimals: number): void {
  const token = TOKENS.find((t) => t.id === id);
  if (token && token.decimals !== decimals) {
    (token as { decimals: number }).decimals = decimals;
    decimalsVersion += 1;
    decimalsListeners.forEach((cb) => cb());
  }
}

export const isTokenConfigured = (t: Token): boolean => t.isNative || t.address !== null;
export const getToken = (id: string): Token => TOKENS.find((t) => t.id === id) ?? TOKENS[0];
