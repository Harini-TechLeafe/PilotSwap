export interface ParsedError {
  message: string;
  rejected: boolean;
}

/** Turns viem / MetaMask / RPC errors into short, actionable messages. */
export function parseTxError(err: unknown): ParsedError {
  const chain: any[] = [];
  let cur: any = err;
  for (let i = 0; cur && i < 8; i++) {
    chain.push(cur);
    cur = cur.cause;
  }
  const text = chain
    .map((c) => `${c?.shortMessage ?? ''} ${c?.message ?? ''} ${c?.details ?? ''} ${c?.reason ?? ''}`)
    .join(' ')
    .toLowerCase();

  if (chain.some((c) => c?.code === 4001 || c?.name === 'UserRejectedRequestError') || text.includes('user rejected') || text.includes('user denied')) {
    return { message: 'You rejected the request in MetaMask. Nothing was sent.', rejected: true };
  }
  if (text.includes('insufficient funds')) return { message: 'Not enough ETH to pay for gas. Get more testnet ETH from a faucet.', rejected: false };
  if (text.includes('insufficient_output_amount')) return { message: 'Price moved beyond your slippage tolerance. Raise slippage or try again.', rejected: false };
  if (text.includes('insufficient_liquidity') || text.includes('insufficient_input_amount')) return { message: 'Not enough liquidity in this pool for that amount.', rejected: false };
  if (text.includes('expired')) return { message: 'The transaction deadline expired. Please try again.', rejected: false };
  if (text.includes('transfer_from_failed') || text.includes('transferhelper') || text.includes('allowance')) return { message: 'Token transfer failed. Check your balance and approval.', rejected: false };
  if (text.includes('chain') && text.includes('match')) return { message: 'Wrong network. Please switch to the supported network.', rejected: false };
  const base = (chain[0]?.shortMessage ?? chain[0]?.message ?? 'Unknown error') as string;
  return { message: base.length > 220 ? `${base.slice(0, 220)}…` : base, rejected: false };
}
