/**
 * One small interface for every Solana wallet, however it talks to the page:
 *  1. Wallet Standard wallets (Phantom, Solflare, Backpack, MetaMask Solana, ...). Auto-detected.
 *  2. Older "injected provider" wallets (TokenPocket's window.tokenpocket.solana, window.solana, ...).
 * The rest of the app only sees SolWallet: connect, disconnect, signTransaction, subscribe.
 */
import { Transaction } from '@solana/web3.js';
import { ENV } from '../config/env';
import { getStdWallets, onWalletsChange, startWalletStandard, type StdAccount, type StdWallet } from './walletStandard';

export interface SolWallet {
  id: string;
  name: string;
  icon: string;
  /** Opens the wallet's approval popup. `silent` re-uses an earlier approval without a popup (may return null). */
  connect(opts?: { silent?: boolean }): Promise<string | null>;
  disconnect(): Promise<void>;
  signTransaction(tx: Transaction): Promise<Transaction>;
  /** Calls fn with the new address (or null) when the user switches or disconnects inside the wallet. */
  subscribe(fn: (address: string | null) => void): () => void;
}

const CHAIN = `solana:${ENV.solanaCluster}`;
const isSolAccount = (a: StdAccount) => a.chains.some((c) => c.startsWith('solana:'));

// ── 1. Wallet Standard ───────────────────────────────────────────────────
function fromStandard(w: StdWallet): SolWallet {
  let account: any = null; // the WalletAccount object the wallet gave us (needed for signing)

  const pick = (accounts: readonly any[] | undefined) => {
    account = (accounts ?? []).find(isSolAccount) ?? null;
    return account ? (account.address as string) : null;
  };

  return {
    id: `std:${w.name}`,
    name: w.name,
    icon: w.icon ?? '',
    async connect(opts) {
      const feature = w.features['standard:connect'];
      if (!feature) throw new Error(`${w.name} cannot connect from a website.`);
      const res = await feature.connect(opts?.silent ? { silent: true } : undefined);
      return pick(res?.accounts ?? w.accounts);
    },
    async disconnect() {
      account = null;
      try {
        await w.features['standard:disconnect']?.disconnect();
      } catch {
        /* not supported */
      }
    },
    async signTransaction(tx) {
      const feature = w.features['solana:signTransaction'];
      if (!feature || !account) throw new Error(`${w.name} cannot sign Solana transactions here.`);
      const bytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const [out] = await feature.signTransaction({ account, transaction: bytes, chain: CHAIN });
      return Transaction.from(out.signedTransaction);
    },
    subscribe(fn) {
      const events = w.features['standard:events'];
      if (!events?.on) return () => {};
      return events.on('change', (e: any) => {
        if (e?.accounts) fn(pick(e.accounts));
      });
    },
  };
}

// ── 2. Injected providers (Phantom-style API) ────────────────────────────
interface InjectedCandidate {
  id: string;
  name: string;
  get: () => any;
}
const CANDIDATES: InjectedCandidate[] = [
  { id: 'tokenpocket', name: 'TokenPocket', get: () => (window as any).tokenpocket?.solana },
  { id: 'phantom', name: 'Phantom', get: () => (window as any).phantom?.solana },
  { id: 'solflare', name: 'Solflare', get: () => (window as any).solflare },
  { id: 'backpack', name: 'Backpack', get: () => (window as any).backpack },
  { id: 'injected', name: 'Browser wallet', get: () => (window as any).solana },
];

function fromInjected(c: InjectedCandidate, p: any): SolWallet {
  return {
    id: `inj:${c.id}`,
    name: c.name,
    icon: '',
    async connect(opts) {
      const res = await p.connect(opts?.silent ? { onlyIfTrusted: true } : undefined);
      const pk = res?.publicKey ?? p.publicKey;
      return pk ? pk.toString() : null;
    },
    async disconnect() {
      try {
        await p.disconnect?.();
      } catch {
        /* ignore */
      }
    },
    async signTransaction(tx) {
      if (!p.signTransaction) throw new Error(`${c.name} cannot sign transactions here.`);
      return (await p.signTransaction(tx)) as Transaction;
    },
    subscribe(fn) {
      if (!p.on) return () => {};
      const onAcc = (pk: any) => fn(pk ? pk.toString() : null);
      const onDisc = () => fn(null);
      p.on('accountChanged', onAcc);
      p.on('disconnect', onDisc);
      return () => {
        p.removeListener?.('accountChanged', onAcc);
        p.removeListener?.('disconnect', onDisc);
      };
    },
  };
}

// ── Discovery ────────────────────────────────────────────────────────────
const cache = new Map<string, SolWallet>();
const listeners = new Set<() => void>();
let started = false;

export function startSolanaDiscovery(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  startWalletStandard();
  onWalletsChange(() => listeners.forEach((l) => l()));
  // Extensions inject their provider a moment after page load: look again a few times.
  [300, 1000, 2500].forEach((ms) => window.setTimeout(() => listeners.forEach((l) => l()), ms));
}

export function onSolanaWalletsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Every Solana-capable wallet found right now. Stable objects between calls. */
export function listSolanaWallets(): SolWallet[] {
  const out: SolWallet[] = [];
  const names = new Set<string>();
  for (const w of getStdWallets()) {
    if (!w.chains.some((c) => c.startsWith('solana:')) || !w.features['solana:signTransaction']) continue;
    const id = `std:${w.name}`;
    if (!cache.has(id)) cache.set(id, fromStandard(w));
    out.push(cache.get(id)!);
    names.add(w.name.toLowerCase());
  }
  for (const c of CANDIDATES) {
    const p = c.get();
    if (!p || typeof p.connect !== 'function') continue;
    if (names.has(c.name.toLowerCase())) continue; // already listed through Wallet Standard
    // window.solana is usually Phantom/Solflare again: skip the generic one if a named wallet exists
    if (c.id === 'injected' && out.length > 0) continue;
    const id = `inj:${c.id}`;
    if (!cache.has(id)) cache.set(id, fromInjected(c, p));
    out.push(cache.get(id)!);
    names.add(c.name.toLowerCase());
  }
  return out;
}

/** Wallets we always show with an Install link when not detected. */
export const SOLANA_RECOMMENDED = [
  { name: 'TokenPocket', url: 'https://www.tokenpocket.pro/en/download/app' },
  { name: 'Phantom', url: 'https://phantom.app/download' },
  { name: 'Solflare', url: 'https://solflare.com/download' },
] as const;
