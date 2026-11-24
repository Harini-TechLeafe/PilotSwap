import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { encodeFunctionData, erc20Abi, zeroAddress, type Address, type Hex } from 'viem';
import { ACTIVE_CHAIN, NATIVE_SYMBOL, explorerTxUrl, publicClient } from '../config/chains';
import {
  DEADLINE_MINUTES, FACTORY_ADDRESS, FEE_TIERS, POSITION_MANAGER_ADDRESS, WETH_ADDRESS,
  factoryAbi, poolAbi, positionManagerAbi,
} from '../config/contracts';
import { getToken, isTokenConfigured } from '../config/tokens';
import { parseTxError } from '../lib/errors';
import { formatAmount, parseAmount } from '../lib/format';
import { sortTokens, sqrtPriceX96FromAmounts, tickFromPrice, priceFromSqrtX96, tickRange, token1PerToken0, type RangeMode } from '../lib/v3';
import { waitForAllowance } from '../lib/allowance';
import { useToast } from '../components/Toast';
import { useV3ContractCheck } from './useV3ContractCheck';
import { withRetry } from '../lib/retry';
import { waitForReceiptPatiently } from '../lib/receipt';
import { useWallet } from './useWallet';

export interface PoolState {
  exists: boolean;
  address: Address | null;
  sqrtPriceX96: bigint | null;
  tick: number | null;
  liquidity: bigint;
}

export type LiqStatus =
  | { phase: 'idle' }
  | { phase: 'checking' | 'wallet' | 'pending'; step: 'approval' | 'liquidity'; label: string; hash?: Hex }
  | { phase: 'success'; message: string; hash: Hex }
  | { phase: 'error'; message: string; hash?: Hex; detail?: string };

interface Args {
  tokenAId: string;
  tokenBId: string;
  fee: number;
  range: RangeMode;
  amountA: string;
  amountB: string;
  balances: Record<string, bigint>;
  balancesLoading: boolean;
  refreshBalances: () => Promise<void>;
}

const wrapped = (id: string): Address | null => {
  const t = getToken(id);
  return t.isNative ? WETH_ADDRESS : t.address;
};

/** V3 flow: (create + initialize pool if missing) → approve → mint position. */
export function useV3Liquidity({ tokenAId, tokenBId, fee, range, amountA, amountB, balances, balancesLoading, refreshBalances }: Args) {
  const { account, walletClient, isConnected, isWrongNetwork } = useWallet();
  const { push } = useToast();
  const contractCheck = useV3ContractCheck();
  const ready = isConnected && !isWrongNetwork && !!account;
  const accountRef = useRef(account);
  useEffect(() => { accountRef.current = account; }, [account]);

  const tokenA = getToken(tokenAId);
  const tokenB = getToken(tokenBId);
  const addrA = wrapped(tokenAId);
  const addrB = wrapped(tokenBId);
  const spacing = FEE_TIERS.find((f) => f.fee === fee)?.tickSpacing ?? 60;

  const [pool, setPool] = useState<PoolState>({ exists: false, address: null, sqrtPriceX96: null, tick: null, liquidity: 0n });
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolReadError, setPoolReadError] = useState<string | null>(null);
  const poolReq = useRef(0); // only the latest pool read may update state
  const [status, setStatus] = useState<LiqStatus>({ phase: 'idle' });
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const busy = status.phase === 'checking' || status.phase === 'wallet' || status.phase === 'pending';
  // Abort controller for the active submit() call. Replaced on each new submit; signal is passed
  // to interruptible helpers (waitForAllowance) so they exit cleanly when the user cancels.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (account || (status.phase !== 'checking' && status.phase !== 'wallet')) return;
    // Wallet disconnected mid-flow: abort any pending helpers and surface an error immediately
    // so the UI never stays frozen in 'checking' or 'wallet' state.
    abortRef.current?.abort();
    setStatus({ phase: 'error', message: 'Could not process because your wallet disconnected. Reconnect and try again.' });
  }, [account, status.phase]);

  // ── Does the pool already exist? Read its current price. ───────────────
  const loadPool = useCallback(async (): Promise<boolean> => {
    const req = ++poolReq.current;
    const stale = () => req !== poolReq.current;
    setPoolReadError(null);
    if (!FACTORY_ADDRESS || !addrA || !addrB || addrA === addrB) {
      setPool({ exists: false, address: null, sqrtPriceX96: null, tick: null, liquidity: 0n });
      return false;
    }
    setPoolLoading(true);
    try {
      const factory = FACTORY_ADDRESS;
      const address = await withRetry(() => publicClient.readContract({ address: factory, abi: factoryAbi, functionName: 'getPool', args: [addrA, addrB, fee] }));
      if (stale()) return false;
      if (address === zeroAddress) {
        setPool({ exists: false, address: null, sqrtPriceX96: null, tick: null, liquidity: 0n });
        return true;
      }
      const [slot0, liquidity] = await withRetry(() => Promise.all([
        publicClient.readContract({ address, abi: poolAbi, functionName: 'slot0' }),
        publicClient.readContract({ address, abi: poolAbi, functionName: 'liquidity' }),
      ]));
      if (stale()) return false;
      // A pool that was created but never initialized has sqrtPrice 0 → treat as "needs init".
      const initialized = slot0[0] > 0n;
      setPool({ exists: initialized, address, sqrtPriceX96: initialized ? slot0[0] : null, tick: initialized ? slot0[1] : null, liquidity });
      return true;
    } catch (e) {
      if (stale()) return false;
      const { message } = parseTxError(e);
      setPool({ exists: false, address: null, sqrtPriceX96: null, tick: null, liquidity: 0n });
      setPoolReadError(`Could not read this pool from ${ACTIVE_CHAIN.name}. ${message}`);
      return false;
    } finally {
      if (!stale()) setPoolLoading(false);
    }
  }, [addrA, addrB, fee]);
  useEffect(() => { void loadPool(); }, [loadPool]);

  // Raw token0/token1 ordering for the pair.
  const order = useMemo(() => (addrA && addrB && addrA !== addrB ? sortTokens(addrA, addrB) : null), [addrA, addrB]);
  const aIsToken0 = order ? !order[2] : true;

  const parsedA = useMemo(() => parseAmount(amountA, tokenA.decimals), [amountA, tokenA.decimals]);
  const parsedB = useMemo(() => parseAmount(amountB, tokenB.decimals), [amountB, tokenB.decimals]);

  /** Tick range: around the live pool tick, or around the price implied by the deposit for a new pool. */
  const ticks = useMemo(() => {
    // The tick helpers throw on bad input; a throw during render would blank the whole app, so degrade to null.
    try {
      if (pool.exists && pool.tick !== null) return tickRange(pool.tick, spacing, range);
      if (parsedA && parsedB && parsedA > 0n && parsedB > 0n) {
        const [a0, a1] = aIsToken0 ? [parsedA, parsedB] : [parsedB, parsedA];
        return tickRange(tickFromPrice(Number(a1) / Number(a0)), spacing, range);
      }
    } catch {
      /* fall through */
    }
    return null;
  }, [pool, spacing, range, parsedA, parsedB, aIsToken0]);

  /**
   * When the pool exists, the 2nd amount follows from the 1st (V3 needs a specific ratio for the range).
   * Returns how many B per 1 A in human units, or null when it can't be derived (new pool / out of range).
   */
  const pairedRatio = useMemo(() => {
    if (!pool.exists || pool.sqrtPriceX96 === null || !ticks) return null;
    const r = token1PerToken0(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper); // raw t1 per raw t0
    if (r === null) return null;
    const rawBperA = aIsToken0 ? r : 1 / r;
    return rawBperA * 10 ** (tokenA.decimals - tokenB.decimals);
  }, [pool, ticks, aIsToken0, tokenA.decimals, tokenB.decimals]);

  /** Human price: 1 A = X B (from the live pool, or from the initial deposit ratio). */
  const price = useMemo(() => {
    let raw: number | null = null; // raw token1 per raw token0
    if (pool.exists && pool.sqrtPriceX96 !== null) raw = priceFromSqrtX96(pool.sqrtPriceX96);
    else if (parsedA && parsedB && parsedA > 0n && parsedB > 0n) raw = aIsToken0 ? Number(parsedB) / Number(parsedA) : Number(parsedA) / Number(parsedB);
    if (raw === null || !Number.isFinite(raw)) return null;
    const bPerA = aIsToken0 ? raw : 1 / raw;
    return bPerA * 10 ** (tokenA.decimals - tokenB.decimals);
  }, [pool, parsedA, parsedB, aIsToken0, tokenA.decimals, tokenB.decimals]);

  const blocker = useMemo<string | null>(() => {
    if (!FACTORY_ADDRESS || !POSITION_MANAGER_ADDRESS || !WETH_ADDRESS) return 'Liquidity contracts are not configured (.env)';
    if (contractCheck.problems.length) return contractCheck.problems[0];
    if (poolLoading) return 'Checking pool status…';
    if (poolReadError) return 'Could not verify the pool. Retry the pool check before continuing.';
    if (tokenAId === tokenBId) return 'Select two different tokens';
    if (!isTokenConfigured(tokenA)) return `${tokenA.symbol} address is not configured`;
    if (!isTokenConfigured(tokenB)) return `${tokenB.symbol} address is not configured`;
    if (!addrA || !addrB || addrA === addrB) return `${NATIVE_SYMBOL} and ${getToken('WETH').symbol} are the same pool token. Pick another pair`;
    if (!ready) return 'Connect your wallet on the right network';
    if (!parsedA || !parsedB || parsedA <= 0n || parsedB <= 0n) return 'Enter both amounts';
    if (balancesLoading) return 'Loading wallet balances…';
    if (balances[tokenA.id] === undefined || balances[tokenB.id] === undefined) return 'Reading wallet balances…';
    if (parsedA > balances[tokenA.id]) return `Insufficient ${tokenA.symbol} balance`;
    if (parsedB > balances[tokenB.id]) return `Insufficient ${tokenB.symbol} balance`;
    if (!ticks) return 'Enter both amounts';
    return null;
  }, [tokenAId, tokenBId, tokenA, tokenB, addrA, addrB, ready, parsedA, parsedB, balances, balancesLoading, ticks, poolLoading, poolReadError, contractCheck.problems]);

  const submit = async () => {
    if (!busy && (!account || !walletClient)) {
      setStatus({ phase: 'error', message: 'Your wallet is not connected. Connect your wallet and try again. No transaction was sent.' });
      return;
    }
    if (blocker || busy || !walletClient || !account || !POSITION_MANAGER_ADDRESS || !order || !ticks || !parsedA || !parsedB || !addrA || !addrB) return;
    const manager = POSITION_MANAGER_ADDRESS;
    // A fresh AbortController for this invocation; previous one (if any) is superseded.
    const ac = new AbortController();
    abortRef.current = ac;
    let currentHash: Hex | undefined;
    const fail = (e: unknown, hash?: Hex) => {
      // FIX: previously returned silently when account was gone and no hash, leaving the UI
      // stuck in the last 'checking' or 'wallet' phase with no way out. Now always surface an
      // error unless the submit was deliberately aborted (ac.signal.aborted).
      if (ac.signal.aborted) return;
      const { message, rejected, detail } = parseTxError(e);
      setStatus({ phase: 'error', message, hash, detail });
      push({ kind: 'error', title: rejected ? 'Request rejected' : 'Add liquidity failed', message });
    };
    const waitForReceipt = (hash: Hex, label: string, step: 'approval' | 'liquidity') =>
      waitForReceiptPatiently(publicClient, hash, {
        onNote: setPendingNote,
        onLongWait: () => setStatus({ phase: 'pending', step, label: `Still waiting for ${label} confirmation…`, hash }),
      });
    try {
      setStatus({ phase: 'checking', step: 'approval', label: 'Checking token approvals…' });
      // 1) Approve each ERC-20 side (exact amount) to the position manager.
      for (const [tok, amt] of [[tokenA, parsedA], [tokenB, parsedB]] as const) {
        currentHash = undefined;
        if (tok.isNative || !tok.address) continue;
        setStatus({ phase: 'checking', step: 'approval', label: `Checking ${tok.symbol} approval…` });
        const allowance = await publicClient.readContract({ address: tok.address, abi: erc20Abi, functionName: 'allowance', args: [account, manager] });
        if (ac.signal.aborted) return;
        if (allowance >= amt) continue;
        setStatus({ phase: 'checking', step: 'approval', label: `Preparing ${tok.symbol} approval…` });
        const req = { account, address: tok.address, abi: erc20Abi, functionName: 'approve', args: [manager, amt] } as const;
        await publicClient.simulateContract(req);
        if (ac.signal.aborted) return;
        setStatus({ phase: 'wallet', step: 'approval', label: `Approve ${tok.symbol}` });
        currentHash = await walletClient.writeContract({ ...req, chain: ACTIVE_CHAIN });
        setStatus({ phase: 'pending', step: 'approval', label: `Approving ${tok.symbol}…`, hash: currentHash });
        const r = await waitForReceipt(currentHash, `${tok.symbol} approval`, 'approval');
        if (r.status !== 'success') throw new Error(`${tok.symbol} approval reverted on-chain.`);
        if (ac.signal.aborted) return;
        setStatus({ phase: 'checking', step: 'approval', label: `${tok.symbol} approved — syncing allowance…` });
        // FIX: pass the AbortSignal so this loop exits immediately when the submit is cancelled
        // rather than spinning for up to 30 s and leaving the UI stuck in 'checking'.
        await waitForAllowance(publicClient, tok.address, account, manager, amt, 30_000, ac.signal);
        if (ac.signal.aborted) return;
      }

      // 2) Build [create+initialize pool if needed, mint position, refund leftover ETH].
      const [token0, token1] = order;
      const [amt0, amt1] = aIsToken0 ? [parsedA, parsedB] : [parsedB, parsedA];
      // Mint amounts are maximums; allow small leftovers from price/range rounding.
      const min0 = (amt0 * 97n) / 100n;
      const min1 = (amt1 * 97n) / 100n;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_MINUTES * 60);

      const calls: Hex[] = [];
      if (!pool.exists) {
        calls.push(encodeFunctionData({
          abi: positionManagerAbi, functionName: 'createAndInitializePoolIfNecessary',
          args: [token0, token1, fee, sqrtPriceX96FromAmounts(amt0, amt1)],
        }));
      }
      calls.push(encodeFunctionData({
        abi: positionManagerAbi, functionName: 'mint',
        args: [{ token0, token1, fee, tickLower: ticks.tickLower, tickUpper: ticks.tickUpper, amount0Desired: amt0, amount1Desired: amt1, amount0Min: min0, amount1Min: min1, recipient: account, deadline }],
      }));
      const ethValue = tokenA.isNative ? parsedA : tokenB.isNative ? parsedB : 0n;
      if (ethValue > 0n) calls.push(encodeFunctionData({ abi: positionManagerAbi, functionName: 'refundETH' }));

      setStatus({ phase: 'checking', step: 'liquidity', label: 'Simulating liquidity transaction…' });
      const req = { account, address: manager, abi: positionManagerAbi, functionName: 'multicall', args: [calls], value: ethValue } as const;
      await publicClient.simulateContract(req); // surfaces the revert reason before the wallet opens
      if (ac.signal.aborted) return;
      currentHash = undefined;
      setStatus({ phase: 'wallet', step: 'liquidity', label: pool.exists ? 'Add liquidity' : 'Create pool & add liquidity' });
      const hash = await walletClient.writeContract({ ...req, chain: ACTIVE_CHAIN });
      currentHash = hash;
      setStatus({ phase: 'pending', step: 'liquidity', label: 'Waiting for confirmation…', hash });
      const receipt = await waitForReceipt(hash, 'liquidity transaction', 'liquidity');
      if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain.');

      const message = pool.exists ? 'Liquidity position minted.' : 'Pool created and liquidity added. You can now swap this pair.';
      setStatus({ phase: 'success', message, hash });
      push({ kind: 'success', title: pool.exists ? 'Liquidity added' : 'Pool created', message, href: explorerTxUrl(hash) });
      await Promise.all([refreshBalances(), loadPool()]);
    } catch (e) {
      fail(e, currentHash);
    }
  };

  const fmt = (v: bigint, d: number) => formatAmount(v, d, 6);
  /** Cancel an in-progress submit (e.g. user clicks hide/close while in 'checking' or 'wallet'). */
  const cancelSubmit = () => { abortRef.current?.abort(); };
  return { contractProblems: contractCheck.problems, pool, poolLoading, poolReadError, loadPool, price, pairedRatio, ticks, blocker, status, setStatus, pendingNote, busy, submit, cancelSubmit, fmt, tokenA, tokenB };
}
