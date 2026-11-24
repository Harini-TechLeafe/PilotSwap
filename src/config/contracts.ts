import { parseAbi } from 'viem';
import { ACTIVE_CHAIN, CHAIN_CONFIG_ERROR, IS_BNB_CHAIN } from './chains';
import { ENV } from './env';
import { TOKENS, parseAddress } from './tokens';

/**
 * ─────────────────────────────────────────────────────────────
 *  V3 CONTRACT ADDRESSES — SET VIA .env (never edit here)
 *    VITE_MAINNET_* / VITE_SEPOLIA_* / VITE_BSC_TESTNET_* / VITE_BSC_MAINNET_* → network-specific V3 contracts and tokens
 *  The two mainnets default to the official V3 deployments (Ethereum: Uniswap V3, BNB Chain: PancakeSwap V3);
 *  override any of them with the matching VITE_*_ variable.
 *  BNB Chain (testnet 97 and mainnet 56) uses PancakeSwap's V3 SwapRouter (not the SmartRouter).
 *  See https://developer.pancakeswap.finance/contracts/v3/addresses for deployments.
 *  Flow: create pool → add liquidity (mint) → quote → swap.
 * ─────────────────────────────────────────────────────────────
 */
export const SWAP_ROUTER_ADDRESS = parseAddress(ENV.routerAddress);
export const QUOTER_ADDRESS =parseAddress(ENV.quoterAddress);
export const POSITION_MANAGER_ADDRESS = parseAddress(ENV.positionManagerAddress);
export const FACTORY_ADDRESS = parseAddress(ENV.factoryAddress);
export const WETH_ADDRESS = parseAddress(ENV.wethAddress);

export const DEFAULT_SLIPPAGE_BPS = 50; // 0.50%
export const DEADLINE_MINUTES = 20;
/** Rough gas units used only for the *estimated* network fee display. */
export const GAS_UNITS_ESTIMATE = 200_000n;

export interface FeeTier { fee: number; label: string; tickSpacing: number }

/**
 * V3 fee tiers (hundredths of a bip) and their tick spacings.
 * PancakeSwap V3 (BNB Chain) has 0.01% / 0.05% / 0.25% / 1%, so 0.25% (2500) replaces the standard 0.3% (3000).
 */
export const FEE_TIERS: FeeTier[] = IS_BNB_CHAIN
  ? [
      { fee: 100, label: '0.01%', tickSpacing: 1 },
      { fee: 500, label: '0.05%', tickSpacing: 10 },
      { fee: 2500, label: '0.25%', tickSpacing: 50 },
      { fee: 10000, label: '1%', tickSpacing: 200 },
    ]
  : [
      { fee: 100, label: '0.01%', tickSpacing: 1 },
      { fee: 500, label: '0.05%', tickSpacing: 10 },
      { fee: 3000, label: '0.3%', tickSpacing: 60 },
      { fee: 10000, label: '1%', tickSpacing: 200 },
    ];
/** Pre-selected fee tier: the standard "most pairs" tier of the active DEX. */
export const DEFAULT_FEE: number = IS_BNB_CHAIN ? 2500 : 3000;
/** SwapRouter02 sentinel meaning "send to the router itself" (used before unwrapWETH9). */
export const ROUTER_AS_RECIPIENT = '0x0000000000000000000000000000000000000002' as const;

/** SwapRouter02 */
export const swapRouterAbi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)',
  'function unwrapWETH9(uint256 amountMinimum, address recipient) payable',
  'function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)',
]);

/**
 * PancakeSwap V3 SwapRouter (BNB Chain) is the classic v3-periphery router, not SwapRouter02:
 * the deadline lives INSIDE the swap params and multicall takes only the call list.
 * "Send to the router itself" (before unwrapWETH9) is the router's own address, not the 0x…02 sentinel.
 */
export const pancakeSwapRouterAbi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)',
  'function unwrapWETH9(uint256 amountMinimum, address recipient) payable',
  'function multicall(bytes[] data) payable returns (bytes[] results)',
]);

/** QuoterV2 (non-view: call through simulateContract) */
export const quoterAbi = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);

/** Every V3 periphery contract (position manager, router, quoter) stores the factory and WETH9 it was deployed with. */
export const peripheryAbi = parseAbi([
  'function factory() view returns (address)',
  'function WETH9() view returns (address)',
]);

export const factoryAbi = parseAbi([
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)',
]);

export const poolAbi = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint32 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
]);

/** NonfungiblePositionManager */
export const positionManagerAbi = parseAbi([
  'struct MintParams { address token0; address token1; uint24 fee; int24 tickLower; int24 tickUpper; uint256 amount0Desired; uint256 amount1Desired; uint256 amount0Min; uint256 amount1Min; address recipient; uint256 deadline; }',
  'function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) payable returns (address pool)',
  'function mint(MintParams params) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function refundETH() payable',
  'function multicall(bytes[] data) payable returns (bytes[] results)',
]);

/** Static (synchronous) configuration problems shown to the developer/user. */
export function getConfigIssues(): string[] {
  const issues: string[] = [];
  if (CHAIN_CONFIG_ERROR) issues.push(CHAIN_CONFIG_ERROR);
  if (!SWAP_ROUTER_ADDRESS) issues.push('VITE_SWAP_ROUTER_ADDRESS is missing or invalid.');
  if (!QUOTER_ADDRESS) issues.push('VITE_QUOTER_ADDRESS is missing or invalid.');
  if (!FACTORY_ADDRESS) issues.push('VITE_FACTORY_ADDRESS is missing or invalid.');
  if (!POSITION_MANAGER_ADDRESS) issues.push('VITE_POSITION_MANAGER_ADDRESS is missing or invalid.');
  if (!WETH_ADDRESS) issues.push('VITE_WETH_ADDRESS (wrapped native token: WETH / WBNB) is missing or invalid.');
  const missing = TOKENS.filter((t) => !t.isNative && !t.address).map((t) => t.symbol);
  if (missing.length) issues.push(`No address configured for: ${missing.join(', ')} (disabled until set in .env).`);
  return issues;
}

export const CHAIN_LABEL = ACTIVE_CHAIN.name;
