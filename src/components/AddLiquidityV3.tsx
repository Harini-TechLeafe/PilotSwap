import { useEffect, useMemo, useState } from 'react';
import { CHAIN_LABEL, DEFAULT_FEE, FEE_TIERS, getConfigIssues } from '../config/contracts';
import { TOKENS } from '../config/tokens';
import { useBalances } from '../hooks/useBalances';
import { useV3Liquidity } from '../hooks/useV3Liquidity';
import { useWallet } from '../hooks/useWallet';
import { ACTIVE_CHAIN, IS_BNB_CHAIN, IS_MAINNET, NATIVE_SYMBOL, explorerTxUrl } from '../config/chains';
import { usePrices } from '../hooks/usePrices';
import { formatAmount, formatUsd, sanitizeAmountInput } from '../lib/format';
import { RANGE_OPTIONS, type RangeMode } from '../lib/v3';
import TokenIcon from './TokenIcon';
import LoadingDots from './LoadingDots';
import MainnetNotice from './MainnetNotice';

type StepState = 'complete' | 'active' | 'waiting';

/** One numbered step of the liquidity progress dialog: marker + connector line + card with a status badge. */
function StepCard({ state, number, title, description, badge, last = false }: {
  state: StepState; number: string; title: string; description: string; badge: string; last?: boolean;
}) {
  const card = state === 'complete' ? 'border-emerald-600/30 bg-emerald-50' : state === 'active' ? 'border-horizon/60 bg-blue-50 ring-1 ring-horizon/20' : 'border-slate-200 bg-slate-50';
  const pill = state === 'complete' ? 'border border-emerald-600/30 bg-emerald-50 text-emerald-700' : state === 'active' ? 'bg-horizon text-white' : 'border border-slate-200 bg-panel text-slate-600';
  const marker = state === 'complete' ? 'bg-emerald-500 text-white' : state === 'active' ? 'bg-horizon text-white' : 'border-2 border-slate-300 bg-panel text-slate-500';
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${marker}`} aria-hidden="true">
          {state === 'complete' ? '✓' : number}
        </span>
        {!last && <span className={`mt-1 w-0.5 flex-1 rounded ${state === 'complete' ? 'bg-emerald-600/50' : 'bg-slate-200'}`} aria-hidden="true" />}
      </div>
      <div className={`mb-3 flex min-w-0 flex-1 items-start gap-3 rounded-2xl border p-3.5 ${card}`}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{description}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold ${pill}`}>
          {state === 'complete' ? <span aria-hidden="true">✓</span> : state === 'active' ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : <span aria-hidden="true">◷</span>}
          {badge}{state === 'active' && <LoadingDots />}
        </span>
      </div>
    </li>
  );
}

/**
 * V3 "Create pool → Add liquidity" panel (EVM tab of the Add Liquidity drawer).
 * Step 1 of the V3 flow: a pool must exist and hold liquidity before anyone can quote or swap.
 */
export default function AddLiquidityV3({ initialTokenAId = 'WETH', initialTokenBId = 'USDC' }: { initialTokenAId?: string; initialTokenBId?: string } = {}) {
  const { account, isConnected, isWrongNetwork, switchNetwork, isSwitching, connect, isConnecting, selectedWallet } = useWallet();
  const ready = isConnected && !isWrongNetwork;
  const { balances, loading: balancesLoading, error: balancesError, refresh } = useBalances(account, ready);
  // Unset optional tokens (DAI) just stay disabled; only real blockers are shown here.
  const issues = getConfigIssues().filter((i) => !i.startsWith('No address configured'));

  const [tokenAId, setTokenAId] = useState(initialTokenAId);
  const [tokenBId, setTokenBId] = useState(initialTokenBId);
  // Stablecoin pairs (USDC/DAI/USDT) trade in a tight range, so they start on a low-fee tier instead of the standard one.
  const STABLES = ['USDC', 'DAI', 'USDT'];
  // On the mainnets (Ethereum, BNB Chain) the deep stablecoin pools use the 0.01% tier; on the testnets the 0.05% tier is the default.
  const STABLE_FEE = IS_MAINNET ? 100 : 500;
  const defaultFeeFor = (x: string, y: string) => (STABLES.includes(x) && STABLES.includes(y) && FEE_TIERS.some((t) => t.fee === STABLE_FEE) ? STABLE_FEE : DEFAULT_FEE);
  const [fee, setFee] = useState<number>(() => defaultFeeFor(initialTokenAId, initialTokenBId));
  const [range, setRange] = useState<RangeMode>('full');
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [lastEditedSide, setLastEditedSide] = useState<'a' | 'b' | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [balancePopupOpen, setBalancePopupOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [pendingSlow, setPendingSlow] = useState(false);
  const [walletSlow, setWalletSlow] = useState(false);
  const [progressHidden, setProgressHidden] = useState(false);

  const v = useV3Liquidity({ tokenAId, tokenBId, fee, range, amountA, amountB, balances, balancesLoading, refreshBalances: refresh });
  const { pool, pairedRatio, tokenA, tokenB, status, busy, blocker } = v;
  const { prices } = usePrices();
  const amountRatio = useMemo(() => {
    if (pool.exists) return pairedRatio;
    const priceA = prices[tokenA.coingeckoId]?.usd;
    const priceB = prices[tokenB.coingeckoId]?.usd;
    return priceA && priceB && priceA > 0 && priceB > 0 ? priceA / priceB : null;
  }, [pool.exists, pairedRatio, prices, tokenA.coingeckoId, tokenB.coingeckoId]);

  useEffect(() => {
    if (status.phase === 'idle' || status.phase === 'success' || status.phase === 'error') setProgressHidden(false);
  }, [status.phase]);

  useEffect(() => {
    if (status.phase === 'pending') {
      setPendingSlow(false);
      const timer = window.setTimeout(() => setPendingSlow(true), 30_000);
      return () => window.clearTimeout(timer);
    }
    setPendingSlow(false);
  }, [status.phase, status.phase === 'pending' ? status.hash : undefined]);

  useEffect(() => {
    if (status.phase === 'wallet') {
      setWalletSlow(false);
      const timer = window.setTimeout(() => setWalletSlow(true), 30_000);
      return () => window.clearTimeout(timer);
    }
    setWalletSlow(false);
  }, [status.phase, status.phase === 'wallet' ? status.label : undefined]);

  useEffect(() => {
    if (lastEditedSide === 'a') {
      const value = Number(amountA);
      setAmountB(amountRatio && value > 0
        ? (value * amountRatio).toFixed(tokenB.decimals).replace(/\.?0+$/, '')
        : '');
    } else if (lastEditedSide === 'b') {
      const value = Number(amountB);
      setAmountA(amountRatio && value > 0
        ? (value / amountRatio).toFixed(tokenA.decimals).replace(/\.?0+$/, '')
        : '');
    }
  }, [lastEditedSide, amountA, amountB, amountRatio, tokenA.decimals, tokenB.decimals]);

  const editA = (raw: string) => {
    setAmountA(sanitizeAmountInput(raw));
    setLastEditedSide('a');
  };
  const editB = (raw: string) => {
    setAmountB(sanitizeAmountInput(raw));
    setLastEditedSide('b');
  };

  const pickToken = (side: 'a' | 'b', id: string) => {
    setAmountA(''); setAmountB('');
    setLastEditedSide(null);
    v.setStatus({ phase: 'idle' });
    const nextA = side === 'a' ? id : (id === tokenAId ? tokenBId : tokenAId);
    const nextB = side === 'b' ? id : (id === tokenBId ? tokenAId : tokenBId);
    setFee(defaultFeeFor(nextA, nextB));
    if (side === 'a') { setTokenAId(id); if (id === tokenBId) setTokenBId(tokenAId); }
    else { setTokenBId(id); if (id === tokenAId) setTokenAId(tokenBId); }
  };

  const openReview = async () => {
    // The wallet can disconnect while the form is open: ask to connect again instead of opening a review that cannot be sent.
    if (!isConnected || !account) { void connect(); return; }
    if (blocker || busy) return;
    setReviewOpen(true);
    setReviewLoading(true);
    await v.loadPool();
    setReviewLoading(false);
  };

  const feeLabel = FEE_TIERS.find((item) => item.fee === fee)?.label ?? `${fee / 10_000}%`;
  const insufficientBalance = blocker === `Insufficient ${tokenA.symbol} balance`
    ? { token: tokenA, amount: amountA }
    : blocker === `Insufficient ${tokenB.symbol} balance`
      ? { token: tokenB, amount: amountB }
      : null;
  const usdValue = (amount: string, token: typeof tokenA) => {
    const price = prices[token.coingeckoId]?.usd;
    const value = Number(amount) * (price ?? 0);
    return price && Number.isFinite(value) ? formatUsd(value) : null;
  };
  const cta = busy ? (status.phase !== 'idle' && status.phase !== 'error' && status.phase !== 'success' ? status.label : '') : blocker ?? (pool.exists ? 'Add liquidity' : 'Create pool & add liquidity');
  const showPill = pool.exists && !v.poolLoading && !v.poolReadError;
  const progressStep = status.phase === 'checking' || status.phase === 'wallet' || status.phase === 'pending' ? status.step : null;
  const inApproval = progressStep === 'approval';
  const step1: StepState = inApproval ? 'active' : 'complete';
  const step2: StepState = inApproval ? 'waiting' : status.phase === 'pending' ? 'complete' : 'active';
  const step3: StepState = progressStep === 'liquidity' && status.phase === 'pending' ? 'active' : 'waiting';
  const walletName = selectedWallet?.info.name ?? 'your wallet';
  const badge1 = !inApproval ? 'Approved' : status.phase === 'wallet' ? 'Awaiting Approval' : status.phase === 'pending' ? 'Confirming' : 'Checking';
  const badge2 = inApproval ? 'Pending' : status.phase === 'wallet' ? 'Awaiting Approval' : status.phase === 'pending' ? 'Submitted' : 'Preparing';
  const badge3 = step3 === 'active' ? 'Confirming' : 'Pending';
  const actionTitle = status.phase === 'wallet' ? 'Action Required' : status.phase === 'pending' ? 'Waiting for blockchain confirmation' : 'Please Wait';
  const actionText = status.phase === 'wallet'
    ? `A request is waiting in ${walletName}. Open and unlock your wallet, then approve the ${status.step === 'approval' ? 'token spending' : pool.exists ? 'liquidity transaction' : 'pool creation'} to continue.`
    : status.phase === 'pending'
      ? `Your ${status.step === 'approval' ? 'token approval' : 'liquidity transaction'} has been submitted. Network confirmation may take a few minutes or longer. Keep this tab open and your laptop awake; do not submit again.`
      : status.phase === 'checking' ? `${status.label} No transaction is being sent during this check.` : '';

  return (
    <section className="mt-6" aria-label="Liquidity">
      {isConnected && !progressHidden && (status.phase === 'checking' || status.phase === 'wallet' || status.phase === 'pending') && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-md sm:p-5" role="dialog" aria-modal="true" aria-labelledby="liquidity-progress-title" aria-live="polite">
          <div className="toast-in max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-panel p-5 shadow-2xl sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-600/25" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2.5 5.2 12a7.8 7.8 0 1 0 13.6 0L12 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M8.8 13.5c1.7 1.5 4.7 1.5 6.4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="liquidity-progress-title" className="font-display text-2xl font-bold tracking-tight">{pool.exists ? 'Add Liquidity' : 'Create Pool'}</h2>
                <p className="mt-0.5 text-sm text-slate-600">{pool.exists ? 'Provide liquidity to the' : 'Create and fund the'} {tokenA.symbol} / {tokenB.symbol} pool</p>
              </div>
              <button type="button" className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-ring" aria-label="Hide progress (the transaction continues)" onClick={() => setProgressHidden(true)}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-2">
              <span className="flex -space-x-2"><TokenIcon token={tokenA} size={30} /><TokenIcon token={tokenB} size={30} /></span>
              <span className="font-display text-base font-bold">{tokenA.symbol} / {tokenB.symbol}</span>
              <span className="ml-auto rounded-full bg-panel px-2.5 py-1 text-[11px] font-semibold text-horizon">{feeLabel} fee</span>
            </div>

            <ol className="mt-5">
              <StepCard
                state={step1} number="1" badge={badge1}
                title="Check and approve token spending"
                description={inApproval ? status.label : 'Token spending is approved for the liquidity contract.'}
              />
              <StepCard
                state={step2} number="2" badge={badge2}
                title="Confirm liquidity in your wallet"
                description={`Review the pool details and confirm the transaction in your wallet (e.g., ${walletName}).`}
              />
              <StepCard
                state={step3} number="3" badge={badge3} last
                title="Wait for blockchain confirmation"
                description={step3 === 'active' ? 'Network confirmation can take a few minutes or longer. Keep this page open and do not submit again.' : 'Your liquidity position will be created after the transaction is confirmed on the network.'}
              />
            </ol>

            <div role="status" className="mt-2 flex gap-3 rounded-2xl bg-blue-50 p-4" aria-live="polite">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-horizon text-sm font-bold text-white" aria-hidden="true">i</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{actionTitle}{status.phase !== 'wallet' && <LoadingDots />}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{actionText}</p>
              </div>
            </div>

            {status.phase === 'wallet' && walletSlow && (
              <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="wallet-timeout-title">
                <div className="glass w-full max-w-sm rounded-2xl p-5 shadow-2xl">
                  <h2 id="wallet-timeout-title" className="font-display text-lg font-bold">Wallet request is taking too long</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    There has been no response for 30 seconds. Check {walletName}. If you want to stop, reject the pending request in your wallet first; once it is canceled, you can try again. This page cannot cancel an open wallet request.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" className="btn-ghost py-2.5 focus-ring" onClick={() => setWalletSlow(false)}>Keep waiting</button>
                    <button type="button" className="btn-primary py-2.5 focus-ring" onClick={() => { setWalletSlow(false); setProgressHidden(true); }}>Close progress</button>
                  </div>
                </div>
              </div>
            )}
            {status.phase === 'pending' && v.pendingNote && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-left text-xs text-amber-800">{v.pendingNote}</p>
            )}
            {status.phase === 'pending' && pendingSlow && !v.pendingNote && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-left text-xs text-amber-800">
                This is taking longer than usual. The transaction may still be pending because of network congestion or a slow RPC response. Do not retry while it is pending.
              </p>
            )}
            {status.phase === 'pending' && status.hash && (
              <p className="mt-3 break-all text-xs text-slate-500">
                Transaction: {status.hash}
                {explorerTxUrl(status.hash) && (
                  <a className="ml-1 font-medium text-horizon underline" href={explorerTxUrl(status.hash)!} target="_blank" rel="noreferrer">View on explorer</a>
                )}
              </p>
            )}
          </div>
        </div>
      )}
      {v.contractProblems.length > 0 && (
        <div role="alert" className="mb-5 rounded-xl border border-rose-600/30 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
          <p className="font-semibold">Your .env contract addresses do not match each other</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 break-all">{v.contractProblems.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="mt-1.5">Fix these in <code>.env</code> and restart <code>npm run dev</code>. Adding liquidity is disabled until they match.</p>
        </div>
      )}
      {issues.length > 0 && (
        <div role="alert" className="mb-5 rounded-xl border border-rose-600/30 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
          <p className="font-semibold">Setup needed before you can add liquidity</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">{issues.map((i) => <li key={i}>{i}</li>)}</ul>
          <p className="mt-1.5">Copy <code>.env.example</code> to <code>.env</code>, fill these in, then restart <code>npm run dev</code>.</p>
        </div>
      )}
      <p className="text-sm font-medium text-slate-600">1 · Pick the two tokens</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {([['a', tokenAId], ['b', tokenBId]] as const).map(([side, id]) => (
          <label key={side} className="field flex items-center gap-2 !py-2">
            <select value={id} disabled={busy} onChange={(e) => pickToken(side, e.target.value)} aria-label={`Token ${side.toUpperCase()}`}
              className="min-w-0 flex-1 bg-transparent font-semibold outline-none">
              {TOKENS.map((t) => <option key={t.id} value={t.id}>{t.symbol}</option>)}
            </select>
          </label>
        ))}
      </div>

      <p className="mt-5 text-sm font-medium text-slate-600">2 · Fee tier</p>
      <div className={`mt-2 grid gap-2 ${FEE_TIERS.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`} role="radiogroup" aria-label="Fee tier">
        {FEE_TIERS.map((f) => (
          <button key={f.fee} role="radio" aria-checked={fee === f.fee} disabled={busy} onClick={() => { setFee(f.fee); v.setStatus({ phase: 'idle' }); }}
            className={`rounded-xl border px-2 py-2 text-sm font-semibold transition focus-ring ${fee === f.fee ? 'border-horizon bg-blue-50 text-horizon ring-1 ring-horizon/40' : 'border-blue-100 hover:bg-blue-50/60'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <p className="mt-5 text-sm font-medium text-slate-600">3 · Price range</p>
      <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Price range">
        {RANGE_OPTIONS.map((r) => (
          <button key={r.id} role="radio" aria-checked={range === r.id} disabled={busy} onClick={() => setRange(r.id)}
            className={`rounded-xl border px-2 py-2 text-center transition focus-ring ${range === r.id ? 'border-horizon bg-blue-50 ring-1 ring-horizon/40' : 'border-blue-100 hover:bg-blue-50/60'}`}>
            <span className="block text-sm font-semibold">{r.label}</span>
            <span className="block text-[11px] text-slate-500">{r.hint}</span>
          </button>
        ))}
      </div>

      {ready && balancesError && (
        <div role="alert" className="mt-5 flex items-start justify-between gap-3 rounded-xl border border-amber-600/30 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>{balancesError}</span>
          <button type="button" className="shrink-0 font-semibold underline" onClick={() => void refresh()}>Retry</button>
        </div>
      )}
      <p className="mt-5 text-sm font-medium text-slate-600">4 · Deposit</p>
      <div className={`mt-2 text-xs ${showPill ? '' : `rounded-xl px-3 py-2 ${v.poolReadError ? 'bg-rose-50 text-rose-700' : pool.exists ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}`} role={v.poolReadError ? 'alert' : 'status'}>
        {v.poolLoading ? 'Reading pool status and current liquidity…'
          : v.poolReadError ? (
            <div className="flex items-start justify-between gap-3">
              <span>{v.poolReadError}</span>
              <button type="button" className="shrink-0 font-semibold underline" onClick={() => void v.loadPool()}>Retry</button>
            </div>
          )
          : pool.exists ? (
            <div className="flex flex-wrap items-center gap-2" title={pool.address ? `Pool: ${pool.address}` : undefined}>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${pool.liquidity > 0n ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3c-3 4-7 8.1-7 12a7 7 0 0 0 14 0c0-3.9-4-8-7-12z" /></svg>
                Pool Initialized{pool.liquidity > 0n ? '' : ' · No liquidity yet'}
              </span>
              {v.price !== null && <span className="text-slate-500">1 {tokenA.symbol} = {v.price.toLocaleString('en-US', { maximumFractionDigits: 6 })} {tokenB.symbol}</span>}
            </div>
          )
          : 'No initialized pool found for this pair and fee tier. It will be created at the price implied by your deposit.'}
        </div>
      {!pool.exists && !v.poolReadError && !v.poolLoading && (
        <p className="mt-1 text-xs text-slate-500">
          {amountRatio
            ? 'The other amount is estimated from live market prices. Your deposit ratio sets the new pool’s initial price; review both amounts before confirming.'
            : 'No market price estimate is available. Enter both amounts; their ratio sets the new pool’s initial price.'}
        </p>
      )}
      <div className="mt-2 space-y-2">
        {([['a', tokenA, amountA, editA], ['b', tokenB, amountB, editB]] as const).map(([side, tok, val, onChange]) => (
          <label key={side} className="field flex items-center gap-3">
            <input inputMode="decimal" autoComplete="off" placeholder="0.0" value={val} disabled={busy} onChange={(e) => onChange(e.target.value)} aria-label={`${tok.symbol} amount`}
              className="min-w-0 flex-1 bg-transparent font-display text-2xl font-semibold tabular-nums outline-none placeholder:text-slate-300" />
            <span className="text-right text-sm font-semibold">
              {tok.symbol}
              <span className="block text-[11px] font-normal text-slate-500">
                Bal {!ready ? '—' : balances[tok.id] === undefined ? (balancesLoading ? '…' : '—') : formatAmount(balances[tok.id], tok.decimals, 4)}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="pt-4">
        {!isConnected ? (
          <button className="btn-primary focus-ring" disabled={isConnecting} onClick={() => void connect()}>{isConnecting ? 'Check your wallet…' : 'Connect Wallet'}</button>
        ) : isWrongNetwork ? (
          <button className="btn-primary focus-ring" disabled={isSwitching} onClick={() => void switchNetwork()}>
            {isSwitching ? 'Check your wallet…' : `Switch to ${CHAIN_LABEL}`}
          </button>
        ) : (
          <button
            className="btn-primary focus-ring"
            disabled={(!!blocker && !insufficientBalance) || busy}
            onClick={() => {
              if (insufficientBalance) {
                setBalancePopupOpen(true);
                return;
              }
              void openReview();
            }}
          >
            {insufficientBalance ? `Insufficient ${insufficientBalance.token.symbol} — view details` : cta}
          </button>
        )}
      </div>

      {balancePopupOpen && insufficientBalance && (() => {
        const tok = insufficientBalance.token;
        const have = formatAmount(balances[tok.id] ?? 0n, tok.decimals, 6);
        const getMoreUrl = ACTIVE_CHAIN.id === 1
          ? 'https://ethereum.org/en/get-eth/'
          : ACTIVE_CHAIN.id === 56
            ? 'https://www.binance.com/en/buy-BNB'
            : IS_BNB_CHAIN ? 'https://www.bnbchain.org/en/testnet-faucet' : 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia';
        return (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="insufficient-balance-title" onMouseDown={() => setBalancePopupOpen(false)}>
            <div className="glass toast-in relative w-full max-w-sm rounded-2xl p-4 pt-7 text-center sm:p-5" onMouseDown={(e) => e.stopPropagation()}>
              <button type="button" className="absolute right-3 top-3 rounded-full p-1 text-slate-500 transition hover:bg-blue-50 hover:text-slate-800 focus-ring" aria-label="Close" onClick={() => setBalancePopupOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <TokenIcon token={tok} size={36} />
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-panel bg-rose-600 text-sm font-bold text-white" aria-hidden="true">!</span>
              </div>
              <h2 id="insufficient-balance-title" className="mt-3 font-display text-xl font-bold tracking-tight">Not Enough {tok.symbol}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                You entered <strong className="text-slate-900">{insufficientBalance.amount} {tok.symbol}</strong>, but your balance is{' '}
                <span className="whitespace-nowrap rounded-lg bg-rose-50 px-1.5 py-0.5 font-bold text-rose-600">{have} {tok.symbol}.</span>
                <br />
                {tok.isNative ? `Add ${tok.symbol} to continue the liquidity transaction.` : 'Lower the amount to continue. No transaction was sent.'}
              </p>
              {tok.isNative && (
                <p className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-left text-xs text-slate-700">
                  <svg className="shrink-0 text-horizon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" /><path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  <span>Keep some extra {tok.symbol} for network fees (gas) on {CHAIN_LABEL}.</span>
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" className="rounded-xl border border-blue-100 bg-panel px-3 py-2.5 text-sm font-semibold text-cloud transition hover:bg-blue-50 focus-ring" onClick={() => setBalancePopupOpen(false)}>Cancel</button>
                {tok.isNative ? (
                  <a className="inline-flex items-center justify-center rounded-xl bg-horizon px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:brightness-110 focus-ring" href={getMoreUrl} target="_blank" rel="noreferrer" onClick={() => setBalancePopupOpen(false)}>
                    {IS_MAINNET ? `Get ${tok.symbol}` : `Add ${tok.symbol}`}
                  </a>
                ) : (
                  <button type="button" className="rounded-xl bg-horizon px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:brightness-110 focus-ring" onClick={() => setBalancePopupOpen(false)}>Adjust amount</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {reviewOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-md sm:p-5" role="dialog" aria-modal="true" aria-labelledby="liquidity-review-title">
          <div className="toast-in max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-blue-100 bg-panel p-5 text-cloud shadow-2xl shadow-black/30 sm:p-6">
            {/* header */}
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-horizon/15 text-horizon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2.5 5.2 12a7.8 7.8 0 1 0 13.6 0L12 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M8.8 13.5c1.7 1.5 4.7 1.5 6.4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="liquidity-review-title" className="font-display text-xl font-bold tracking-tight text-cloud">Review Deposit</h2>
                <p className="mt-0.5 text-sm text-slate-600">Check the details before continuing to your wallet.</p>
              </div>
              <button type="button" className="rounded-full p-1.5 text-slate-500 transition hover:bg-blue-50 hover:text-cloud focus-ring" aria-label="Close review" onClick={() => setReviewOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>

            {/* pair */}
            <div className="mt-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-blue-100 bg-blue-50 px-3.5 py-3">
              <div className="flex -space-x-2">
                <TokenIcon token={tokenA} size={34} />
                <TokenIcon token={tokenB} size={34} />
              </div>
              <p className="font-display text-lg font-bold text-cloud">{tokenA.symbol} / {tokenB.symbol}</p>
              <span className="ml-auto rounded-full bg-horizon/15 px-3 py-1 text-xs font-semibold text-horizon">{pool.exists ? 'Add Liquidity' : 'Create Pool'}</span>
            </div>

            {/* amounts */}
            <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">You deposit</p>
              <div className="mt-2 space-y-2">
                {([[tokenA, amountA], [tokenB, amountB]] as const).map(([token, amount]) => (
                  <div key={token.id} className="flex items-center gap-3 rounded-xl border border-blue-100 bg-panel px-3 py-2.5">
                    <TokenIcon token={token} size={36} />
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-cloud">{token.symbol}</p>
                      <p className="truncate text-xs text-slate-500">{token.name}</p>
                    </div>
                    <div className="ml-auto min-w-0 text-right">
                      <p className="break-all font-display text-lg font-bold tabular-nums text-cloud">{amount || '0'}</p>
                      <p className="text-xs text-slate-500">{usdValue(amount, token) ?? 'USD estimate unavailable'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* details */}
            <dl className="mt-3 divide-y divide-blue-100 rounded-2xl border border-blue-100 bg-blue-50 px-3.5 text-sm">
              <div className="flex items-center justify-between gap-3 py-3">
                <dt className="text-slate-600">Pool</dt>
                <dd className="flex items-center gap-2 text-right font-semibold text-cloud">
                  <span className="text-xs font-normal text-slate-500">{reviewLoading ? 'Reading pool…' : pool.liquidity > 0n ? 'Has liquidity' : pool.exists ? 'No active liquidity' : 'Will be created'}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${reviewLoading ? 'border-amber-600/30 bg-amber-100 text-amber-800' : pool.exists ? 'border-emerald-600/30 bg-emerald-50 text-emerald-700' : 'border-horizon/30 bg-horizon/15 text-horizon'}`}>
                    {reviewLoading ? 'Checking' : pool.exists ? '✓ Existing' : 'New'}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <dt className="text-slate-600">{pool.exists ? 'Current price' : 'Initial price'}</dt>
                <dd className="text-right font-semibold text-cloud">{v.price !== null ? `1 ${tokenA.symbol} = ${v.price.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${tokenB.symbol}` : 'Set by deposit amounts'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <dt className="text-slate-600">Fee tier</dt>
                <dd className="font-semibold text-cloud">{feeLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <dt className="text-slate-600">Network</dt>
                <dd className="font-semibold text-cloud">{CHAIN_LABEL}</dd>
              </div>
            </dl>

            {reviewLoading && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-slate-600"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Reading pool…</p>}
            {v.poolReadError && <p role="alert" className="mt-3 rounded-xl border border-rose-600/30 bg-rose-50 p-3 text-sm text-rose-700">{v.poolReadError}</p>}
            <MainnetNotice className="mt-3" />
            <p className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-600/30 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
              <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" /><path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <span>Keep your wallet open and unlocked. Approvals are usually quick, but network confirmation can take longer, so keep this tab open. Network gas is paid separately.</span>
            </p>

            <div className="mt-4 grid grid-cols-[0.8fr_1.4fr] gap-3">
              <button className="btn-ghost !rounded-xl !py-3 focus-ring" disabled={busy} onClick={() => setReviewOpen(false)}>Cancel</button>
              {v.poolReadError ? (
                <button className="btn-primary !rounded-xl !py-3 focus-ring" disabled={reviewLoading} onClick={() => { setReviewLoading(true); void v.loadPool().finally(() => setReviewLoading(false)); }}>Retry pool check</button>
              ) : (
                <button className="btn-primary !rounded-xl !py-3 !text-sm focus-ring" disabled={reviewLoading || !!blocker || busy} onClick={() => { setReviewOpen(false); if (!isConnected || !account) { void connect(); return; } void v.submit(); }}>
                  Continue to Wallet <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {status.phase === 'error' && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="liquidity-error-title">
          <div className="glass w-full max-w-sm rounded-3xl border border-rose-600/40 p-6 shadow-2xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-xl font-bold text-rose-700" aria-hidden="true">!</span>
            <h2 id="liquidity-error-title" className="mt-4 text-lg font-semibold">
              {status.message.startsWith('You rejected') ? 'Request cancelled' : 'Liquidity transaction failed'}
            </h2>
            <p className="mt-2 break-words text-sm text-rose-700">{status.message}</p>
            {status.detail && status.detail !== status.message && (
              <details className="mt-2 text-xs text-slate-500">
                <summary className="cursor-pointer font-medium">Technical details</summary>
                <p className="mt-1 break-words font-mono">{status.detail}</p>
              </details>
            )}
            {status.hash && (
              <p className="mt-3 break-all text-xs text-slate-500">
                Transaction: {status.hash}
                {explorerTxUrl(status.hash) && <a className="ml-1 font-medium text-horizon underline" href={explorerTxUrl(status.hash)!} target="_blank" rel="noreferrer">View on explorer</a>}
              </p>
            )}
            <button
              className="btn-primary mt-5 w-full focus-ring"
              onClick={() => {
                const wasRejected = status.message.startsWith('You rejected');
                v.setStatus({ phase: 'idle' });
                if (wasRejected) setReviewOpen(true);
              }}
            >
              {status.message.startsWith('You rejected') ? 'Try again' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {status.phase === 'success' && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="liquidity-success-title">
          <div className="glass w-full max-w-sm rounded-3xl border border-emerald-300 p-6 text-center shadow-2xl">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-3xl font-bold text-emerald-700" aria-hidden="true">✓</span>
            <h2 id="liquidity-success-title" className="mt-4 text-xl font-semibold">{pool.exists ? 'Liquidity added' : 'Pool created successfully'}</h2>
            <p className="mt-2 text-sm text-slate-600">{status.message}</p>
            <p className="mt-3 text-sm font-semibold">{amountA} {tokenA.symbol} + {amountB} {tokenB.symbol}</p>
            <div className="mt-5 flex flex-col gap-2">
              {explorerTxUrl(status.hash) && <a className="btn-ghost w-full py-3 text-center font-semibold text-horizon focus-ring" href={explorerTxUrl(status.hash)!} target="_blank" rel="noreferrer">View transaction</a>}
              <button className="btn-primary w-full py-3 focus-ring" onClick={() => v.setStatus({ phase: 'idle' })}>Done</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}