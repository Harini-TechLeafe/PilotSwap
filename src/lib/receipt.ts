import { WaitForTransactionReceiptTimeoutError, type Hex, type PublicClient, type TransactionReceipt } from 'viem';

/**
 * Waits for a transaction receipt without ever giving up early.
 * - polls every 2s (viem's default is 4s)
 * - viem throws after 3 minutes; that is NOT a failure (the transaction may still be mined), so keep waiting
 * - after 45s it inspects the transaction and reports why it is slow through `onNote`
 */
export async function waitForReceiptPatiently(
  client: PublicClient,
  hash: Hex,
  opts: { onNote?: (note: string | null) => void; onLongWait?: () => void } = {},
): Promise<TransactionReceipt> {
  const started = Date.now();
  const watcher = window.setInterval(async () => {
    if (Date.now() - started < 45_000) return;
    try {
      const tx = await client.getTransaction({ hash });
      if (tx.blockNumber) return; // mined; the receipt is about to arrive
      const network = await client.getGasPrice();
      const paid = tx.maxFeePerGas ?? tx.gasPrice;
      opts.onNote?.(paid !== undefined && paid < network
        ? `Your wallet set a gas fee (${(Number(paid) / 1e9).toFixed(2)} gwei) below the current network fee (${(Number(network) / 1e9).toFixed(2)} gwei), so validators are skipping it. Open your wallet and use “Speed up” on this transaction.`
        : 'The network has your transaction and it is waiting to be included in a block. This can take a while when the testnet is busy.');
    } catch {
      opts.onNote?.('The network node PilotSwap is connected to cannot see this transaction yet. It may still be propagating. Open the explorer link; if it shows “not found”, the wallet did not broadcast it, so check your wallet for a stuck earlier transaction (same nonce) and speed up or cancel it.');
    }
  }, 15_000);
  try {
    for (;;) {
      try {
        return await client.waitForTransactionReceipt({ hash, pollingInterval: 2_000 });
      } catch (e) {
        if (!(e instanceof WaitForTransactionReceiptTimeoutError)) throw e;
        opts.onLongWait?.();
      }
    }
  } finally {
    window.clearInterval(watcher);
    opts.onNote?.(null);
  }
}
