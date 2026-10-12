import { useEffect, useState } from 'react';
import type { Address } from 'viem';
import { ACTIVE_CHAIN, publicClient } from '../config/chains';
import { SWAP_ROUTER_ADDRESS, WETH_ADDRESS } from '../config/contracts';
import { TOKENS } from '../config/tokens';

/**
 * Validates configured addresses on-chain: each must have contract code on the active chain.
 * Catches typos and addresses copied from the wrong network.
 */
export function useDeploymentCheck(): { checked: boolean; problems: string[] } {
  const [state, setState] = useState<{ checked: boolean; problems: string[] }>({ checked: false, problems: [] });

  useEffect(() => {
    let off = false;
    const targets: [string, Address | null][] = [
      ['Swap router', SWAP_ROUTER_ADDRESS],
      ['WETH', WETH_ADDRESS],
      ...TOKENS.filter((t) => !t.isNative).map((t): [string, Address | null] => [`${t.symbol} token`, t.address]),
    ];
    (async () => {
      const problems = new Set<string>();
      await Promise.all(
        targets.map(async ([label, addr]) => {
          if (!addr) return;
          try {
            const code = await publicClient.getCode({ address: addr });
            if (!code || code === '0x') problems.add(`${label} (${addr}) has no contract code on ${ACTIVE_CHAIN.name}. Check the address and VITE_CHAIN_ID.`);
          } catch {
            problems.add('Could not reach the RPC to verify contract addresses. Check VITE_RPC_URL.');
          }
        }),
      );
      if (!off) setState({ checked: true, problems: [...problems] });
    })();
    return () => {
      off = true;
    };
  }, []);

  return state;
}
