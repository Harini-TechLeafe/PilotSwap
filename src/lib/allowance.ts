import { erc20Abi, type Address, type PublicClient } from 'viem';

/** Wait for the RPC to reflect an approved allowance before simulating the next transaction.
 *  Pass an AbortSignal to cancel the loop when the operation is abandoned. */
export async function waitForAllowance(
  publicClient: PublicClient,
  token: Address,
  owner: Address,
  spender: Address,
  needed: bigint,
  timeoutMs = 30_000,
  signal?: AbortSignal,
): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (signal?.aborted) return; // cancelled – exit without throwing so the caller decides
    const allowance = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, spender],
    });
    if (allowance >= needed) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error('Approval was mined but your RPC still shows no allowance. Wait a few seconds and try again.');
    }
    // Interruptible sleep: resolve early when the signal fires.
    await new Promise<void>((resolve) => {
      const tid = setTimeout(resolve, 1500);
      signal?.addEventListener('abort', () => { clearTimeout(tid); resolve(); }, { once: true });
    });
  }
}
