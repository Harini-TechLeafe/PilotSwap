import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import SwapCard from '../components/SwapCard';
import MainnetNotice from '../components/MainnetNotice';
import TokenIcon from '../components/TokenIcon';
import { ACTIVE_CHAIN, ENV_PREFIX, IS_MAINNET, NATIVE_SYMBOL, chainName, explorerAddressUrl } from '../config/chains';
import { getToken } from '../config/tokens';
import { Link } from '../lib/router';

const shorten = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

/** "Buy USDT": the normal swap engine with the "To" token locked to USDT, on whichever network the app is on. */
export default function BuyUsdt() {
  const usdt = getToken('USDT');
  const configured = usdt.address !== null;
  const network = chainName(ACTIVE_CHAIN.id);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Buy USDT | PilotSwap';
    return () => { document.title = previous; };
  }, []);

  const copy = async () => {
    if (!usdt.address) return;
    try {
      await navigator.clipboard.writeText(usdt.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked: the address is still shown in full on hover */ }
  };

  const explorer = usdt.address ? explorerAddressUrl(usdt.address) : null;

  return (
    <div className="w-full min-w-0 max-w-full">
      <Navbar />
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-24 sm:px-6 lg:pb-12">
        <div className="grid w-full min-w-0 grid-cols-1 items-start gap-8 pb-10 pt-8 sm:gap-10 sm:pt-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:pt-16">
          {/* LEFT: what / how */}
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-horizon">
              <TokenIcon token={usdt} size={18} /> USDT on {network}
            </span>
            <h1 className="mt-4 font-display text-[clamp(1.75rem,5vw,3.25rem)] font-bold leading-[1.1] tracking-tight">
              Buy USDT.<br /><span className="text-altitude">In a few clicks.</span>
            </h1>
            <p className="mt-4 max-w-xl text-slate-600">
              Pay with {NATIVE_SYMBOL}, USDC or DAI and receive USDT straight to your wallet. The swap runs on {network} and finishes in one transaction.
            </p>

            <ol className="mt-6 space-y-3">
              {[
                ['Connect your wallet', `Use the Connect Wallet button and stay on ${network}.`],
                ['Enter how much you want to pay', `The USDT you receive is quoted live. Change “From” to pay with another token.`],
                ['Confirm in your wallet', 'Approve once if needed, then confirm the swap. USDT arrives as soon as the transaction is mined.'],
              ].map(([title, text], i) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-horizon text-sm font-bold text-white" aria-hidden="true">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-sm text-slate-600">{text}</p>
                  </div>
                </li>
              ))}
            </ol>

            {/* token details */}
            <div className="glass mt-6 rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">USDT token on {network}</p>
              {usdt.address ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <code className="break-all rounded-lg bg-blue-50 px-2 py-1 font-mono text-xs" title={usdt.address}>{shorten(usdt.address)}</code>
                  <button type="button" onClick={() => void copy()} className="rounded-lg border border-blue-100 px-2.5 py-1 text-xs font-semibold text-horizon transition hover:bg-blue-50 focus-ring">
                    {copied ? 'Copied ✓' : 'Copy address'}
                  </button>
                  {explorer && <a href={explorer} target="_blank" rel="noreferrer" className="text-xs font-semibold text-horizon underline">View on explorer</a>}
                  <span className="text-xs text-slate-500">{usdt.decimals} decimals</span>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">Not configured on this network yet (see the setup steps on the right).</p>
              )}
              {IS_MAINNET
                ? <MainnetNotice className="mt-3" />
                : <p className="mt-3 text-xs text-slate-500">This is a test network: USDT here is a test token with no real value.</p>}
            </div>
          </div>

          {/* RIGHT: swap card or setup */}
          <div className="w-full min-w-0 self-start">
            {configured ? (
              <SwapCard initialFromId="ETH" initialToId="USDT" />
            ) : (
              <section className="glass rounded-3xl p-5 sm:p-6" aria-label="USDT setup">
                <h2 className="font-display text-xl font-bold">USDT is not set up on {network}</h2>
                <p className="mt-1 text-sm text-slate-600">Deploy your own test USDT once, then buying works exactly like on the other networks.</p>
                <ol className="mt-4 space-y-3 text-sm text-slate-700">
                  <li><strong>1.</strong> Deploy <code className="rounded bg-blue-50 px-1">contracts/MockUSDT.sol</code> (Remix + your wallet on {network}). Constructor argument: <code className="rounded bg-blue-50 px-1">{ACTIVE_CHAIN.id === 97 ? '18' : '6'}</code> decimals.</li>
                  <li><strong>2.</strong> Put the deployed address in <code className="rounded bg-blue-50 px-1">.env</code>: <code className="break-all rounded bg-blue-50 px-1">{ENV_PREFIX}USDT_ADDRESS=0x…</code> and restart <code className="rounded bg-blue-50 px-1">npm run dev</code>.</li>
                  <li><strong>3.</strong> Call <code className="rounded bg-blue-50 px-1">faucet()</code> on the contract to get 1,000 test USDT.</li>
                  <li><strong>4.</strong> Create the pool: Liquidity → Add Liquidity → {NATIVE_SYMBOL} / USDT. After that, this page swaps {NATIVE_SYMBOL} → USDT.</li>
                </ol>
                <Link to="/liquidity" className="mt-5 inline-flex rounded-xl bg-horizon px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 focus-ring">Go to Liquidity</Link>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
