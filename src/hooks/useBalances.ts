import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { erc20Abi, type Address } from 'viem';
import { ACTIVE_CHAIN, ENV_PREFIX, publicClient } from '../config/chains';
import { TOKENS, getDecimalsVersion, subscribeDecimals } from '../config/tokens';
import { isRpcRequestError } from '../lib/errors';
import { withRetry } from '../lib/retry';

/**
 * Reads native + ERC-20 balances for the connected account and polls every 15 s.
 *  - A token whose read FAILS is left out of `balances` (undefined), not shown as 0. Screens can then say
 *    "could not read" instead of "you have nothing".
 *  - `loading` is true only until the first successful read; background polls never flip it.
 *  - A slow, older request can never overwrite the result of a newer one (or of another account).
 */
export function useBalances(account: Address | null, enabled: boolean) {
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useSyncExternalStore(subscribeDecimals, getDecimalsVersion); // redraw when a token's decimals get corrected
  const seq = useRef(0);
  const loadedFor = useRef<Address | null>(null);

  const refresh = useCallback(async () => {
    const id = ++seq.current;
    if (!account || !enabled) {
      loadedFor.current = null;
      setBalances({});
      setLoading(false);
      setError(null);
      return;
    }
    if (loadedFor.current !== account) {
      setBalances({});
      setLoading(true);
    }
    const failed: string[] = []; // RPC trouble
    const badToken: string[] = []; // the address is not a token on this network
    const entries = await Promise.all(
      TOKENS.map(async (t): Promise<[string, bigint | undefined]> => {
        try {
          if (t.isNative) return [t.id, await withRetry(() => publicClient.getBalance({ address: account }))];
          if (!t.address) return [t.id, 0n]; // token not configured in .env
          const tokenAddress = t.address;
          return [t.id, await withRetry(() => publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [account] }))];
        } catch (e) {
          if (isRpcRequestError(e)) failed.push(t.symbol);
          else badToken.push(`${t.symbol} (${t.address})`);
          return [t.id, undefined];
        }
      }),
    );
    if (id !== seq.current) return; // superseded by a newer refresh or an account change
    const sameAccount = loadedFor.current === account;
    setBalances((prev) => {
      const next: Record<string, bigint> = sameAccount ? { ...prev } : {};
      for (const [k, v] of entries) if (v !== undefined) next[k] = v;
      return next;
    });
    loadedFor.current = account;
    const prefix = ENV_PREFIX;
    setError(
      badToken.length
        ? `${badToken.join(', ')} could not be read on ${ACTIVE_CHAIN.name}: that address is not a token contract on this network. Check the matching ${prefix}…_ADDRESS value in .env and that the app is on ${ACTIVE_CHAIN.name}.`
        : failed.length
          ? `Could not read ${failed.join(', ')} from the ${ACTIVE_CHAIN.name} RPC after retrying. Set ${prefix}RPC_URL in .env to a working endpoint (e.g. a free Alchemy or Infura URL) and restart.`
          : null,
    );
    setLoading(false);
  }, [account, enabled]);

  useEffect(() => {
    void refresh();
    // Poll every 8s, and re-read right away when you come back to the tab (e.g. after claiming from a faucet).
    const timer = window.setInterval(() => void refresh(), 8_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return { balances, loading, error, refresh };
}
