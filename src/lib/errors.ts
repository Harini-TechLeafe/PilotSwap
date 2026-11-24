import { NATIVE_SYMBOL } from '../config/chains';

export interface ParsedError {
  message: string;
  rejected: boolean;
  /** Raw technical reason (revert reason / RPC message), for a "details" line. */
  detail?: string;
}

/** The most specific message in an error's cause chain. */
function rawDetail(err: unknown): string | undefined {
  let cur: any = err;
  let best: string | undefined;
  for (let i = 0; cur && typeof cur === 'object' && i < 8; i++) {
    const m = [cur.reason, cur.details, cur.shortMessage, cur.message].find((x) => typeof x === 'string' && x.trim());
    if (m) best = m as string;
    cur = cur.cause;
  }
  return best ? best.replace(/\s+/g, ' ').trim().slice(0, 500) : undefined;
}

function errorText(err: unknown): string {
  const chain: { shortMessage?: string; message?: string; details?: string; reason?: string; cause?: unknown }[] = [];
  let cur = err;
  for (let i = 0; cur && i < 8; i++) {
    if (typeof cur !== 'object') break;
    const item = cur as { shortMessage?: string; message?: string; details?: string; reason?: string; cause?: unknown };
    chain.push(item);
    cur = item.cause;
  }
  return chain
    .map((item) => `${item.shortMessage ?? ''} ${item.message ?? ''} ${item.details ?? ''} ${item.reason ?? ''}`)
    .join(' ')
    .toLowerCase();
}

export function isRpcRequestError(err: unknown): boolean {
  return /http request failed|failed to fetch|fetch failed|networkerror|network request failed|connection refused|socket hang up|timed? out|timeout/.test(errorText(err));
}

/** Turns viem / MetaMask / RPC errors into short, actionable messages. */
export function parseTxError(err: unknown): ParsedError {
  const result = parseTxErrorMessage(err);
  return result.rejected ? result : { ...result, detail: rawDetail(err) };
}

function parseTxErrorMessage(err: unknown): ParsedError {
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
  if (chain.some((c) => c?.code === -32002) || text.includes('request already pending')) {
    return { message: 'A wallet request is already pending. Open your wallet, finish or reject that request, then try again.', rejected: false };
  }
  if (chain.some((c) => c?.code === 4900 || c?.code === 4901) || text.includes('provider is disconnected')) {
    return { message: 'Your wallet is disconnected. Reconnect it and try again.', rejected: false };
  }
  if (isRpcRequestError(err)) {
    return {
      message: "PilotSwap could not reach the blockchain RPC. Check your internet connection and the active chain's RPC URL in your local .env, then retry. Keep RPC/API keys private.",
      rejected: false,
    };
  }
  if (text.includes('insufficient funds')) return { message: `Not enough ${NATIVE_SYMBOL} to pay for gas. Get more testnet ${NATIVE_SYMBOL} from a faucet.`, rejected: false };
  // V3 revert reasons
  if (text.includes('too little received')) return { message: 'Price moved beyond your slippage tolerance. Raise slippage or try again.', rejected: false };
  if (/\bstf\b/.test(text)) return { message: 'Token transfer failed. Check your balance and approval.', rejected: false };
  if (text.includes('price slippage check')) {
    return {
      message: 'Liquidity reverted because the amounts used would be below the required minimum. The pool price may be outside your selected range (below its lower bound or above its upper bound), or your deposit ratio may not fit the range. Choose a range that includes the current price and review both amounts, then try again.',
      rejected: false,
    };
  }
  if (text.includes('insufficient_output_amount')) return { message: 'Price moved beyond your slippage tolerance. Raise slippage or try again.', rejected: false };
  if (text.includes('insufficient_liquidity') || text.includes('insufficient_input_amount')) return { message: 'Not enough liquidity in this pool for that amount.', rejected: false };
  if (text.includes('expired')) return { message: 'The transaction deadline expired. Please try again.', rejected: false };
  if (text.includes('transfer_from_failed') || text.includes('transferhelper') || text.includes('allowance')) return { message: 'Token transfer failed. Check your balance and approval.', rejected: false };
  if (text.includes('chain') && text.includes('match')) return { message: 'Wrong network. Please switch to the supported network.', rejected: false };
  const base = (chain[0]?.shortMessage ?? chain[0]?.message ?? 'Unknown error') as string;
  return { message: base.length > 220 ? `${base.slice(0, 220)}…` : base, rejected: false };
}
