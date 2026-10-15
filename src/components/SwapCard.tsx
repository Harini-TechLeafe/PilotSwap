
import { formatUnits } from 'viem';
import { ACTIVE_CHAIN } from '../config/chains';
import { useBalances } from '../hooks/useBalances';
import { usePrices } from '../hooks/usePrices';
import { useSwap } from '../hooks/useSwap';
import {
  METAMASK_MISSING,
  WRONG_NETWORK,
  useWallet,
} from '../hooks/useWallet';
import {
  formatAmount,
  formatRate,
  formatUsd,
  sanitizeAmountInput,
} from '../lib/format';
import { METAMASK_DOWNLOAD } from './ConnectWallet';
import SlippageSettings from './SlippageSettings';
import TokenSelector from './TokenSelector';
import TransactionStatus from './TransactionStatus';

const Spinner = () => (
  <span
    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    aria-hidden
  />
);

function Row({
  label,
  value,
  tone = '',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex w-full min-w-0 items-start justify-between gap-3 py-1.5 text-sm">
      <dt className="min-w-0 flex-1 break-words text-slate-500">
        {label}
      </dt>
      <dd
        className={`min-w-0 flex-1 break-words text-right font-medium ${tone}`}
      >
        {value}
      </dd>
    </div>
  );
}

interface SwapCardProps {
  initialFromId?: string;
  embedded?: boolean;
  onSwapped?: () => void;
}

export default function SwapCard({
  initialFromId,
  embedded = false,
  onSwapped,
}: SwapCardProps = {}) {
  const {
    account,
    isConnected,
    isInstalled,
    isConnecting,
    isWrongNetwork,
    walletClient,
    connect,
    switchNetwork,
  } = useWallet();

  const ready = isConnected && !isWrongNetwork;

  const { balances, loading, refresh } = useBalances(
    account,
    ready
  );

  const refreshAll = async () => {
    await refresh();
    onSwapped?.();
  };

  const s = useSwap({
    account,
    walletClient,
    ready,
    balances,
    refreshBalances: refreshAll,
    initialFromId,
  });

  const { prices } = usePrices();

  const { fromToken, toToken, quote, amount } = s;

  const fromBal = balances[fromToken.id] ?? 0n;
  const toBal = balances[toToken.id] ?? 0n;

  const outText = quote
    ? formatAmount(quote.amountOut, toToken.decimals, 6)
    : '';

  const rate =
    quote && quote.amountOut > 0n && amount
      ? Number(
          formatUnits(quote.amountOut, toToken.decimals)
        ) / Number(amount || '1')
      : null;

  const impact = quote ? quote.priceImpactBps / 100 : 0;

  const impactTone =
    impact < 1
      ? 'text-emerald-600'
      : impact < 3
      ? 'text-horizon'
      : 'text-rose-600';

  const overBalance =
    isConnected && !!s.blocker?.startsWith('Insufficient');

  const priceFrom = prices[fromToken.coingeckoId]?.usd;
  const priceTo = prices[toToken.coingeckoId]?.usd;

  const amountNum = Number(amount);

  const marketRate =
    priceFrom && priceTo ? priceFrom / priceTo : null;

  const marketOut =
    !quote && marketRate && amountNum > 0
      ? amountNum * marketRate
      : null;

  const marketOutText =
    marketOut !== null ? formatRate(marketOut) : '';

  const fromUsd =
    priceFrom && amountNum > 0
      ? formatUsd(amountNum * priceFrom)
      : null;

  const toUsd =
    marketOut !== null && priceTo
      ? formatUsd(marketOut * priceTo)
      : quote && priceTo
      ? formatUsd(
          Number(
            formatUnits(quote.amountOut, toToken.decimals)
          ) * priceTo
        )
      : null;

  const shownOut = outText || marketOutText;

  return (
    <section
      id={embedded ? undefined : 'swap'}
      className={
        embedded
          ? 'w-full min-w-0 max-w-full'
          : 'glass w-full min-w-0 max-w-full rounded-3xl p-4 sm:p-6'
      }
    >
      {/* HEADER */}
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
        {embedded ? (
          <h3 className="min-w-0 break-words text-base font-semibold">
            Swap {fromToken.symbol}
          </h3>
        ) : (
          <h2 className="text-xl font-semibold">
            Swap
          </h2>
        )}

        <div className="shrink-0">
          <SlippageSettings
            valueBps={s.slippageBps}
            onChange={s.setSlippageBps}
            disabled={s.busy}
          />
        </div>
      </div>

      <fieldset
        disabled={isWrongNetwork || s.busy}
        className="m-0 w-full min-w-0 max-w-full border-0 p-0"
      >
        {/* FROM */}
        <div className="field w-full min-w-0 max-w-full">
          <div className="flex min-w-0 items-start justify-between gap-2 text-sm text-slate-500">
            <label
              htmlFor="amount-in"
              className="shrink-0"
            >
              From
            </label>

            <span className="min-w-0 break-words text-right">
              Balance:{' '}
              {!isConnected
                ? '—'
                : loading && !balances[fromToken.id]
                ? '…'
                : formatAmount(
                    fromBal,
                    fromToken.decimals,
                    4
                  )}
            </span>
          </div>

          <div className="mt-2 flex w-full min-w-0 items-center gap-2">
            <input
              id="amount-in"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.0"
              value={amount}
              onChange={(e) =>
                s.setAmount(
                  sanitizeAmountInput(e.target.value)
                )
              }
              className={`w-0 min-w-0 flex-1 bg-transparent font-display text-2xl font-semibold outline-none placeholder:text-slate-300 sm:text-3xl ${
                overBalance ? 'text-rose-600' : ''
              }`}
            />

            {isConnected && (
              <button
                type="button"
                onClick={s.setMax}
                className="shrink-0 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-horizon hover:bg-blue-100/70"
              >
                MAX
              </button>
            )}

            <div className="min-w-0 max-w-[48%] shrink-0">
              <TokenSelector
                value={fromToken}
                onChange={s.setFromId}
                balances={balances}
                disabledIds={[toToken.id]}
              />
            </div>
          </div>

          <p className="mt-1 min-w-0 break-words text-sm text-slate-500">
            {fromUsd ? `≈ ${fromUsd}` : '\u00a0'}
          </p>
        </div>

        {/* FLIP */}
        <div className="relative z-10 -my-3 flex justify-center">
          <button
            type="button"
            onClick={s.flip}
            aria-label="Reverse tokens"
            className="rounded-xl border border-blue-100 bg-panel p-2.5 text-lg shadow-lg transition hover:rotate-180 hover:border-horizon/60 focus-ring"
          >
            ⇅
          </button>
        </div>

        {/* TO */}
        <div className="field w-full min-w-0 max-w-full">
          <div className="flex min-w-0 items-start justify-between gap-2 text-sm text-slate-500">
            <span className="shrink-0">
              To (estimated)
            </span>

            <span className="min-w-0 break-words text-right">
              Balance:{' '}
              {isConnected
                ? formatAmount(
                    toBal,
                    toToken.decimals,
                    4
                  )
                : '—'}
            </span>
          </div>

          <div className="mt-2 flex w-full min-w-0 items-center gap-2">
            <output
              className={`w-0 min-w-0 flex-1 truncate font-display text-2xl font-semibold sm:text-3xl ${
                shownOut ? '' : 'text-slate-600'
              } ${
                s.quoting ? 'animate-pulse' : ''
              }`}
            >
              {shownOut || '0.0'}
            </output>

            <div className="min-w-0 max-w-[48%] shrink-0">
              <TokenSelector
                value={toToken}
                onChange={s.setToId}
                balances={balances}
                disabledIds={[fromToken.id]}
              />
            </div>
          </div>

          <p className="mt-1 min-w-0 break-words text-sm text-slate-500">
            {toUsd ? `≈ ${toUsd}` : '\u00a0'}
          </p>
        </div>
      </fieldset>

      {/* MARKET DETAILS */}
      {!quote && marketRate && (
        <dl className="mt-4 w-full min-w-0 max-w-full divide-y divide-blue-100 rounded-2xl border border-blue-100 px-3 py-2 sm:px-4">
          <Row
            label="Market rate"
            value={`1 ${fromToken.symbol} = ${formatRate(
              marketRate
            )} ${toToken.symbol}`}
          />
          <Row
            label="Slippage tolerance"
            value={`${(
              s.slippageBps / 100
            ).toFixed(2)}%`}
          />
        </dl>
      )}

      {/* TRANSACTION DETAILS */}
      {quote && s.minReceived !== null && (
        <dl className="mt-4 w-full min-w-0 max-w-full divide-y divide-blue-100 rounded-2xl border border-blue-100 px-3 py-2 sm:px-4">
          <Row
            label="Exchange rate"
            value={
              rate
                ? `1 ${fromToken.symbol} = ${formatRate(
                    rate
                  )} ${toToken.symbol}`
                : '–'
            }
          />

          <Row
            label="Minimum received"
            value={`${formatAmount(
              s.minReceived,
              toToken.decimals,
              6
            )} ${toToken.symbol}`}
          />

          <Row
            label="Price impact"
            value={
              impact < 0.01
                ? '<0.01%'
                : `${impact.toFixed(2)}%`
            }
            tone={impactTone}
          />

          <Row
            label="Network fee (estimate)"
            value={
              s.feeWei
                ? `~${formatAmount(
                    s.feeWei,
                    18,
                    5
                  )} ETH`
                : '–'
            }
          />

          <Row
            label="Slippage tolerance"
            value={`${(
              s.slippageBps / 100
            ).toFixed(2)}%`}
          />

          <Row
            label="Route"
            value={s.routeSymbols.join(' → ')}
          />
        </dl>
      )}

      {/* PRICE IMPACT WARNING */}
      {impact >= 5 && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-rose-400/10 p-3 text-sm text-rose-700"
        >
          High price impact. You will receive much less
          than the market rate. Consider a smaller amount.
        </p>
      )}

      {/* ACTION BUTTON */}
      <div className="mt-4 w-full min-w-0">
        {!isConnected ? (
          <>
            <button
              className="btn-primary"
              onClick={() => void connect()}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Spinner />
                  Check your wallet…
                </>
              ) : (
                'Connect Wallet'
              )}
            </button>

            {!isInstalled && (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-sm text-rose-700"
              >
                {METAMASK_MISSING}{' '}
                <a
                  href={METAMASK_DOWNLOAD}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-horizon underline"
                >
                  Get MetaMask
                </a>
              </p>
            )}

            <p className="mt-3 text-center text-xs text-slate-500">
              Prices are live market estimates. Connect a
              wallet for an exact on-chain quote.
            </p>
          </>
        ) : isWrongNetwork ? (
          <>
            <p
              role="alert"
              className="mb-3 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-sm text-rose-700"
            >
              {WRONG_NETWORK} ({ACTIVE_CHAIN.name})
            </p>

            <button
              className="btn-primary"
              onClick={() => void switchNetwork()}
            >
              Switch Network
            </button>
          </>
        ) : s.busy ? (
          <button className="btn-primary" disabled>
            <Spinner />
            {s.tx?.phase === 'wallet'
              ? 'Confirm in your wallet…'
              : s.tx?.step === 'approve'
              ? 'Approving…'
              : 'Swapping…'}
          </button>
        ) : s.blocker ? (
          <button className="btn-primary" disabled>
            {s.blocker}
          </button>
        ) : s.needsApproval ? (
          <button
            className="btn-primary"
            onClick={() => void s.approve()}
          >
            Approve {fromToken.symbol}
          </button>
        ) : (
          <button
            className="btn-primary"
            onClick={() => void s.swap()}
          >
            Swap
          </button>
        )}
      </div>

      {/* APPROVAL MESSAGE */}
      {s.needsApproval && !s.blocker && !s.busy && (
        <p className="mt-2 break-words text-center text-xs text-slate-500">
          Step 1 of 2: allow the router to spend exactly{' '}
          {amount} {fromToken.symbol}. Then confirm the swap.
        </p>
      )}

      {/* TRANSACTION STATUS */}
      {s.tx && (
        <TransactionStatus
          tx={s.tx}
          onDismiss={() => s.setTx(null)}
        />
      )}
    </section>
  );
}
