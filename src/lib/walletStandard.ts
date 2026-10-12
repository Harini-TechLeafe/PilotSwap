/**
 * Tiny, dependency-free Wallet Standard client (https://github.com/wallet-standard/wallet-standard).
 * Non-EVM wallets (Solana, Bitcoin) announce themselves to web pages with browser events.
 * We listen for those announcements and can then ask the wallet for its accounts.
 */

export interface StdAccount {
  address: string;
  chains: readonly string[];
  label?: string;
}

export interface StdWallet {
  name: string;
  chains: readonly string[];
  accounts: readonly StdAccount[];
  features: Record<string, any>;
}

const wallets: StdWallet[] = [];
const listeners = new Set<() => void>();
let started = false;

function register(...incoming: StdWallet[]): () => void {
  for (const w of incoming) if (!wallets.includes(w)) wallets.push(w);
  listeners.forEach((l) => l());
  return () => {
    for (const w of incoming) {
      const i = wallets.indexOf(w);
      if (i >= 0) wallets.splice(i, 1);
    }
    listeners.forEach((l) => l());
  };
}

/** Start listening for wallets. Safe to call many times. */
export function startWalletStandard(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const api = Object.freeze({ register });
  // Wallets that load AFTER us announce themselves with this event.
  window.addEventListener('wallet-standard:register-wallet', (event) => {
    const callback = (event as CustomEvent).detail;
    try {
      if (typeof callback === 'function') callback(api);
    } catch (e) {
      console.error('wallet-standard register failed', e);
    }
  });
  // Wallets that loaded BEFORE us are waiting for this event.
  try {
    window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api }));
  } catch (e) {
    console.error('wallet-standard app-ready failed', e);
  }
}

export function onWalletsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getStdWallets = (): readonly StdWallet[] => wallets;

/** The wallet-standard entry with this name (e.g. "MetaMask") that supports the chain family. */
export function findStdWallet(family: 'solana' | 'bitcoin', walletName: string | null): StdWallet | null {
  if (!walletName) return null;
  const n = walletName.toLowerCase();
  return wallets.find((w) => w.name.toLowerCase().includes(n) && w.chains.some((c) => c.startsWith(`${family}:`))) ?? null;
}

export const accountsForFamily = (w: StdWallet | null, family: 'solana' | 'bitcoin'): string[] =>
  (w?.accounts ?? []).filter((a) => a.chains.some((c) => c.startsWith(`${family}:`))).map((a) => a.address);

/** Asks the wallet to connect (may open a MetaMask approval popup). Returns this family's addresses. */
export async function connectStdWallet(w: StdWallet, family: 'solana' | 'bitcoin'): Promise<string[]> {
  const feature = w.features['standard:connect'];
  if (!feature) throw new Error(`${w.name} does not support connecting from a website.`);
  const res = await feature.connect();
  const list: StdAccount[] = res?.accounts ?? w.accounts;
  return list.filter((a) => a.chains.some((c) => c.startsWith(`${family}:`))).map((a) => a.address);
}

/** Calls back whenever the wallet's account list changes (user switched accounts inside MetaMask). */
export function subscribeStdWallet(w: StdWallet, fn: () => void): () => void {
  const events = w.features['standard:events'];
  if (!events?.on) return () => {};
  return events.on('change', fn);
}

export async function disconnectStdWallet(w: StdWallet): Promise<void> {
  try {
    await w.features['standard:disconnect']?.disconnect();
  } catch {
    /* wallet may not support it */
  }
}
