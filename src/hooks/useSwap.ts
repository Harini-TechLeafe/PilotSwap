import { useCallback, useEffect, useMemo, useState } from 'react';
import { erc20Abi, formatUnits, parseEther, type Address, type Hex, type WalletClient } from 'viem';
import { ACTIVE_CHAIN, explorerTxUrl, publicClient } from '../config/chains';
import { DEADLINE_MINUTES, DEFAULT_SLIPPAGE_BPS, GAS_UNITS_ESTIMATE, SWAP_ROUTER_ADDRESS, WETH_ADDRESS, routerAbi } from '../config/contracts';
import { TOKENS, getToken, isTokenConfigured, type Token } from '../config/tokens';
import { parseTxError } from '../lib/errors';
import { parseAmount } from '../lib/format';
import { useToast } from '../components/Toast';

export interface Quote {
  amountOut: bigint;
  path: Address[];
  priceImpactBps: number;
}

export interface TxState {
  step: 'approve' | 'swap' | 'send';
  phase: 'wallet' | 'pending' | 'success' | 'error';
  hash?: Hex;
  message?: string;
}

interface Args {
  account: Address | null;
  walletClient: WalletClient | null;
  /** true when a wallet is connected on the correct network */
  ready: boolean;
  balances: Record<string, bigint>;
  refreshBalances: () => Promise<void>;
  /** Token the "From" side starts on (e.g. the token the user clicked in the token list). */
  initialFromId?: string;
}

/** Direct pool first; also try routing through WETH for token↔token swaps. */
function candidatePaths(from: Token, to: Token): Address[][] {
  const a = from.isNative ? WETH_ADDRESS : from.address;
  const b = to.isNative ? WETH_ADDRESS : to.address;
  if (!a || !b || !WETH_ADDRESS || a === b) return [];
  const paths: Address[][] = [[a, b]];
  if (a !== WETH_ADDRESS && b !== WETH_ADDRESS) paths.push([a, WETH_ADDRESS, b]);
  return paths;
}

/** A sensible starting "To" token: never the same as "From", and never the ETH↔WETH pair. */
function defaultToId(fromId: string): string {
  if (fromId === 'ETH' || fromId === 'WETH') return TOKENS.find((t) => t.id === 'USDC') ? 'USDC' : TOKENS[1].id;
  return 'ETH';
}

export function useSwap({ account, walletClient, ready, balances, refreshBalances, initialFromId = 'ETH' }: Args) {
  const { push } = useToast();
  const [fromId, setFromId] = useState(initialFromId);
  const [toId, setToId] = useState(() => defaultToId(initialFromId));
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [tx, setTx] = useState<TxState | null>(null);

  const fromToken = getToken(fromId);
  const toToken = getToken(toId);
  const parsed = useMemo(() => parseAmount(amount, fromToken.decimals), [amount, fromToken.decimals]);
  const busy = tx?.phase === 'wallet' || tx?.phase === 'pending';

  // ── Gas price (for the estimated network fee) ──────────────────────────
  useEffect(() => {
    if (!ready) return;
    let off = false;
    const load = () =>
      publicClient
        .getGasPrice()
        .then((g) => !off && setGasPrice(g))
        .catch(() => {});
    load();
    const id = window.setInterval(load, 20_000);
    return () => {
      off = true;
      window.clearInterval(id);
    };
  }, [ready]);
  const feeWei = gasPrice ? gasPrice * GAS_UNITS_ESTIMATE : null;

  // ── Allowance ──────────────────────────────────────────────────────────
  const refreshAllowance = useCallback(async (): Promise<bigint> => {
    if (!ready || !account || !SWAP_ROUTER_ADDRESS || fromToken.isNative || !fromToken.address) {
      setAllowance(0n);
      return 0n;
    }
    try {
      const a = await publicClient.readContract({ address: fromToken.address, abi: erc20Abi, functionName: 'allowance', args: [account, SWAP_ROUTER_ADDRESS] });
      setAllowance(a);
      return a;
    } catch {
      setAllowance(0n);
      return 0n;
    }
  }, [ready, account, fromToken]);
  useEffect(() => {
    void refreshAllowance();
  }, [refreshAllowance]);

  const needsApproval = !fromToken.isNative && parsed !== null && parsed > 0n && allowance < parsed;

  // ── Quote: real on-chain getAmountsOut, debounced ──────────────────────
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    const paths = candidatePaths(fromToken, toToken);
    if (!ready || !SWAP_ROUTER_ADDRESS || !parsed || parsed <= 0n || !paths.length || !isTokenConfigured(fromToken) || !isTokenConfigured(toToken)) {
      setQuoting(false);
      return;
    }
    const router = SWAP_ROUTER_ADDRESS;
    let cancelled = false;
    setQuoting(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await Promise.allSettled(
          paths.map(async (path) => {
            const amounts = await publicClient.readContract({ address: router, abi: routerAbi, functionName: 'getAmountsOut', args: [parsed, path] });
            return { path, out: amounts[amounts.length - 1] };
          }),
        );
        const ok = results.flatMap((r) => (r.status === 'fulfilled' && r.value.out > 0n ? [r.value] : []));
        if (!ok.length) throw new Error('No liquidity pool found for this pair on the configured router.');
        const best = ok.reduce((a, b) => (b.out > a.out ? b : a));

        // Price impact estimate: compare execution rate with the rate for a tiny (0.1%) trade.
        let impact = 0;
        const refIn = parsed / 1000n;
        if (refIn > 0n) {
          try {
            const ref = await publicClient.readContract({ address: router, abi: routerAbi, functionName: 'getAmountsOut', args: [refIn, best.path] });
            const refOut: bigint = ref[ref.length - 1];
            if (refOut > 0n) impact = Math.max(0, 10_000 - Number((best.out * refIn * 10_000n) / (refOut * parsed)));
          } catch {
            /* keep 0 if the reference quote fails */
          }
        }
        if (!cancelled) setQuote({ amountOut: best.out, path: best.path, priceImpactBps: impact });
      } catch (e) {
        if (!cancelled) setQuoteError(e instanceof Error && e.message.startsWith('No liquidity') ? e.message : 'Could not fetch a quote. Check your RPC and router address.');
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [parsed, fromToken, toToken, ready]);

  // Finished (success/error) banners are dismissed as soon as the user edits the order.
  const clearFinished = () => setTx((t) => (t && (t.phase === 'success' || t.phase === 'error') ? null : t));
  const changeAmount = (v: string) => { clearFinished(); setAmount(v); };
  const changeFrom = (id: string) => { clearFinished(); setFromId(id); };
  const changeTo = (id: string) => { clearFinished(); setToId(id); };

  const minReceived = quote ? (quote.amountOut * BigInt(10_000 - slippageBps)) / 10_000n : null;
  const routeSymbols = useMemo(() => {
    if (!quote) return [];
    const last = quote.path.length - 1;
    return quote.path.map((addr, i) => {
      if (i === 0 && fromToken.isNative) return 'ETH'; // native coin is wrapped by the router
      if (i === last && toToken.isNative) return 'ETH';
      return TOKENS.find((t) => t.address === addr)?.symbol ?? 'WETH';
    });
  }, [quote, fromToken, toToken]);

  // ── Validation (first problem wins) ────────────────────────────────────
  const blocker = useMemo<string | null>(() => {
    if (!SWAP_ROUTER_ADDRESS || !WETH_ADDRESS) return 'Swap router is not configured';
    if (fromToken.id === toToken.id) return 'Select two different tokens';
    if (!isTokenConfigured(fromToken)) return `${fromToken.symbol} address is not configured`;
    if (!isTokenConfigured(toToken)) return `${toToken.symbol} address is not configured`;
    const a = fromToken.isNative ? WETH_ADDRESS : fromToken.address;
    const b = toToken.isNative ? WETH_ADDRESS : toToken.address;
    if (a === b) return 'ETH ↔ WETH is wrapping, not swapping';
    if (!amount) return 'Enter an amount';
    if (parsed === null || parsed <= 0n) return 'Enter a valid amount';
    if (parsed > (balances[fromToken.id] ?? 0n)) return `Insufficient ${fromToken.symbol} balance`;
    if ((balances.ETH ?? 0n) === 0n) return 'You need ETH to pay for gas';
    if (quoteError) return quoteError;
    if (quoting || !quote) return 'Fetching best price…';
    return null;
  }, [fromToken, toToken, amount, parsed, balances, quoteError, quoting, quote]);

  // ── Actions ────────────────────────────────────────────────────────────
  const flip = () => {
    if (busy) return;
    clearFinished();
    setFromId(toId);
    setToId(fromId);
    setAmount('');
  };

  const setMax = () => {
    const bal = balances[fromToken.id] ?? 0n;
    const reserve = fromToken.isNative ? parseEther('0.005') : 0n; // keep some ETH for gas
    changeAmount(formatUnits(bal > reserve ? bal - reserve : 0n, fromToken.decimals));
  };

  const fail = (step: TxState['step'], e: unknown, hash?: Hex) => {
    const { message, rejected } = parseTxError(e);
    setTx({ step, phase: 'error', message, hash });
    push({ kind: 'error', title: rejected ? 'Request rejected' : step === 'approve' ? 'Approval failed' : 'Swap failed', message });
  };

  const approve = async () => {
    if (!walletClient || !account || !fromToken.address || !SWAP_ROUTER_ADDRESS || !parsed || busy) return;
    setTx({ step: 'approve', phase: 'wallet' });
    try {
      // Approve exactly the amount being swapped (not unlimited): safer default.
      await publicClient.simulateContract({ account, address: fromToken.address, abi: erc20Abi, functionName: 'approve', args: [SWAP_ROUTER_ADDRESS, parsed] });
      const hash = await walletClient.writeContract({ account, chain: ACTIVE_CHAIN, address: fromToken.address, abi: erc20Abi, functionName: 'approve', args: [SWAP_ROUTER_ADDRESS, parsed] });
      setTx({ step: 'approve', phase: 'pending', hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Approval transaction reverted on-chain.');
      await refreshAllowance();
      setTx({ step: 'approve', phase: 'success', hash });
      push({ kind: 'success', title: `${fromToken.symbol} approved`, message: 'You can now swap.', href: explorerTxUrl(hash) });
    } catch (e) {
      fail('approve', e);
    }
  };

  const swap = async () => {
    if (!walletClient || !account || !SWAP_ROUTER_ADDRESS || !parsed || !quote || minReceived === null || busy) return;
    setTx({ step: 'swap', phase: 'wallet' });
    const router = SWAP_ROUTER_ADDRESS;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_MINUTES * 60);
    const { path } = quote;
    let hash: Hex | undefined;
    try {
      // simulateContract throws with a decoded revert reason BEFORE MetaMask opens.
      if (fromToken.isNative) {
        const p = { account, address: router, abi: routerAbi, functionName: 'swapExactETHForTokens', args: [minReceived, path, account, deadline], value: parsed } as const;
        await publicClient.simulateContract(p);
        hash = await walletClient.writeContract({ ...p, chain: ACTIVE_CHAIN });
      } else if (toToken.isNative) {
        const p = { account, address: router, abi: routerAbi, functionName: 'swapExactTokensForETH', args: [parsed, minReceived, path, account, deadline] } as const;
        await publicClient.simulateContract(p);
        hash = await walletClient.writeContract({ ...p, chain: ACTIVE_CHAIN });
      } else {
        const p = { account, address: router, abi: routerAbi, functionName: 'swapExactTokensForTokens', args: [parsed, minReceived, path, account, deadline] } as const;
        await publicClient.simulateContract(p);
        hash = await walletClient.writeContract({ ...p, chain: ACTIVE_CHAIN });
      }
      setTx({ step: 'swap', phase: 'pending', hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Swap transaction reverted on-chain.');
      setTx({ step: 'swap', phase: 'success', hash });
      push({ kind: 'success', title: 'Swap confirmed', message: `${fromToken.symbol} → ${toToken.symbol}`, href: explorerTxUrl(hash) });
      setAmount('');
      await Promise.all([refreshBalances(), refreshAllowance()]);
    } catch (e) {
      fail('swap', e, hash);
    }
  };

  return {
    fromToken, toToken, setFromId: changeFrom, setToId: changeTo, amount, setAmount: changeAmount, slippageBps, setSlippageBps,
    quote, quoting, minReceived, routeSymbols, feeWei, blocker, needsApproval, busy, tx, setTx,
    flip, setMax, approve, swap,
  };
}
