
import Navbar from '../components/Navbar';
import ChainComingSoon from '../components/ChainComingSoon';
import BitcoinSwapCard from '../components/BitcoinSwapCard';
import SolanaSwapCard from '../components/SolanaSwapCard';
import { useChain } from '../chains/ChainContext';
import PortfolioCard from '../components/PortfolioCard';
import { useBalances } from '../hooks/useBalances';
import { usePrices } from '../hooks/usePrices';
import { useWallet } from '../hooks/useWallet';
import SwapCard from '../components/SwapCard';

export default function Home() {
  const { chain } = useChain();

  const {
    account,
    isConnected,
    isWrongNetwork,
  } = useWallet();

  const { balances, loading } = useBalances(
    account,
    isConnected && !isWrongNetwork
  );

  const showBalances = isConnected && !isWrongNetwork;

  const { prices } = usePrices();

  return (
    <div
      id="top"
      className="w-full min-w-0 max-w-full"
    >
      <Navbar />

      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 sm:px-6">

        {/* HERO SECTION */}
        <div
          className="
            grid
            w-full
            min-w-0
            grid-cols-1
            items-start
            gap-8
            pb-10
            pt-8
            sm:gap-10
            sm:pt-12
            lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]
            lg:pb-12
            lg:pt-20
          "
        >

          {/* LEFT SIDE - HERO CONTENT */}
          <div className="w-full min-w-0 max-w-full lg:pt-8">

            <h1
              className="
                max-w-full
                min-w-0
                break-words
                font-display
                text-[clamp(1.75rem,5vw,3.75rem)]
                font-bold
                leading-[1.1]
                tracking-tight
              "
            >
              Swap Tokens.
              <br />

              <span className="text-altitude">
                Fly Decentralized.
              </span>
            </h1>

            {/* START SWAPPING BUTTON */}
            <div
              className="
                mt-8
                flex
                w-full
                min-w-0
                flex-wrap
                items-center
                gap-4
              "
            >
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();

                  document
                    .getElementById('swap')
                    ?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                    });
                }}
                className="
                  inline-flex
                  max-w-full
                  items-center
                  justify-center
                  rounded-2xl
                  bg-horizon
                  px-6
                  py-3.5
                  text-center
                  font-display
                  font-semibold
                  text-white
                  transition
                  hover:brightness-110
                  focus-ring
                "
              >
                Start Swapping
              </a>

              <span className="min-w-0 text-sm text-slate-500">
                Simple. Secure. Decentralized.
              </span>
            </div>

            {/* DECORATIVE ARROW */}
            <svg
              className="
                mt-12
                hidden
                w-full
                max-w-lg
                text-horizon/40
                lg:block
              "
              viewBox="0 0 480 90"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 80C120 80 150 14 260 24s150 46 216 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="5 7"
                strokeLinecap="round"
              />

              <path
                d="M468 22 478 30 466 36z"
                fill="currentColor"
              />
            </svg>
          </div>

          {/* RIGHT SIDE - SWAP CARD */}
          <div
            id="swap"
            className="
              w-full
              min-w-0
              max-w-full
              self-start
            "
          >
            {chain.family === 'evm' ? (
              <SwapCard />
            ) : chain.family === 'bitcoin' ? (
              <BitcoinSwapCard />
            ) : chain.family === 'solana' ? (
              <SolanaSwapCard />
            ) : (
              <ChainComingSoon chain={chain} />
            )}
          </div>
        </div>

        {/* TOTAL BALANCE */}
        {chain.family === 'evm' && (
          <div className="w-full min-w-0 max-w-full">
            <PortfolioCard
              balances={showBalances ? balances : {}}
              balancesLoading={loading}
              prices={prices}
            />
          </div>
        )}

      </main>
    </div>
  );
}
