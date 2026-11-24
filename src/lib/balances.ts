  import { erc20Abi, type Address } from 'viem';
import type { Token } from '../config/token';
import { isRpcRequestError } from './errors';
import { withRetry } from './retry';

/** The two reads we need from a viem public client (lets tests pass a fake client). */
export interface BalanceClient {
  getBalance: (args: { address: Address }) => Promise<bigint>;
  readContract: (args: any) => Promise<any>;
}

export interface BalanceReadResult {
  /** [token id, balance]. balance is undefined when the read FAILED (never 0 for a failure). */
  entries: [string, bigint | undefined][];
  /** Symbols whose read failed because of RPC trouble (timeout, HTTP error, rate limit). */
  failed: string[];
  /** Tokens whose address is not a working token contract on this network. */
  badToken: string[];
}

/**
 * Reads native + ERC-20 balances for `account`.
 *  - native coin  -> getBalance
 *  - ERC-20       -> balanceOf(account)
 *  - token with no address in .env -> 0n (not configured)
 *  - failed read  -> undefined (so the UI can say "could not read" instead of "you have 0")
 */
export async function readBalances(
  client: BalanceClient,
  account: Address,
  tokens: Token[],
  retry: <T>(fn: () => Promise<T>) => Promise<T> = (fn) => withRetry(fn),
): Promise<BalanceReadResult> {
  const failed: string[] = [];
  const badToken: string[] = [];
  const entries = await Promise.all(
    tokens.map(async (t): Promise<[string, bigint | undefined]> => {
      try {
        if (t.isNative) return [t.id, await retry(() => client.getBalance({ address: account }))];
        if (!t.address) return [t.id, 0n]; // token not configured in .env
        const tokenAddress = t.address;
        return [t.id, await retry(() => client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [account] }) as Promise<bigint>)];
      } catch (e) {
        if (isRpcRequestError(e)) failed.push(t.symbol);
        else badToken.push(`${t.symbol} (${t.address})`);
        return [t.id, undefined];
      }
    }),
  );
  return { entries, failed, badToken };
}
