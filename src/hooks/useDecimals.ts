import { useEffect } from 'react';
import { erc20Abi } from 'viem';
import { publicClient } from '../config/chains';
import { TOKENS, setTokenDecimals } from '../config/tokens';
import { withRetry } from '../lib/retry';

/**
 * Reads `decimals()` from every configured ERC-20 on the active chain and corrects TOKENS in place, then
 * notifies the UI so balances and amounts redraw with the right precision.
 *
 * Why it matters: the config guesses USDC has 18 decimals, but real / faucet USDC has 6. With the wrong guess a
 * balance of 10 USDC is shown as "<0.00001", which looks like the faucet funds never arrived.
 * A token whose read fails (RPC hiccup) is retried on the next mount instead of being given up on.
 */
export function useDecimals(): void {
  useEffect(() => {
    const tokens = TOKENS.filter((t) => !t.isNative && t.address);
    if (!tokens.length) return;
    let off = false;
    void Promise.allSettled(
      tokens.map(async (t) => {
        const raw = await withRetry(() => publicClient.readContract({ address: t.address!, abi: erc20Abi, functionName: 'decimals' }), 4, 800);
        const d = Number(raw);
        if (!off && Number.isInteger(d) && d >= 0 && d <= 36 && d !== t.decimals) {
          console.warn(`[PilotSwap] ${t.symbol} (${t.address}): on-chain decimals = ${d}, config had ${t.decimals}. Auto-corrected.`);
          setTokenDecimals(t.id, d);
        }
      }),
    );
    return () => { off = true; };
  }, []);
}
