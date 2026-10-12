import Logo from '../components/Logo';
import Navbar from '../components/Navbar';
import SwapCard from '../components/SwapCard';
import ChainComingSoon from '../components/ChainComingSoon';
import { useChain } from '../chains/ChainContext';
import { ACTIVE_CHAIN, explorerAddressUrl } from '../config/chains';
import { useCallback, useState } from 'react';
import { TOKENS, type Token } from '../config/tokens';
import TokenModal from '../components/TokenModal';
import PortfolioCard from '../components/PortfolioCard';
import TokenIcon from '../components/TokenIcon';
import { useBalances } from '../hooks/useBalances';
import { usePrices } from '../hooks/usePrices';
import { useWallet } from '../hooks/useWallet';
import { formatAmount, formatUsd, shortAddress } from '../lib/format';

export default function Home() {
  const { chain } = useChain();
  const { account, isConnected, isWrongNetwork } = useWallet();
  const { balances, loading, refresh: refreshBalances } = useBalances(account, isConnected && !isWrongNetwork);
  const showBalances = isConnected && !isWrongNetwork;
  const { prices, loading: pricesLoading, error: pricesError, updatedAt, refresh: refreshPrices } = usePrices();
  const [activeToken, setActiveToken] = useState<Token | null>(null);
  const closeModal = useCallback(() => setActiveToken(null), []);

  return (
    <div id="top">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* HERO */}
        <div className="grid items-start gap-10 pb-10 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:pb-12 lg:pt-20">
          <div className="lg:pt-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm text-slate-600">
              <span className="h-2 w-2 rounded-full bg-horizon" /> Live on {ACTIVE_CHAIN.name}
            </p>
            <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Swap Tokens.<br />
              <span className="text-altitude">Fly Decentralized.</span>
            </h1>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a href="#swap" className="rounded-2xl bg-horizon px-6 py-3.5 font-display font-semibold text-white transition hover:brightness-110 focus-ring">Start Swapping</a>
              <span className="text-sm text-slate-500">Simple. Secure. Decentralized.</span>
            </div>
            <svg className="mt-12 hidden w-full max-w-lg text-horizon/40 lg:block" viewBox="0 0 480 90" fill="none" aria-hidden>
              <path d="M4 80C120 80 150 14 260 24s150 46 216 6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 7" strokeLinecap="round" />
              <path d="M468 22 478 30 466 36z" fill="currentColor" />
            </svg>
          </div>
          {chain.family === 'evm' ? <SwapCard /> : <ChainComingSoon chain={chain} />}
        </div>

        {/* TOTAL BALANCE */}
        <PortfolioCard balances={showBalances ? balances : {}} balancesLoading={loading} prices={prices} />

        {/* TOKENS */}
        <section id="tokens" className="border-t border-blue-100/70 py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Supported tokens</h2>
              <p className="mt-2 max-w-xl text-slate-500">Testnet tokens only. Check every address on the block explorer before you trust it. To add a token, edit <code className="rounded bg-blue-100/70 px-1.5 py-0.5 text-sm">src/config/tokens.ts</code>.</p>
            </div>
            <p className="text-sm text-slate-500" aria-live="polite">
              {pricesError
                ? <>Prices unavailable. <button type="button" onClick={() => void refreshPrices()} className="text-horizon hover:underline focus-ring">Retry</button></>
                : updatedAt ? `Live prices from CoinGecko · updated ${updatedAt.toLocaleTimeString()}` : 'Loading live prices…'}
            </p>
          </div>

          <ul className="glass mt-6 divide-y divide-blue-100 overflow-hidden rounded-2xl">
            {TOKENS.map((t) => {
              const url = t.address ? explorerAddressUrl(t.address) : null;
              const price = prices[t.coingeckoId];
              const change = price?.change24h;
              const up = (change ?? 0) >= 0;
              return (
                <li
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${t.symbol}: balance, send, receive and swap`}
                  onClick={() => setActiveToken(t)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveToken(t); } }}
                  className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-4 transition hover:bg-blue-50/80 focus-ring sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)] sm:px-5">
                  {/* Token */}
                  <div className="flex min-w-0 items-center gap-3">
                    <TokenIcon token={t} size={40} />
                    <div className="min-w-0">
                      <p className="font-display text-lg font-semibold leading-tight">{t.symbol}</p>
                      <p className="truncate text-sm text-slate-500">{t.name}</p>
                    </div>
                  </div>

                  {/* Live price */}
                  <div className="text-right sm:text-left">
                    <p className="font-display text-lg font-semibold tabular-nums">
                      {price ? formatUsd(price.usd) : pricesLoading ? <span className="text-slate-500">Loading…</span> : <span className="text-slate-500">—</span>}
                    </p>
                    {change !== undefined && (
                      <p className={`text-sm tabular-nums ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)}% <span className="text-slate-500">24h</span>
                      </p>
                    )}
                    {t.id === 'TBTC' && <p className="text-xs text-slate-500">Reference: real BTC price</p>}
                  </div>

                  {/* Address / balance */}
                  <div className="col-span-2 text-sm sm:col-span-1 sm:text-right">
                    <p>
                      {t.isNative ? <span className="text-slate-600">Native coin</span>
                        : t.address ? <a href={url ?? '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-mono text-horizon hover:underline">{shortAddress(t.address)}</a>
                        : <span className="text-slate-500">Not configured</span>}
                    </p>
                    {showBalances && (t.isNative || t.address) && (
                      <p className="mt-1 text-slate-500">
                        Balance:{' '}
                        <span className="font-medium text-cloud">
                          {balances[t.id] === undefined
                            ? (loading ? 'Loading…' : '—')
                            : `${formatAmount(balances[t.id], t.decimals)} ${t.symbol}`}
                        </span>
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm text-slate-500">Tap any token to see your balance and send, receive or swap it.</p>
        </section>

        {activeToken && (
          <TokenModal
            key={activeToken.id}
            token={activeToken}
            balances={balances}
            balancesLoading={loading}
            refreshBalances={refreshBalances}
            prices={prices}
            onClose={closeModal}
          />
        )}
      </main>

      <footer className="border-t border-blue-100/70 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo />
          <p>Testnet software. Do not use real funds.</p>
        </div>
      </footer>
    </div>
  );
}
