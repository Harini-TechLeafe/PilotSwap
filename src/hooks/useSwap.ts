import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { encodeFunctionData, erc20Abi, formatUnits, parseEther, type Address, type Hex, type WalletClient } from 'viem';
import { ACTIVE_CHAIN, IS_BNB_CHAIN, NATIVE_SYMBOL, explorerTxUrl, publicClient } from '../config/chains';
import {
  DEADLINE_MINUTES, DEFAULT_SLIPPAGE_BPS, FEE_TIERS, GAS_UNITS_ESTIMATE, QUOTER_ADDRESS, ROUTER_AS_RECIPIENT,
  SWAP_ROUTER_ADDRESS, WETH_ADDRESS, pancakeSwapRouterAbi, quoterAbi, swapRouterAbi,
} from '../config/contracts';
import { TOKENS, getToken, isTokenConfigured, type Token } from '../config/tokens';
import { isRpcRequestError, parseTxError } from '../lib/errors';
import { parseAmount } from '../lib/format';
import { waitForAllowance } from '../lib/allowance';
import { waitForReceiptPatiently } from '../lib/receipt';
import { useToast } from '../components/Toast';
import { useV3ContractCheck } from './useV3ContractCheck';

export interface Quote {
  amountOut: bigint;
  /** [tokenIn, tokenOut]. The native coin is represented by its wrapped token (WETH / WBNB). */
  path: Address[];
  /** Fee tier of the pool the quote came from (e.g. 3000 = 0.3%). */
  fee: number;
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
  /** Token the "To" side starts on (e.g. USDT on the Buy USDT page). Ignored if it equals the From token. */
  initialToId?: string;
}

/** The V3 pool pair [tokenIn, tokenOut]; the native coin is traded as its wrapped token. */
function poolPair(from: Token, to: Token): Address[] | null {
  const a = from.isNative ? WETH_ADDRESS : from.address;
  const b = to.isNative ? WETH_ADDRESS : to.address;
  if (!a || !b || !WETH_ADDRESS || a === b) return null;
  return [a, b];
}

/** A sensible starting "To" token: never the same as "From", and never the native↔wrapped pair. */
function defaultToId(fromId: string): string {
  if (fromId === 'ETH' || fromId === 'WETH') {
    if (TOKENS.find((t) => t.id === 'USDC' && t.address)) return 'USDC';
    return TOKENS.find((t) => t.id === 'USDC') ? 'USDC' : TOKENS[1].id;
  }
  return 'ETH';
}

export function useSwap({ account, walletClient, ready, balances, refreshBalances, initialFromId = 'ETH', initialToId }: Args) {
  const { push } = useToast();
  const contractCheck = useV3ContractCheck();
  const [fromId, setFromId] = useState(initialFromId);
  const [toId, setToId] = useState(() => (initialToId && initialToId !== initialFromId && TOKENS.some((t) => t.id === initialToId) ? initialToId : defaultToId(initialFromId)));
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [tx, setTx] = useState<TxState | null>(null);
  const accountRef = useRef(account);
  const rpcToastShownRef = useRef(false);
  useEffect(() => { accountRef.current = account; }, [account]);

  useEffect(() => {
    if (account || tx?.phase !== 'wallet') return;
    setTx((current) => current?.phase === 'wallet'
      ? { ...current, phase: 'error', message: 'Could not process because your wallet disconnected. Reconnect and try again.' }
      : current);
  }, [account, tx?.phase]);

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
  const spender = SWAP_ROUTER_ADDRESS;
  const refreshAllowance = useCallback(async (): Promise<bigint> => {
    if (!ready || !account || !spender || fromToken.isNative || !fromToken.address) {
      setAllowance(0n);
      return 0n;
    }
    try {
      const a = await publicClient.readContract({ address: fromToken.address, abi: erc20Abi, functionName: 'allowance', args: [account, spender] });
      setAllowance(a);
      return a;
    } catch {
      setAllowance(0n);
      return 0n;
    }
  }, [ready, account, fromToken, spender]);
  useEffect(() => {
    void refreshAllowance();
  }, [refreshAllowance]);

  const needsApproval = !fromToken.isNative && parsed !== null && parsed > 0n && allowance < parsed;

  // ── Quote: on-chain V3 QuoterV2 across fee tiers, debounced ────────────
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    const path = poolPair(fromToken, toToken);
    if (!QUOTER_ADDRESS || !parsed || parsed <= 0n || !path || !isTokenConfigured(fromToken) || !isTokenConfigured(toToken)) {
      setQuoting(false);
      return;
    }
    const quoter = QUOTER_ADDRESS;
    let cancelled = false;
    setQuoting(true);

    const cands = FEE_TIERS.map(({ fee }) => ({ path, fee }));
    const quoteOut = async (c: (typeof cands)[number], amountIn: bigint): Promise<bigint> => {
      const { result } = await publicClient.simulateContract({
        address: quoter, abi: quoterAbi, functionName: 'quoteExactInputSingle',
        args: [{ tokenIn: c.path[0], tokenOut: c.path[1], amountIn, fee: c.fee, sqrtPriceLimitX96: 0n }],
      });
      return result[0];
    };
    const timer = window.setTimeout(async () => {
      try {
        // A pool/pair that doesn't exist (or has no liquidity) simply reverts → ignored.
        // The tiny (0.1%) reference quote for the price-impact estimate runs in the SAME round trip as the main quote.
        const refIn = parsed / 1000n;
        const results = await Promise.allSettled(cands.map(async (c) => {
          const [out, refOut] = await Promise.all([
            quoteOut(c, parsed),
            refIn > 0n ? quoteOut(c, refIn).catch(() => 0n) : Promise.resolve(0n),
          ]);
          return { c, out, refOut };
        }));
        const ok = results.flatMap((r) => (r.status === 'fulfilled' && r.value.out > 0n ? [r.value] : []));
        if (!ok.length) {
          const rpcFailure = results.find((result) => result.status === 'rejected' && isRpcRequestError(result.reason));
          if (rpcFailure?.status === 'rejected') throw rpcFailure.reason;
          throw new Error('No liquidity pool found for this pair. Add liquidity first.');
        }
        const best = ok.reduce((a, b) => (b.out > a.out ? b : a));
        const impact = best.refOut > 0n ? Math.max(0, 10_000 - Number((best.out * refIn * 10_000n) / (best.refOut * parsed))) : 0;
        if (!cancelled) {
          rpcToastShownRef.current = false;
          setQuote({ amountOut: best.out, path: best.c.path, fee: best.c.fee, priceImpactBps: impact });
        }
      } catch (e) {
        if (!cancelled) {
          if (isRpcRequestError(e)) {
            setQuoteError('Blockchain RPC unavailable. Check your connection and retry.');
            if (!rpcToastShownRef.current) {
              const { message } = parseTxError(e);
              push({ kind: 'error', title: 'Blockchain connection failed', message });
              rpcToastShownRef.current = true;
            }
          } else {
            setQuoteError(e instanceof Error && e.message.startsWith('No liquidity') ? e.message : 'Could not fetch a quote. Check the RPC and router/quoter configuration.');
          }
        }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [parsed, fromToken, toToken]);

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
      if (i === 0 && fromToken.isNative) return NATIVE_SYMBOL; // native coin is wrapped by the router
      if (i === last && toToken.isNative) return NATIVE_SYMBOL;
      return TOKENS.find((t) => t.address === addr)?.symbol ?? getToken('WETH').symbol;
    });
  }, [quote, fromToken, toToken]);

  // ── Validation (first problem wins) ────────────────────────────────────
  const blocker = useMemo<string | null>(() => {
    if (!SWAP_ROUTER_ADDRESS || !QUOTER_ADDRESS || !WETH_ADDRESS) return 'Swap contracts are not configured';
    if (contractCheck.problems.length) return contractCheck.problems[0];
    if (fromToken.id === toToken.id) return 'Select two different tokens';
    if (!isTokenConfigured(fromToken)) return `${fromToken.symbol} address is not configured`;
    if (!isTokenConfigured(toToken)) return `${toToken.symbol} address is not configured`;
    const a = fromToken.isNative ? WETH_ADDRESS : fromToken.address;
    const b = toToken.isNative ? WETH_ADDRESS : toToken.address;
    if (a === b) return `${NATIVE_SYMBOL} ↔ ${getToken('WETH').symbol} is wrapping, not swapping`;
    if (!amount) return 'Enter an amount';
    if (parsed === null || parsed <= 0n) return 'Enter a valid amount';
    if (balances[fromToken.id] === undefined || balances.ETH === undefined) return 'Reading wallet balance…';
    if (parsed > balances[fromToken.id]) return `Insufficient ${fromToken.symbol} balance`;
    if (balances.ETH === 0n) return `You need ${NATIVE_SYMBOL} to pay for gas`;
    if (quoteError) return quoteError;
    if (quoting || !quote) return 'Fetching best price…';
    return null;
  }, [fromToken, toToken, amount, parsed, balances, quoteError, quoting, quote, contractCheck.problems]);

  // ── Actions ────────────────────────────────────────────────────────────
  const flip = () => {
    if (busy) return;
    clearFinished();
    setFromId(toId);
    setToId(fromId);
    setAmount('');
  };

  const maxAmount = (() => {
    const bal = balances[fromToken.id] ?? 0n;
    const reserve = fromToken.isNative ? parseEther('0.005') : 0n; // keep some of the gas coin for fees
    return formatUnits(bal > reserve ? bal - reserve : 0n, fromToken.decimals);
  })();
  const isMax = amount !== '' && amount === maxAmount && maxAmount !== '0';
  /** MAX works as a toggle: first click fills the maximum, clicking it again clears the amount. */
  const setMax = () => changeAmount(isMax ? '' : maxAmount);

  const fail = (step: TxState['step'], e: unknown, hash?: Hex) => {
    if (!accountRef.current && !hash) return;
    const { message, rejected } = parseTxError(e);
    setTx({ step, phase: 'error', message, hash });
    push({ kind: 'error', title: rejected ? 'Request rejected' : step === 'approve' ? 'Approval failed' : 'Swap failed', message });
  };

  const approve = async () => {
    if (!walletClient || !account || !fromToken.address || !spender || !parsed || busy) return;
    setTx({ step: 'approve', phase: 'wallet' });
    try {
      // Approve exactly the amount being swapped (not unlimited): safer default.
      await publicClient.simulateContract({ account, address: fromToken.address, abi: erc20Abi, functionName: 'approve', args: [spender, parsed] });
      if (!accountRef.current) return;
      const hash = await walletClient.writeContract({ account, chain: ACTIVE_CHAIN, address: fromToken.address, abi: erc20Abi, functionName: 'approve', args: [spender, parsed] });
      setTx({ step: 'approve', phase: 'pending', hash });
      const receipt = await waitForReceiptPatiently(publicClient, hash, { onNote: setPendingNote });
      if (receipt.status !== 'success') throw new Error('Approval transaction reverted on-chain.');
      await waitForAllowance(publicClient, fromToken.address, account, spender, parsed);
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
    const { path, fee } = quote;
    let hash: Hex | undefined;
    try {
      // ETH out: swap to the router, then unwrapWETH9 to the user. Otherwise pay the user directly.
      const value = fromToken.isNative ? parsed : 0n;
      let calls: Hex[];
      let simulate: () => Promise<unknown>;
      let send: () => Promise<Hex>;
      if (IS_BNB_CHAIN) {
        // PancakeSwap V3 SwapRouter: deadline inside the params, multicall(bytes[]), router address as temporary recipient.
        const swapData = encodeFunctionData({
          abi: pancakeSwapRouterAbi,
          functionName: 'exactInputSingle',
          args: [{
            tokenIn: path[0], tokenOut: path[1], fee,
            recipient: toToken.isNative ? router : account,
            deadline, amountIn: parsed, amountOutMinimum: minReceived, sqrtPriceLimitX96: 0n,
          }],
        });
        calls = [swapData];
        if (toToken.isNative) calls.push(encodeFunctionData({ abi: pancakeSwapRouterAbi, functionName: 'unwrapWETH9', args: [minReceived, account] }));
        const p = { account, address: router, abi: pancakeSwapRouterAbi, functionName: 'multicall', args: [calls], value } as const;
        simulate = () => publicClient.simulateContract(p);
        send = () => walletClient.writeContract({ ...p, chain: ACTIVE_CHAIN });
      } else {
        // ETH out: swap to the router, then unwrapWETH9 to the user. Otherwise pay the user directly.
        const swapData = encodeFunctionData({
          abi: swapRouterAbi,
          functionName: 'exactInputSingle',
          args: [{
            tokenIn: path[0], tokenOut: path[1], fee,
            recipient: toToken.isNative ? ROUTER_AS_RECIPIENT : account,
            amountIn: parsed, amountOutMinimum: minReceived, sqrtPriceLimitX96: 0n,
          }],
        });
        calls = [swapData];
        if (toToken.isNative) calls.push(encodeFunctionData({ abi: swapRouterAbi, functionName: 'unwrapWETH9', args: [minReceived, account] }));
        const p = { account, address: router, abi: swapRouterAbi, functionName: 'multicall', args: [deadline, calls], value } as const;
        simulate = () => publicClient.simulateContract(p);
        send = () => walletClient.writeContract({ ...p, chain: ACTIVE_CHAIN });
      }
      // simulateContract throws with a decoded revert reason BEFORE MetaMask opens.
      await simulate();
      if (!accountRef.current) return;
      hash = await send();
      setTx({ step: 'swap', phase: 'pending', hash });
      const receipt = await waitForReceiptPatiently(publicClient, hash, { onNote: setPendingNote });
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
    quote, quoting, minReceived, routeSymbols, feeWei, blocker, needsApproval, busy, tx, setTx, pendingNote,
    flip, setMax, isMax, approve, swap,
  };
}
