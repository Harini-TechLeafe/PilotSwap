/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_SWAP_ROUTER_ADDRESS?: string;
  readonly VITE_WETH_ADDRESS?: string;
  readonly VITE_USDC_ADDRESS?: string;
  readonly VITE_DAI_ADDRESS?: string;
  readonly VITE_TBTC_ADDRESS?: string;
  readonly VITE_COINGECKO_API_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
