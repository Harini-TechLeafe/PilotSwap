import Logo from '../components/Logo';
import Navbar from '../components/Navbar';
import SwapCard from '../components/SwapCard';
import ChainComingSoon from '../components/ChainComingSoon';
import BitcoinSwapCard from '../components/BitcoinSwapCard';
import { useChain } from '../chains/ChainContext';
import { ACTIVE_CHAIN } from '../config/chains';
import PortfolioCard from '../components/PortfolioCard';
import { useBalances } from '../hooks/useBalances';
import { usePrices } from '../hooks/usePrices';
import { useWallet } from '../hooks/useWallet';

export default function Home() {
  const { chain } = useChain();
  const { account, isConnected, isWrongNetwork } = useWallet();
  const { balances, loading } = useBalances(account, isConnected && !isWrongNetwork);
  const showBalances = isConnected && !isWrongNetwork;
  const { prices } = usePrices();

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
          {chain.family === 'evm' ? <SwapCard /> : chain.family === 'bitcoin' ? <BitcoinSwapCard /> : <ChainComingSoon chain={chain} />}
        </div>

        {/* TOTAL BALANCE */}
        <PortfolioCard balances={showBalances ? balances : {}} balancesLoading={loading} prices={prices} />
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