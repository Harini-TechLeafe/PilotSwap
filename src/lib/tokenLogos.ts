import { getAddress, isAddress } from 'viem';

/**
 * Network-aware token logo resolution.
 *
 * Tokens are identified by their NETWORK-SPECIFIC id (never by symbol):
 *   EVM      → chainId + contract address (null address = the chain's native coin)
 *   Solana   → mint address (null = SOL)
 *   Cardano  → policyId + asset name hex (null policyId = ADA)
 *   Bitcoin  → native BTC only
 *
 * Sources, tried in order (first one that loads wins):
 *   1. `logoURI` already supplied by your pool API (https:// or a small data:image only)
 *   2. Trust Wallet assets repo (EVM, Solana, native coins)
 *   3. Solana token-list repo (Solana mints)
 *   4. Cardano Foundation token registry (Cardano native assets, returns a base64 PNG)
 * If nothing resolves, the UI shows a neutral fallback icon. A logo from another token is never used.
 * No API keys are needed and nothing secret is exposed in the browser.
 */

export type TokenRef =
  | { family: 'evm'; chainId: number; address: string | null }
  | { family: 'solana'; mint: string | null }
  | { family: 'cardano'; policyId: string | null; assetNameHex?: string }
  | { family: 'bitcoin' };

const TRUST = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';
const SOLANA_LIST = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet';
const CARDANO_REGISTRY = 'https://tokens.cardano.org/metadata';

/** EVM chain id → Trust Wallet folder. Add a line here to support another EVM network. Testnets have no logos. */
const EVM_FOLDERS: Record<number, string> = {
  1: 'ethereum', 56: 'smartchain', 137: 'polygon', 42161: 'arbitrum', 10: 'optimism', 8453: 'base', 43114: 'avalanchec',
};

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HEX = /^[0-9a-fA-F]*$/;

/** Stable cache key from the network-specific id, or null when the id is invalid/unsupported. */
export function tokenKey(ref: TokenRef): string | null {
  switch (ref.family) {
    case 'evm':
      if (ref.address === null) return `evm:${ref.chainId}:native`;
      return isAddress(ref.address, { strict: false }) ? `evm:${ref.chainId}:${ref.address.toLowerCase()}` : null;
    case 'solana':
      if (ref.mint === null) return 'solana:native';
      return BASE58.test(ref.mint) ? `solana:${ref.mint}` : null;
    case 'cardano': {
      if (ref.policyId === null) return 'cardano:native';
      const name = (ref.assetNameHex ?? '').toLowerCase();
      if (ref.policyId.length !== 56 || !HEX.test(ref.policyId) || name.length > 64 || name.length % 2 !== 0 || !HEX.test(name)) return null;
      return `cardano:${ref.policyId.toLowerCase()}${name}`;
    }
    case 'bitcoin':
      return 'bitcoin:native';
  }
}

/** Candidate image URLs for a token (https only), most trusted first. */
function candidates(ref: TokenRef): string[] {
  switch (ref.family) {
    case 'evm': {
      const folder = EVM_FOLDERS[ref.chainId];
      if (!folder) return [];
      if (ref.address === null) return [`${TRUST}/${folder}/info/logo.png`];
      if (!isAddress(ref.address, { strict: false })) return [];
      return [`${TRUST}/${folder}/assets/${getAddress(ref.address)}/logo.png`];
    }
    case 'solana':
      if (ref.mint === null) return [`${TRUST}/solana/info/logo.png`];
      return BASE58.test(ref.mint) ? [`${TRUST}/solana/assets/${ref.mint}/logo.png`, `${SOLANA_LIST}/${ref.mint}/logo.png`] : [];
    case 'cardano':
      return ref.policyId === null ? [`${TRUST}/cardano/info/logo.png`] : [];
    case 'bitcoin':
      return [`${TRUST}/bitcoin/info/logo.png`];
  }
}

/** Accept only https URLs or small raster data URIs. Rejects javascript:, http:, svg data, etc. */
export function sanitizeLogoUri(uri?: string | null): string | null {
  if (!uri) return null;
  const u = uri.trim();
  if (/^https:\/\/[^\s]+$/i.test(u)) return u;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u) && u.length < 300_000) return u;
  return null;
}

/* ── caching ─────────────────────────────────────────────────────────── */
const STORE_KEY = 'pilotswap:token-logos:v1';
const OK_TTL = 7 * 24 * 3600_000;
const FAIL_TTL = 3600_000;
type Entry = { u: string | null; t: number };
const mem = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();
let loaded = false;

function loadStore() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, Entry>;
    for (const [k, v] of Object.entries(raw)) if (v && typeof v.t === 'number') mem.set(k, v);
  } catch { /* storage unavailable */ }
}
function persist() {
  try {
    const out: Record<string, Entry> = {};
    mem.forEach((v, k) => { if (!v.u || v.u.startsWith('https://')) out[k] = v; }); // never persist large data URIs
    localStorage.setItem(STORE_KEY, JSON.stringify(out));
  } catch { /* storage unavailable */ }
}
const fresh = (e: Entry) => Date.now() - e.t < (e.u ? OK_TTL : FAIL_TTL);

/** Synchronous cache read (undefined = not resolved yet, null = known missing). */
export function getCachedLogo(ref: TokenRef): string | null | undefined {
  loadStore();
  const key = tokenKey(ref);
  if (!key) return null;
  const e = mem.get(key);
  if (e && fresh(e)) return e.u;
  return undefined;
}

/* ── network probing (max 6 at a time) ──────────────────────────────── */
let active = 0;
const queue: (() => void)[] = [];
const acquire = () => new Promise<void>((res) => { if (active < 6) { active++; res(); } else queue.push(() => { active++; res(); }); });
const release = () => { active--; queue.shift()?.(); };

function probeImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const done = (ok: boolean) => { img.onload = img.onerror = null; window.clearTimeout(timer); resolve(ok); };
    const timer = window.setTimeout(() => done(false), 8000);
    img.referrerPolicy = 'no-referrer';
    img.onload = () => done(img.naturalWidth > 0);
    img.onerror = () => done(false);
    img.src = src;
  });
}

async function cardanoRegistryLogo(ref: Extract<TokenRef, { family: 'cardano' }>): Promise<string | null> {
  if (ref.policyId === null) return null;
  const subject = `${ref.policyId}${ref.assetNameHex ?? ''}`.toLowerCase();
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${CARDANO_REGISTRY}/${subject}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    window.clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { subject?: string; logo?: { value?: string } };
    if (data.subject && data.subject.toLowerCase() !== subject) return null; // must be the exact asset
    const b64 = data.logo?.value;
    if (typeof b64 !== 'string' || b64.length > 200_000 || !/^[A-Za-z0-9+/=]+$/.test(b64)) return null;
    const uri = `data:image/png;base64,${b64}`;
    return (await probeImage(uri)) ? uri : null;
  } catch {
    return null;
  }
}

/** Resolve a token's logo URL. Cached and de-duplicated; resolves to null when no authentic logo is found. */
export function resolveTokenLogo(ref: TokenRef, logoURI?: string | null): Promise<string | null> {
  loadStore();
  const key = tokenKey(ref);
  if (!key) return Promise.resolve(null);
  const e = mem.get(key);
  if (e && fresh(e)) return Promise.resolve(e.u);
  const running = inflight.get(key);
  if (running) return running;

  const p = (async () => {
    await acquire();
    try {
      const urls = [sanitizeLogoUri(logoURI), ...candidates(ref)].filter((u): u is string => !!u);
      for (const u of urls) if (await probeImage(u)) return u;
      if (ref.family === 'cardano') return await cardanoRegistryLogo(ref);
      return null;
    } finally {
      release();
    }
  })().then((u) => {
    mem.set(key, { u, t: Date.now() });
    inflight.delete(key);
    persist();
    return u;
  });
  inflight.set(key, p);
  return p;
}
