import { useCallback, useEffect, useState } from 'react';
import { erc20Abi, type Address } from 'viem';
import { publicClient } from '../config/chains';
import { TOKENS } from '../config/tokens';

/** Reads native + ERC-20 balances for the connected account and polls every 15 s. */
export function useBalances(account: Address | null, enabled: boolean) {
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!account || !enabled) {
      setBalances({});
      return;
    }
    setLoading(true);
    const entries = await Promise.all(
      TOKENS.map(async (t): Promise<[string, bigint]> => {
        try {
          if (t.isNative) return [t.id, await publicClient.getBalance({ address: account })];
          if (!t.address) return [t.id, 0n];
          return [t.id, await publicClient.readContract({ address: t.address, abi: erc20Abi, functionName: 'balanceOf', args: [account] })];
        } catch {
          return [t.id, 0n];
        }
      }),
    );
    setBalances(Object.fromEntries(entries));
    setLoading(false);
  }, [account, enabled]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { balances, loading, refresh };
}
