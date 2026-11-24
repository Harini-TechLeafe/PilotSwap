import { isRpcRequestError } from './errors';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs an RPC read and automatically retries it when the failure is a network / RPC problem
 * (HTTP error, timeout, rate limit). It does what clicking "Retry" used to do, without the click.
 * Real contract errors (wrong address, revert) are thrown immediately; retrying cannot fix those.
 */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3, delayMs = 700): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isRpcRequestError(e) || i === tries - 1) throw e;
      await sleep(delayMs * (i + 1));
    }
  }
  throw last;
}
