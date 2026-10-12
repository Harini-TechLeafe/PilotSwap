import { parseAbi } from 'viem';
import { ACTIVE_CHAIN, CHAIN_CONFIG_ERROR } from './chains';
import { ENV } from './env';
import { TOKENS, parseAddress } from './tokens';

/**
 * ─────────────────────────────────────────────────────────────
 *  CONTRACT ADDRESSES — REPLACE VIA .env (never edit here)
 *    VITE_SWAP_ROUTER_ADDRESS  → verified Uniswap V2-style Router02 on your testnet
 *    VITE_WETH_ADDRESS         → the WETH9 used by that router (router.WETH())
 *    VITE_USDC_ADDRESS / VITE_DAI_ADDRESS → verified ERC-20s (TOKEN_ADDRESS)
 *  Nothing below is a real address; they are all null until you set .env.
 * ─────────────────────────────────────────────────────────────
 */
export const SWAP_ROUTER_ADDRESS = parseAddress(ENV.routerAddress);
export const WETH_ADDRESS = parseAddress(ENV.wethAddress);

export const DEFAULT_SLIPPAGE_BPS = 50; // 0.50%
export const DEADLINE_MINUTES = 20;
/** Rough gas units used only for the *estimated* network fee display. */
export const GAS_UNITS_ESTIMATE = 200_000n;

/** Uniswap V2 Router02 functions used by PilotSwap. */
export const routerAbi = parseAbi([
  'function WETH() view returns (address)',
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
  'function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)',
  'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
]);

/** Static (synchronous) configuration problems shown to the developer/user. */
export function getConfigIssues(): string[] {
  const issues: string[] = [];
  if (CHAIN_CONFIG_ERROR) issues.push(CHAIN_CONFIG_ERROR);
  if (!SWAP_ROUTER_ADDRESS) issues.push('VITE_SWAP_ROUTER_ADDRESS is missing or invalid.');
  if (!WETH_ADDRESS) issues.push('VITE_WETH_ADDRESS is missing or invalid.');
  const missing = TOKENS.filter((t) => !t.isNative && !t.address).map((t) => t.symbol);
  if (missing.length) issues.push(`No address configured for: ${missing.join(', ')} (disabled until set in .env).`);
  return issues;
}

export const CHAIN_LABEL = ACTIVE_CHAIN.name;
