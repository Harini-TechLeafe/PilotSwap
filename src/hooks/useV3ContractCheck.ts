import { useEffect, useState } from 'react';
import type { Address } from 'viem';
import { ENV_PREFIX, publicClient } from '../config/chains';
import { FACTORY_ADDRESS, POSITION_MANAGER_ADDRESS, QUOTER_ADDRESS, SWAP_ROUTER_ADDRESS, WETH_ADDRESS, peripheryAbi } from '../config/contracts';
import { isRpcRequestError } from '../lib/errors';

/**
 * Checks, once per page load, that the V3 contract addresses in .env belong together:
 * the position manager, router and quoter must all have been deployed with the SAME factory and WETH9 as
 * VITE_*_FACTORY_ADDRESS / VITE_*_WETH_ADDRESS. A wrong WETH address is the classic reason "add liquidity" with
 * the native coin reverts (the position manager then treats WETH as an ordinary token and tries to pull it
 * from your wallet). Returns plain-English problems naming the exact variable to fix.
 */
const PREFIX = ENV_PREFIX;
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

let cached: Promise<string[]> | null = null;

async function run(): Promise<string[]> {
  const problems: string[] = [];
  const targets: [string, string, Address | null, boolean][] = [
    ['position manager', `${PREFIX}POSITION_MANAGER_ADDRESS`, POSITION_MANAGER_ADDRESS, true],
    ['swap router', `${PREFIX}SWAP_ROUTER_ADDRESS`, SWAP_ROUTER_ADDRESS, false],
    ['quoter', `${PREFIX}QUOTER_ADDRESS`, QUOTER_ADDRESS, false],
  ];
  await Promise.all(
    targets.map(async ([label, envName, addr, strict]) => {
      if (!addr) return; // missing addresses are reported by getConfigIssues()
      const [factory, weth] = await Promise.allSettled([
        publicClient.readContract({ address: addr, abi: peripheryAbi, functionName: 'factory' }),
        publicClient.readContract({ address: addr, abi: peripheryAbi, functionName: 'WETH9' }),
      ]);
      if (factory.status === 'rejected' && weth.status === 'rejected') {
        // Unreachable RPC: say nothing (other screens report it). Otherwise the address is not a contract.
        if (strict && !isRpcRequestError(factory.reason)) problems.push(`${envName} (${addr}) is not a valid ${label} contract on this network. Check the address and the network.`);
        return;
      }
      if (factory.status === 'fulfilled' && FACTORY_ADDRESS && !same(factory.value, FACTORY_ADDRESS)) {
        problems.push(`The ${label} uses factory ${factory.value}, but ${PREFIX}FACTORY_ADDRESS is ${FACTORY_ADDRESS}. Set ${PREFIX}FACTORY_ADDRESS=${factory.value}.`);
      }
      if (weth.status === 'fulfilled' && WETH_ADDRESS && !same(weth.value, WETH_ADDRESS)) {
        problems.push(`The ${label} uses WETH ${weth.value}, but ${PREFIX}WETH_ADDRESS is ${WETH_ADDRESS}. Set ${PREFIX}WETH_ADDRESS=${weth.value}.`);
      }
    }),
  );
  return Array.from(new Set(problems));
}

export function useV3ContractCheck(): { checked: boolean; problems: string[] } {
  const [state, setState] = useState<{ checked: boolean; problems: string[] }>({ checked: false, problems: [] });
  useEffect(() => {
    let off = false;
    cached ??= run().catch(() => []);
    void cached.then((problems) => { if (!off) setState({ checked: true, problems }); });
    return () => { off = true; };
  }, []);
  return state;
}
