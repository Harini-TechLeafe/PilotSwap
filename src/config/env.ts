// Single place where Vite env variables are read. Everything here is PUBLIC.
const e = import.meta.env;

export const ENV = {
  chainId: Number(e.VITE_CHAIN_ID ?? 11155111) || 11155111,
  rpcUrl: (e.VITE_RPC_URL ?? '').trim(),
  routerAddress: (e.VITE_SWAP_ROUTER_ADDRESS ?? '').trim(),
  wethAddress: (e.VITE_WETH_ADDRESS ?? '').trim(),
  usdcAddress: (e.VITE_USDC_ADDRESS ?? '').trim(),
  daiAddress: (e.VITE_DAI_ADDRESS ?? '').trim(),
  tbtcAddress: (e.VITE_TBTC_ADDRESS ?? '').trim(),
  /** Optional CoinGecko demo key (free). Public API works without it but is rate-limited. */
  coingeckoApiKey: (e.VITE_COINGECKO_API_KEY ?? '').trim(),
} as const;
