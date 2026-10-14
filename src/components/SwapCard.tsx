import { formatUnits } from 'viem';
import { ACTIVE_CHAIN } from '../config/chains';
import { getConfigIssues } from '../config/contracts';
import { useBalances } from '../hooks/useBalances';
import { usePrices } from '../hooks/usePrices';
import { useDeploymentCheck } from '../hooks/useDeploymentCheck';
import { useSwap } from '../hooks/useSwap';
import { METAMASK_MISSING, WRONG_NETWORK, useWallet } from '../hooks/useWallet';
import { formatAmount, formatRate, formatUsd, sanitizeAmountInput } from '../lib/format';
import { METAMASK_DOWNLOAD } from './ConnectWallet';
import SlippageSettings from './SlippageSettings';
import TokenSelector from './TokenSelector';
import TransactionStatus from './TransactionStatus';

const Spinner = () => <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;

function Row({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right font-medium ${tone}`}>{value}</dd>
    </div>
  );
}

interface SwapCardProps {
  /** Token the "From" side starts on. */
  initialFromId?: string;
  /** Rendered inside the token popup: no outer card, title or page anchor. */
  embedded?: boolean;
  /** Called after a swap confirms, so the parent can refresh its own balances. */
  onSwapped?: () => void;
}

export default function SwapCard({ initialFromId, embedded = false, onSwapped }: SwapCardProps = {}) {
  const { account, isConnected, isInstalled, isConnecting, isWrongNetwork, walletClient, connect, switchNetwork } = useWallet();
  const ready = isConnected && !isWrongNetwork;
  const { balances, loading, refresh } = useBalances(account, ready);
  const refreshAll = async () => { await refresh(); onSwapped?.(); };
  const s = useSwap({ account, walletClient, ready, balances, refreshBalances: refreshAll, initialFromId });
  const deployment = useDeploymentCheck();
  const issues = [...getConfigIssues(), ...deployment.problems];

  // ── Market-price preview (works without a wallet) ───────────────────
  const { prices } = usePrices();

  const { fromToken, toToken, quote, amount } = s;
  const fromBal = balances[fromToken.id] ?? 0n;
  const toBal = balances[toToken.id] ?? 0n;
  const outText = quote ? formatAmount(quote.amountOut, toToken.decimals, 6) : '';
  const rate = quote && quote.amountOut > 0n && amount
    ? Number(formatUnits(quote.amountOut, toToken.decimals)) / Number(amount || '1')
    : null;
  const impact = quote ? quote.priceImpactBps / 100 : 0;
  const impactTone = impact < 1 ? 'text-emerald-600' : impact < 3 ? 'text-horizon' : 'text-rose-600';
  const overBalance = isConnected && !!s.blocker?.startsWith('Insufficient');

  // Market estimate from live CoinGecko prices, used until a wallet is connected.
  const priceFrom = prices[fromToken.coingeckoId]?.usd;
  const priceTo = prices[toToken.coingeckoId]?.usd;
  const amountNum = Number(amount);
  const marketRate = priceFrom && priceTo ? priceFrom / priceTo : null;
  const marketOut = !quote && marketRate && amountNum > 0 ? amountNum * marketRate : null;
  const marketOutText = marketOut !== null ? formatRate(marketOut) : '';
  const fromUsd = priceFrom && amountNum > 0 ? formatUsd(amountNum * priceFrom) : null;
  const toUsd = marketOut !== null && priceTo ? formatUsd(marketOut * priceTo) : quote && priceTo ? formatUsd(Number(formatUnits(quote.amountOut, toToken.decimals)) * priceTo) : null;
  const shownOut = outText || marketOutText;

  return (
    <section id={embedded ? undefined : 'swap'} className={embedded ? '' : 'glass rounded-3xl p-4 sm:p-6'}>
      <div className="mb-4 flex items-center justify-between">
        {embedded ? <h3 className="text-base font-semibold">Swap {fromToken.symbol}</h3> : <h2 className="text-xl font-semibold">Swap</h2>}
        <SlippageSettings valueBps={s.slippageBps} onChange={s.setSlippageBps} disabled={s.busy} />
      </div>

      {/* {issues.length > 0 && (
        <div role="alert" className="mb-4 rounded-2xl border border-horizon/30 bg-horizon/5 p-3.5 text-sm text-slate-700">
          <p className="font-medium text-horizon">Configuration incomplete</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600">
            {issues.map((i) => <li key={i}>{i}</li>)}
          </ul>
          <p className="mt-1.5 text-xs text-slate-500">Fill in your .env file and restart the dev server. Swaps stay disabled until the router is configured.</p>
        </div>
      )} */}

      <fieldset disabled={isWrongNetwork || s.busy} className="m-0 min-w-0 border-0 p-0">
        {/* FROM */}
        <div className="field">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <label htmlFor="amount-in">From</label>
            <span>Balance: {!isConnected ? '—' : loading && !balances[fromToken.id] ? '…' : formatAmount(fromBal, fromToken.decimals, 4)}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              id="amount-in" inputMode="decimal" autoComplete="off" placeholder="0.0" value={amount}
              onChange={(e) => s.setAmount(sanitizeAmountInput(e.target.value))}
              className={`min-w-0 flex-1 bg-transparent font-display text-3xl font-semibold outline-none placeholder:text-slate-300 ${overBalance ? 'text-rose-600' : ''}`}
            />
            {isConnected && <button type="button" onClick={s.setMax} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-horizon hover:bg-blue-100/70">MAX</button>}
            <TokenSelector value={fromToken} onChange={s.setFromId} balances={balances} disabledIds={[toToken.id]} />
          </div>
          <p className="mt-1 h-5 text-sm text-slate-500">{fromUsd ? `≈ ${fromUsd}` : ''}</p>
        </div>

        {/* FLIP */}
        <div className="relative z-10 -my-3 flex justify-center">
          <button type="button" onClick={s.flip} aria-label="Reverse tokens" className="rounded-xl border border-blue-100 bg-panel p-2.5 text-lg shadow-lg transition hover:rotate-180 hover:border-horizon/60 focus-ring">⇅</button>
        </div>

        {/* TO */}
        <div className="field">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>To (estimated)</span>
            <span>Balance: {isConnected ? formatAmount(toBal, toToken.decimals, 4) : '—'}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <output className={`min-w-0 flex-1 truncate font-display text-3xl font-semibold ${shownOut ? '' : 'text-slate-600'} ${s.quoting ? 'animate-pulse' : ''}`}>{shownOut || '0.0'}</output>
            <TokenSelector value={toToken} onChange={s.setToId} balances={balances} disabledIds={[fromToken.id]} />
          </div>
          <p className="mt-1 h-5 text-sm text-slate-500">{toUsd ? `≈ ${toUsd}` : ''}</p>
        </div>
      </fieldset>

      {/* DETAILS */}
      {!quote && marketRate && (
        <dl className="mt-4 divide-y divide-blue-100 rounded-2xl border border-blue-100 px-4 py-2">
          <Row label="Market rate" value={`1 ${fromToken.symbol} = ${formatRate(marketRate)} ${toToken.symbol}`} />
          <Row label="Slippage tolerance" value={`${(s.slippageBps / 100).toFixed(2)}%`} />
        </dl>
      )}
      {quote && s.minReceived !== null && (
        <dl className="mt-4 divide-y divide-blue-100 rounded-2xl border border-blue-100 px-4 py-2">
          <Row label="Exchange rate" value={rate ? `1 ${fromToken.symbol} = ${formatRate(rate)} ${toToken.symbol}` : '–'} />
          <Row label="Minimum received" value={`${formatAmount(s.minReceived, toToken.decimals, 6)} ${toToken.symbol}`} />
          <Row label="Price impact" value={impact < 0.01 ? '<0.01%' : `${impact.toFixed(2)}%`} tone={impactTone} />
          <Row label="Network fee (estimate)" value={s.feeWei ? `~${formatAmount(s.feeWei, 18, 5)} ETH` : '–'} />
          <Row label="Slippage tolerance" value={`${(s.slippageBps / 100).toFixed(2)}%`} />
          <Row label="Route" value={s.routeSymbols.join(' → ')} />
        </dl>
      )}
      {impact >= 5 && <p role="alert" className="mt-3 rounded-xl bg-rose-400/10 p-3 text-sm text-rose-700">High price impact. You will receive much less than the market rate. Consider a smaller amount.</p>}

      {/* ACTION */}
      <div className="mt-4">
        {!isConnected ? (
          <>
            <button className="btn-primary" onClick={() => void connect()} disabled={isConnecting}>
              {isConnecting ? <><Spinner /> Check your wallet…</> : 'Connect Wallet'}
            </button>
            {!isInstalled && (
              <p role="alert" className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-sm text-rose-700">
                {METAMASK_MISSING}{' '}
                <a href={METAMASK_DOWNLOAD} target="_blank" rel="noopener noreferrer" className="font-medium text-horizon underline">Get MetaMask</a>
              </p>
            )}
            <p className="mt-3 text-center text-xs text-slate-500">Prices are live market estimates. Connect a wallet for an exact on-chain quote.</p>
          </>
        ) : isWrongNetwork ? (
          <>
            <p role="alert" className="mb-3 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-sm text-rose-700">{WRONG_NETWORK} ({ACTIVE_CHAIN.name})</p>
            <button className="btn-primary" onClick={() => void switchNetwork()}>Switch Network</button>
          </>
        ) : s.busy ? (
          <button className="btn-primary" disabled><Spinner /> {s.tx?.phase === 'wallet' ? 'Confirm in your wallet…' : s.tx?.step === 'approve' ? 'Approving…' : 'Swapping…'}</button>
        ) : s.blocker ? (
          <button className="btn-primary" disabled>{s.blocker}</button>
        ) : s.needsApproval ? (
          <button className="btn-primary" onClick={() => void s.approve()}>Approve {fromToken.symbol}</button>
        ) : (
          <button className="btn-primary" onClick={() => void s.swap()}>Swap</button>
        )}
      </div>

      {s.needsApproval && !s.blocker && !s.busy && (
        <p className="mt-2 text-center text-xs text-slate-500">Step 1 of 2: allow the router to spend exactly {amount} {fromToken.symbol}. Then confirm the swap.</p>
      )}

      {s.tx && <TransactionStatus tx={s.tx} onDismiss={() => s.setTx(null)} />}
    </section>
  );
}
