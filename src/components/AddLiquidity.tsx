import { useEffect, useMemo, useState, type ReactNode } from 'react';
import LiquidityPairLogo, { type PairToken } from './LiquidityPairLogo';
import TokenLogo from './TokenLogo';
import { useWallet } from '../hooks/useWallet';

/* ──────────────────────────────────────────────────────────────────────────
 *  Add Liquidity flow
 *   1. <AddLiquidityButton/> sits in the page header.
 *   2. Wallet NOT connected  → <WalletRequiredModal/> ("connect to add liquidity").
 *   3. Wallet connected      → <AddLiquidityDrawer/>: pick a network, pick a pair
 *                              (USDC / USDT based), then enter the deposit volume.
 *   4. Press "Add Liquidity" → <PoolStatusModal/> with the pool-status notice.
 *
 *  NOTE: prices and pool stats below are DEMO values. Replace PRICE_USD and PAIRS
 *  with a real price feed / pool indexer when the pools are live.
 * ────────────────────────────────────────────────────────────────────────── */

export type NetworkId = 'evm' | 'solana' | 'bitcoin';

const USDC_EVM = '0xA0b86991c6218b36c1d19D4a2E9Eb0cE3606eB48';
const USDT_EVM = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDC_SOL = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_SOL = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

interface LpToken extends PairToken { decimals: number }

const T = {
  ETH: { symbol: 'ETH', name: 'Ether', decimals: 6, token: { family: 'evm', chainId: 1, address: null } },
  USDC_E: { symbol: 'USDC', name: 'USD Coin', decimals: 2, token: { family: 'evm', chainId: 1, address: USDC_EVM } },
  USDT_E: { symbol: 'USDT', name: 'Tether USD', decimals: 2, token: { family: 'evm', chainId: 1, address: USDT_EVM } },
  SOL: { symbol: 'SOL', name: 'Solana', decimals: 4, token: { family: 'solana', mint: null } },
  USDC_S: { symbol: 'USDC', name: 'USD Coin', decimals: 2, token: { family: 'solana', mint: USDC_SOL } },
  USDT_S: { symbol: 'USDT', name: 'Tether USD', decimals: 2, token: { family: 'solana', mint: USDT_SOL } },
  BTC: { symbol: 'BTC', name: 'Bitcoin', decimals: 8, token: { family: 'bitcoin' } },
  USDC_B: { symbol: 'USDC', name: 'USD Coin', decimals: 2, token: { family: 'evm', chainId: 1, address: USDC_EVM } },
  USDT_B: { symbol: 'USDT', name: 'Tether USD', decimals: 2, token: { family: 'evm', chainId: 1, address: USDT_EVM } },
} satisfies Record<string, LpToken>;

/** Demo USD prices used only to keep the two deposit amounts in ratio. */
const PRICE_USD: Record<string, number> = { ETH: 3200, SOL: 150, BTC: 65000, USDC: 1, USDT: 1 };

interface PairDef {
  id: string;
  a: LpToken;
  b: LpToken;
  fee: string;
  vol24: number;
  tvl: number;
  apr: number;
}

const PAIRS: Record<NetworkId, PairDef[]> = {
  evm: [
    { id: 'eth-usdc', a: T.ETH, b: T.USDC_E, fee: '0.3%', vol24: 3.2e6, tvl: 12.8e6, apr: 27.4 },
    { id: 'eth-usdt', a: T.ETH, b: T.USDT_E, fee: '0.3%', vol24: 2.1e6, tvl: 9.4e6, apr: 24.8 },
    { id: 'usdc-usdt', a: T.USDC_E, b: T.USDT_E, fee: '0.01%', vol24: 5.6e6, tvl: 18.2e6, apr: 6.3 },
  ],
  solana: [
    { id: 'sol-usdc', a: T.SOL, b: T.USDC_S, fee: '0.25%', vol24: 9.6e6, tvl: 18.4e6, apr: 47.6 },
    { id: 'sol-usdt', a: T.SOL, b: T.USDT_S, fee: '0.25%', vol24: 3.9e6, tvl: 7.1e6, apr: 41.2 },
    { id: 'usdc-usdt-sol', a: T.USDC_S, b: T.USDT_S, fee: '0.01%', vol24: 4.4e6, tvl: 11.6e6, apr: 5.8 },
  ],
  bitcoin: [
    { id: 'btc-usdc', a: T.BTC, b: T.USDC_B, fee: '0.3%', vol24: 6.8e6, tvl: 22.5e6, apr: 18.9 },
    { id: 'btc-usdt', a: T.BTC, b: T.USDT_B, fee: '0.3%', vol24: 5.2e6, tvl: 16.7e6, apr: 17.5 },
  ],
};

const NETWORKS: { id: NetworkId; label: string; badge: string }[] = [
  { id: 'evm', label: 'Ethereum', badge: 'ETH' },
  { id: 'solana', label: 'Solana', badge: 'SOL' },
  { id: 'bitcoin', label: 'Bitcoin', badge: 'BTC' },
];

function compact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

/** Format a computed amount: fixed decimals, trailing zeros trimmed. */
function fmtAmount(v: number, decimals: number): string {
  if (!Number.isFinite(v) || v <= 0) return '';
  return v.toFixed(decimals).replace(/\.?0+$/, '');
}

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
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
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
  const { connect, isConnecting } = useWallet();
  return (
    <Popup label="Wallet required" onClose={onClose}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-horizon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h12v4" /><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" /><path d="M21 9H6a3 3 0 0 0 0 6h15z" /><circle cx="16.5" cy="12" r=".6" fill="currentColor" /></svg>
      </span>
      <h2 className="mt-4 text-xl font-semibold">Wallet not connected</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">Please connect your wallet before adding liquidity. Once connected, you can pick a pool and start earning yield.</p>
      <div className="mt-6 flex gap-2">
        <button onClick={onClose} className="btn-ghost flex-1 py-3 focus-ring">Not now</button>
        <button disabled={isConnecting} onClick={() => { onClose(); void connect(); }}
          className="flex-1 rounded-xl bg-horizon px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60 focus-ring">
          {isConnecting ? 'Check your wallet…' : 'Connect Wallet'}
        </button>
      </div>
    </Popup>
  );
}

/* ── 4. pool-status popup (shown when "Add Liquidity" is submitted) ─────── */
export function PoolStatusModal({ onClose }: { onClose: () => void }) {
  return (
    <Popup label="Pool status" onClose={onClose}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>
      </span>
      <h2 className="mt-4 text-xl font-semibold">Pool Status: Operational</h2>
      <p role="alert" className="mt-2 text-sm leading-relaxed text-slate-600">
        Liquidity provision and pool metrics are running smoothly. Please note that trading/swapping is temporarily disabled for maintenance/updates and will resume shortly.
      </p>
      <button onClick={onClose} className="btn-primary mt-6 !py-3 !text-sm focus-ring">Got it</button>
    </Popup>
  );
}

/* ── 3. drawer: network → pair → volume ─────────────────────────────────── */
export function AddLiquidityDrawer({ onClose }: { onClose: () => void }) {
  const { account, activeSolana, activeBitcoin } = useWallet();
  const [statusOpen, setStatusOpen] = useState(false);
  // Open on a network the user is actually connected to.
  const [network, setNetwork] = useState<NetworkId>(account ? 'evm' : activeSolana ? 'solana' : activeBitcoin ? 'bitcoin' : 'evm');
  const [pairId, setPairId] = useState<string | null>(null);
  const [amtA, setAmtA] = useState('');
  const [amtB, setAmtB] = useState('');

  useEscape(!statusOpen, onClose);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const pair = useMemo(() => PAIRS[network].find((p) => p.id === pairId) ?? null, [network, pairId]);
  const rate = pair ? PRICE_USD[pair.a.symbol] / PRICE_USD[pair.b.symbol] : 0; // 1 A = rate B

  const pickNetwork = (n: NetworkId) => { setNetwork(n); setPairId(null); setAmtA(''); setAmtB(''); };
  const pickPair = (id: string) => { setPairId(id); setAmtA(''); setAmtB(''); };

  const onChange = (side: 'a' | 'b', raw: string) => {
    if (!pair || !/^\d*\.?\d*$/.test(raw)) return;
    const n = parseFloat(raw);
    if (side === 'a') {
      setAmtA(raw);
      setAmtB(raw === '' || !(n > 0) ? '' : fmtAmount(n * rate, pair.b.decimals));
    } else {
      setAmtB(raw);
      setAmtA(raw === '' || !(n > 0) ? '' : fmtAmount(n / rate, pair.a.decimals));
    }
  };

  const hasAmount = parseFloat(amtA) > 0 && parseFloat(amtB) > 0;
  const usdValue = pair && parseFloat(amtA) > 0 ? parseFloat(amtA) * PRICE_USD[pair.a.symbol] * 2 : 0;

  const cta = !pair ? 'Select a pair' : !hasAmount ? 'Enter an amount' : 'Add Liquidity';

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-900/35 backdrop-blur-[2px]" onMouseDown={onClose}>
      <aside role="dialog" aria-modal="true" aria-label="Add liquidity" onMouseDown={(e) => e.stopPropagation()}
        className="drawer-in flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-blue-100 bg-white p-5 shadow-2xl shadow-blue-900/20 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Add liquidity</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-blue-100/70 hover:text-cloud focus-ring">✕</button>
        </div>

        {/* network */}
        <div className="mt-5 inline-flex w-full rounded-full bg-blue-50 p-1" role="tablist" aria-label="Network">
          {NETWORKS.map((n) => (
            <button key={n.id} role="tab" aria-selected={network === n.id} onClick={() => pickNetwork(n.id)}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition focus-ring ${network === n.id ? 'bg-white text-cloud shadow' : 'text-slate-500 hover:text-cloud'}`}>
              {n.label}
            </button>
          ))}
        </div>

        {/* pair */}
        <p className="mt-6 text-sm font-medium text-slate-600">Select a pair</p>
        <ul className="mt-2 space-y-2" role="radiogroup" aria-label="Pools">
          {PAIRS[network].map((p) => {
            const on = p.id === pairId;
            return (
              <li key={p.id}>
                <button role="radio" aria-checked={on} onClick={() => pickPair(p.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition focus-ring ${on ? 'border-horizon bg-blue-50 ring-1 ring-horizon/40' : 'border-blue-100 hover:bg-blue-50/60'}`}>
                  <LiquidityPairLogo a={p.a} b={p.b} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display font-semibold">{p.a.symbol}-{p.b.symbol}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs">
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-horizon">{p.fee}</span>
                      <span className="text-slate-500">TVL ${compact(p.tvl)}</span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold tabular-nums text-emerald-600">{p.apr.toFixed(2)}%</span>
                    <span className="text-xs text-slate-500">APR</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* volume (deposit amounts) */}
        {pair && (
          <section className="mt-6" aria-label="Deposit volume">
            <p className="text-sm font-medium text-slate-600">Deposit volume</p>
            <div className="mt-2 space-y-2">
              {([['a', pair.a, amtA], ['b', pair.b, amtB]] as const).map(([side, tok, val]) => (
                <label key={side} className="field flex items-center gap-3">
                  <input inputMode="decimal" autoComplete="off" placeholder="0.0" value={val} onChange={(e) => onChange(side, e.target.value)} aria-label={`${tok.symbol} amount`}
                    className="min-w-0 flex-1 bg-transparent font-display text-2xl font-semibold tabular-nums outline-none placeholder:text-slate-300" />
                  <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-blue-100">
                    <TokenLogo token={tok.token} symbol={tok.symbol} name={tok.name} size={22} />
                    {tok.symbol}
                  </span>
                </label>
              ))}
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              {[['24H volume', `$${compact(pair.vol24)}`], ['Pool TVL', `$${compact(pair.tvl)}`], ['Your deposit', usdValue > 0 ? `$${compact(usdValue)}` : '—']].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-blue-50/70 px-2 py-2.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              1 {pair.a.symbol} ≈ {rate >= 1 ? rate.toLocaleString('en-US', { maximumFractionDigits: 2 }) : rate.toFixed(6)} {pair.b.symbol} (indicative demo rate)
            </p>
          </section>
        )}

        <div className="mt-auto pt-6">
          <button className="btn-primary focus-ring" disabled={!pair || !hasAmount} onClick={() => setStatusOpen(true)}>{cta}</button>
        </div>
      </aside>

      {statusOpen && <PoolStatusModal onClose={() => setStatusOpen(false)} />}
    </div>
  );
}
