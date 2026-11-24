import { useEffect, useState, type ReactNode } from 'react';
import LiquidityPairLogo, { type PairToken } from './LiquidityPairLogo';
import TokenLogo from './TokenLogo';
import type { TokenRef } from '../lib/tokenLogos';
import { getToken, isTokenConfigured } from '../config/tokens';
import AddLiquidityV3 from './AddLiquidityV3';
import { useWallet } from '../hooks/useWallet';
import { ACTIVE_CHAIN, IS_BNB_CHAIN, IS_MAINNET, NATIVE_SYMBOL, CONFIGURED_EVM_CHAIN_IDS } from '../config/chains';
import { saveSelectedChainId } from '../config/env';

const TAB_CHAIN_ID: Record<NetworkId, number> = { mainnet: 1, evm: 11155111, bnb: 97, bnbmain: 56 };
function switchApp(tab: NetworkId) {
  saveSelectedChainId(TAB_CHAIN_ID[tab]);
  window.location.reload();
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Add Liquidity flow
 *   1. <AddLiquidityButton/> sits in the page header.
 *   2. Wallet NOT connected  → <WalletRequiredModal/> ("connect to add liquidity").
 *   3. Wallet connected      → <AddLiquidityDrawer/>: pick a configured EVM network and pair.
 *
 * ────────────────────────────────────────────────────────────────────────── */

export type NetworkId = 'mainnet' | 'evm' | 'bnb' | 'bnbmain';
/** The EVM tab that matches the chain this build runs on (one chain per run, set by VITE_CHAIN_ID). */
const ACTIVE_EVM_TAB: NetworkId = ACTIVE_CHAIN.id === 1 ? 'mainnet' : ACTIVE_CHAIN.id === 56 ? 'bnbmain' : ACTIVE_CHAIN.id === 97 ? 'bnb' : 'evm';

const USDC_EVM = '0xA0b86991c6218b36c1d19D4a2E9Eb0cE3606eB48';

interface LpToken extends PairToken { decimals: number }

const T = {
  // The gas coin of the active chain (ETH, or tBNB on BNB Smart Chain Testnet). Key stays 'ETH' = the token id used in config/tokens.ts.
  ETH: { symbol: NATIVE_SYMBOL, name: ACTIVE_CHAIN.nativeCurrency.name, decimals: 6, token: { family: 'evm', chainId: IS_BNB_CHAIN ? 56 : 1, address: null } },
  USDC_E: { symbol: 'USDC', name: 'USD Coin', decimals: 2, token: { family: 'evm', chainId: 1, address: USDC_EVM } },
  DAI_E: { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 2, token: { family: 'evm', chainId: 1, address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' } },
  USDT_E: { symbol: 'USDT', name: 'Tether USD', decimals: 2, token: { family: 'evm', chainId: 1, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' } },
} satisfies Record<string, LpToken>;

/** Ethereum pairs: real tokens from config/tokens.ts (ids match TOKENS). */
const EVM_PAIRS: { id: string; a: LpToken; b: LpToken; aId: string; bId: string }[] = [
  { id: 'eth-usdc', a: T.ETH, b: T.USDC_E, aId: 'ETH', bId: 'USDC' },
  { id: 'eth-dai', a: T.ETH, b: T.DAI_E, aId: 'ETH', bId: 'DAI' },
  { id: 'usdc-dai', a: T.USDC_E, b: T.DAI_E, aId: 'USDC', bId: 'DAI' },
  { id: 'eth-usdt', a: T.ETH, b: T.USDT_E, aId: 'ETH', bId: 'USDT' },
  { id: 'usdc-usdt', a: T.USDC_E, b: T.USDT_E, aId: 'USDC', bId: 'USDT' },
  { id: 'dai-usdt', a: T.DAI_E, b: T.USDT_E, aId: 'DAI', bId: 'USDT' },
];

const NETWORKS: { id: NetworkId; label: string; fullName: string; logo: TokenRef }[] = [
  { id: 'mainnet', label: 'Ethereum', fullName: 'Ethereum Mainnet', logo: { family: 'evm', chainId: 1, address: null } },
  { id: 'evm', label: 'Sepolia', fullName: 'Sepolia', logo: { family: 'evm', chainId: 1, address: null } },
  { id: 'bnbmain', label: 'BNB Chain', fullName: 'BNB Smart Chain', logo: { family: 'evm', chainId: 56, address: null } },
  { id: 'bnb', label: 'BNB Testnet', fullName: 'BNB Smart Chain Testnet', logo: { family: 'evm', chainId: 56, address: null } },
];

/* ── shared modal shell ─────────────────────────────────────────────────── */
function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onClose]);
}

function Popup({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEscape(true, onClose);
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} className="glass toast-in w-full max-w-sm rounded-3xl p-6" onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ── 1. header button ───────────────────────────────────────────────────── */
export function AddLiquidityButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex h-11 items-center gap-2 rounded-full bg-horizon px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 active:scale-[0.98] focus-ring">
      Add Liquidity
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
    </button>
  );
}

/* ── 2. wallet-required popup ───────────────────────────────────────────── */
export function WalletRequiredModal({ onClose }: { onClose: () => void }) {
  const { connect, isConnecting, isConnected, isWrongNetwork, chainId, switchNetwork, isSwitching } = useWallet();
  const waitingForNetwork = isConnected && chainId === null;
  const wrongNetwork = isConnected && isWrongNetwork;
  const title = !isConnected ? 'Wallet not connected' : waitingForNetwork ? 'Checking wallet network' : wrongNetwork ? 'Wrong network' : 'Wallet connected';
  const description = !isConnected
    ? 'Connect your wallet to continue. Keep it open and unlocked for approval requests; network confirmation can take longer. Keep this tab open and your laptop awake.'
    : waitingForNetwork
      ? 'Checking the wallet network before opening liquidity.'
      : wrongNetwork
        ? `Switch your wallet to ${ACTIVE_CHAIN.name} to continue.`
        : 'Your wallet is ready. Opening liquidity…';
  const action = () => {
    if (!isConnected) void connect();
    else if (wrongNetwork) void switchNetwork();
    else if (!waitingForNetwork) onClose();
  };
  return (
    <Popup label="Wallet required" onClose={onClose}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-horizon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h12v4" /><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" /><path d="M21 9H6a3 3 0 0 0 0 6h15z" /><circle cx="16.5" cy="12" r=".6" fill="currentColor" /></svg>
      </span>
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      <div className="mt-6 flex gap-2">
        <button onClick={onClose} className="btn-ghost flex-1 py-3 focus-ring">Not now</button>
        <button disabled={isConnecting || isSwitching || waitingForNetwork} onClick={action}
          className="flex-1 rounded-xl bg-horizon px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60 focus-ring">
          {isConnecting || isSwitching ? 'Check your wallet…' : !isConnected ? 'Connect Wallet' : waitingForNetwork ? 'Checking network…' : wrongNetwork ? `Switch to ${ACTIVE_CHAIN.name}` : 'Continue'}
        </button>
      </div>
    </Popup>
  );
}

/* ── 3. drawer: network → pair ─────────────────────────────────────────── */
export function AddLiquidityDrawer({ onClose }: { onClose: () => void }) {
  const [network, setNetwork] = useState<NetworkId>(ACTIVE_EVM_TAB);
  const [evmPairId, setEvmPairId] = useState<string | null>(null);
  const evmPair = EVM_PAIRS.find((p) => p.id === evmPairId) ?? null;

  useEscape(true, onClose);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/35 backdrop-blur-[2px]" onMouseDown={onClose}>
      <aside role="dialog" aria-modal="true" aria-label="Add liquidity" onMouseDown={(e) => e.stopPropagation()}
        className="drawer-in flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-blue-100 bg-panel p-5 shadow-2xl shadow-blue-900/20 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-horizon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2.5 5.2 12a7.8 7.8 0 1 0 13.6 0L12 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M8.8 13.5c1.7 1.5 4.7 1.5 6.4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-bold tracking-tight">Add Liquidity</h2>
            <p className="mt-0.5 text-sm text-slate-600">Choose the network to add liquidity and swap tokens</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-500 transition hover:bg-blue-100/70 hover:text-cloud focus-ring">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* network */}
        <div className="mt-5 grid w-full shrink-0 grid-cols-2 gap-1 rounded-3xl border border-blue-100 bg-blue-50/70 p-1.5" role="tablist" aria-label="Network">
          {NETWORKS.map((n) => {
            const on = network === n.id;
            return (
              <button key={n.id} role="tab" aria-selected={on} onClick={() => { setNetwork(n.id); setEvmPairId(null); }}
                className={`flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-1.5 py-3 text-xs font-semibold sm:text-sm transition focus-ring ${on ? 'border border-horizon bg-panel text-cloud shadow-sm ring-1 ring-horizon/30 dark:bg-blue-200' : 'border border-transparent text-slate-600 hover:text-cloud'}`}>
                <TokenLogo token={n.logo} symbol={n.label.slice(0, 3)} name={n.label} alt="" size={22} />
                <span className="truncate">{n.label}</span>
                {on && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-horizon text-white" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* EVM → V3 flow: create pool, then add liquidity */}
        {network !== ACTIVE_EVM_TAB && (
          <div className="mt-5" role="status">
            <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-horizon text-sm font-bold text-white" aria-hidden="true">i</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">Currently on {ACTIVE_CHAIN.name}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  Switch to {NETWORKS.find((n) => n.id === network)!.fullName} to add liquidity and swap there.
                </p>
              </div>
              {ACTIVE_CHAIN.testnet
                ? <span className="shrink-0 rounded-full bg-horizon/15 px-2.5 py-1 text-[11px] font-semibold text-horizon">Testnet</span>
                : <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Mainnet</span>}
            </div>
            {CONFIGURED_EVM_CHAIN_IDS.includes(TAB_CHAIN_ID[network]) ? (
              <button type="button" onClick={() => switchApp(network)}
                className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-4 font-display text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110 focus-ring">
                <TokenLogo token={NETWORKS.find((n) => n.id === network)!.logo} symbol="" name="" alt="" size={30} />
                <span>Switch to {NETWORKS.find((n) => n.id === network)!.label}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            ) : (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">This network is not configured in your build.</p>
            )}
            <p className="mt-3 text-center text-xs text-slate-500">The page reloads once; then open Add liquidity again. Your wallet will be asked to change network.</p>
          </div>
        )}
        {        network === ACTIVE_EVM_TAB && (
          <>
            {/* 1. pick the pair */}
            <p className="mt-6 text-sm font-medium text-slate-600">Select a pair</p>
            <ul className="mt-2 space-y-2" role="radiogroup" aria-label="Pools">
              {EVM_PAIRS.map((p) => {
                const on = p.id === evmPairId;
                const missing = [p.aId, p.bId].map(getToken).filter((t) => !isTokenConfigured(t)).map((t) => t.symbol);
                return (
                  <li key={p.id}>
                    <button role="radio" aria-checked={on} disabled={missing.length > 0} onClick={() => setEvmPairId(p.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition focus-ring disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-horizon bg-blue-50 ring-1 ring-horizon/40' : 'border-blue-100 hover:bg-blue-50/60'}`}>
                      <LiquidityPairLogo a={p.a} b={p.b} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-display font-semibold">{p.a.symbol}-{p.b.symbol}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {missing.length ? `${missing.join(', ')} not configured in .env` : 'Liquidity pool'}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* 2. after a pair is chosen: add V3 liquidity */}
            {evmPair && (
              <AddLiquidityV3 key={`v3-${evmPair.id}`} initialTokenAId={evmPair.aId} initialTokenBId={evmPair.bId} />
            )}
          </>
        )}

      </aside>
    </div>
  );
}