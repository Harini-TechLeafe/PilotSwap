/**
 * EIP-6963: every installed browser wallet (MetaMask, Trust Wallet, Rabby, ...) announces itself
 * to the page with a name, an icon and its own provider, so we can list them all instead of
 * guessing from `window.ethereum`.  https://eips.ethereum.org/EIPS/eip-6963
 */
export interface WalletInfo {
  uuid: string;
  name: string;
  icon: string; // data: URI
  rdns: string; // e.g. "io.metamask", "com.trustwallet.app"
}

export interface DiscoveredWallet {
  info: WalletInfo;
  provider: EthereumProvider;
}

/** Wallets we always show, with an Install link when they are not detected. */
export const RECOMMENDED_WALLETS = [
  { rdns: 'io.metamask', name: 'MetaMask', url: 'https://metamask.io/download/' },
  { rdns: 'com.trustwallet.app', name: 'Trust Wallet', url: 'https://trustwallet.com/browser-extension' },
] as const;

const found = new Map<string, DiscoveredWallet>();
const listeners = new Set<() => void>();
let started = false;

const notify = () => listeners.forEach((l) => l());

export function startDiscovery(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('eip6963:announceProvider', (event) => {
    const detail = (event as CustomEvent<DiscoveredWallet>).detail;
    if (!detail?.info?.rdns || !detail.provider) return;
    found.set(detail.info.rdns, detail);
    notify();
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

/** Old wallets that only set `window.ethereum` (no EIP-6963): offer them as one generic entry. */
export function addLegacyWalletIfNeeded(): void {
  if (found.size === 0 && window.ethereum) {
    found.set('legacy', {
      info: { uuid: 'legacy', name: 'Browser wallet', icon: '', rdns: 'legacy' },
      provider: window.ethereum,
    });
    notify();
  }
}

export const getDiscoveredWallets = (): DiscoveredWallet[] => [...found.values()];

export function onDiscoveryChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
