import { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatUnits } from 'viem';
import { ACTIVE_CHAIN, NATIVE_SYMBOL, chainName } from '../config/chains';
import { useBalances } from '../hooks/useBalances';
import { usePrices } from '../hooks/usePrices';
import { useSwap } from '../hooks/useSwap';
import {
  METAMASK_MISSING,
  useWallet,
} from '../hooks/useWallet';
import {
  formatAmount,
  formatRate,
  formatUsd,
  sanitizeAmountInput,
} from '../lib/format';
import { METAMASK_DOWNLOAD } from './ConnectWallet';
import MainnetNotice from './MainnetNotice';
import SlippageSettings from './SlippageSettings';
import TokenSelector from './TokenSelector';
import TransactionStatus from './TransactionStatus';

const Spinner = () => (
  <span
    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    aria-hidden
  />
);

/** "Balance: 0.1468 ETH": wallet icon, muted label, bold blue value. */
function BalanceLabel({ symbol, children }: { symbol: string; children: string }) {
  const isNumber = /^[\d.,]+$/.test(children);
  return (
    <span className="inline-flex min-w-0 items-center justify-end gap-1.5 text-right text-sm">
      <svg className="shrink-0 text-slate-500" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h12v4" /><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" /><path d="M21 9H6a3 3 0 0 0 0 6h15z" /><circle cx="16.5" cy="12" r=".6" fill="currentColor" />
      </svg>
      <span className="text-slate-500">Balance:</span>
      <strong className="min-w-0 break-all font-semibold text-horizon">{children}{isNumber ? ` ${symbol}` : ''}</strong>
    </span>
  );
}

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
  initialToId?: string;
  embedded?: boolean;
  onSwapped?: () => void;
}

export default function SwapCard({
  initialFromId,
  initialToId,
  embedded = false,
  onSwapped,
}: SwapCardProps = {}) {
  const {
    account,
    isConnected,
    chainId,
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
    initialToId,
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
  const walletNetwork = chainId === null
    ? 'an unknown network'
    : `${chainName(chainId)} (chain ID ${chainId})`;
  const mismatchKey = `${ACTIVE_CHAIN.id}:${chainId ?? 'unknown'}`;
  const [dismissedNetworkNotice, setDismissedNetworkNotice] = useState<string | null>(null);
  const [networkSwitching, setNetworkSwitching] = useState(false);
  const [networkSwitchError, setNetworkSwitchError] = useState<string | null>(null);
  const showNetworkNotice = isWrongNetwork && dismissedNetworkNotice !== mismatchKey;

  const switchToSelectedNetwork = async () => {
    setNetworkSwitchError(null);
    setNetworkSwitching(true);
    try {
      const switched = await switchNetwork(ACTIVE_CHAIN.id, true);
      if (switched) {
        setDismissedNetworkNotice(mismatchKey);
      } else {
        setNetworkSwitchError(`Could not switch automatically. Select ${ACTIVE_CHAIN.name} in your wallet, then retry.`);
      }
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : '';
      setNetworkSwitchError(`Could not switch to ${ACTIVE_CHAIN.name}.${detail}`);
    } finally {
      setNetworkSwitching(false);
    }
  };

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
    !ACTIVE_CHAIN.testnet && priceFrom && priceTo ? priceFrom / priceTo : null;

  const fromUsd =
    priceFrom && amountNum > 0
      ? formatUsd(amountNum * priceFrom)
      : null;

  const toUsd =
    quote && priceTo
      ? formatUsd(
          Number(
            formatUnits(quote.amountOut, toToken.decimals)
          ) * priceTo
        )
      : null;

  const shownOut = outText;

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
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-horizon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h14M14 4l4 4-4 4" /><path d="M20 16H6M10 12l-4 4 4 4" />
              </svg>
            </span>
            <h2 className="font-display text-2xl font-bold tracking-tight">Swap</h2>
          </div>
        )}

        <div className="shrink-0">
          <SlippageSettings
            valueBps={s.slippageBps}
            onChange={s.setSlippageBps}
            disabled={s.busy}
          />
        </div>
      </div>
      <MainnetNotice className="mb-3" />

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

            <BalanceLabel symbol={fromToken.symbol}>
              {!isConnected
                ? '—'
                : loading && !balances[fromToken.id]
                ? '…'
                : formatAmount(
                    fromBal,
                    fromToken.decimals,
                    4
                  )}
            </BalanceLabel>
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
              className={`w-0 min-w-0 flex-1 bg-transparent font-display !text-3xl font-semibold outline-none placeholder:text-slate-300 ${
                overBalance ? 'text-rose-600' : ''
              }`}
            />

            {isConnected && (
              <button
                type="button"
                onClick={s.setMax}
                aria-pressed={s.isMax}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold transition ${s.isMax ? 'bg-horizon text-white' : 'bg-blue-100 text-horizon hover:bg-blue-200'}`}
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
            className="rounded-xl border border-blue-100 bg-panel p-2.5 text-horizon shadow-lg transition hover:rotate-180 hover:border-horizon/60 focus-ring"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 20V4M4 8l4-4 4 4" /><path d="M16 4v16M12 16l4 4 4-4" />
            </svg>
          </button>
        </div>

        {/* TO */}
        <div className="field w-full min-w-0 max-w-full">
          <div className="flex min-w-0 items-start justify-between gap-2 text-sm text-slate-500">
            <span className="shrink-0">
              To (estimated)
            </span>

            <BalanceLabel symbol={toToken.symbol}>
              {isConnected
                ? formatAmount(
                    toBal,
                    toToken.decimals,
                    4
                  )
                : '—'}
            </BalanceLabel>
          </div>

          <div className="mt-2 flex w-full min-w-0 items-center gap-2">
            <output
              className={`w-0 min-w-0 flex-1 truncate font-display !text-3xl font-semibold ${
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
                  )} ${NATIVE_SYMBOL}`
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
            <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-slate-600">
              Swap is paused until your wallet is on {ACTIVE_CHAIN.name}.
            </p>
            {showNetworkNotice && createPortal(
              <aside
                role="dialog"
                aria-label="Switch wallet network"
                className="toast-in glass fixed bottom-4 right-4 z-[110] w-[min(92vw,360px)] rounded-xl border-l-4 border-l-altitude p-3.5 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-cloud">Switch network</p>
                  <button
                    type="button"
                    className="text-slate-500 hover:text-cloud"
                    aria-label="Dismiss network notice"
                    onClick={() => {
                      setNetworkSwitchError(null);
                      setDismissedNetworkNotice(mismatchKey);
                    }}
                  >
                    ✕
                  </button>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  PilotSwap is set to <strong>{ACTIVE_CHAIN.name}</strong>, but your wallet is on <strong>{walletNetwork}</strong>.
                </p>
                {networkSwitchError && (
                  <p role="alert" className="mt-2 text-sm text-rose-700">
                    {networkSwitchError}
                  </p>
                )}
                <button
                  type="button"
                  className="mt-1.5 inline-block text-sm font-medium text-horizon hover:underline disabled:opacity-60"
                  disabled={networkSwitching}
                  onClick={() => void switchToSelectedNetwork()}
                >
                  {networkSwitching ? 'Switching…' : `Switch wallet to ${ACTIVE_CHAIN.name}`}
                </button>
              </aside>,
              document.body,
            )}
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
          note={s.pendingNote}
          onDismiss={() => s.setTx(null)}
        />
      )}
    </section>
  );
}
