// Single place where Vite env variables are read. Everything here is PUBLIC.
const e = import.meta.env;
export const EVM_CHAIN_STORAGE_KEY = 'pilotswap.evmChainId';
export const EVM_ENV_FINGERPRINT_KEY = 'pilotswap.envFingerprint';

const sepoliaChainId = Number(e.VITE_SEPOLIA_CHAIN_ID ?? 11155111) || 11155111;
const bscTestnetChainId = Number(e.VITE_BSC_TESTNET_CHAIN_ID ?? 97) || 97;
const mainnetChainId = 1;
const bscMainnetChainId = 56;
/** Every chain this build can run on. */
const KNOWN_CHAIN_IDS = [sepoliaChainId, bscTestnetChainId, mainnetChainId, bscMainnetChainId];

// Explicit VITE_CHAIN_ID in .env selects the default network; falls back to Sepolia.
const defaultChainId = Number(e.VITE_CHAIN_ID ?? e.VITE_SEPOLIA_CHAIN_ID ?? 11155111) || 11155111;

/**
 * Fingerprint of all environment variables that configure active chains and contracts.
 * If any of these values change in .env, stale localStorage network selections are invalidated
 * so the new .env configuration takes effect immediately.
 */
export const ENV_FINGERPRINT = [
  e.VITE_CHAIN_ID ?? '',
  e.VITE_SEPOLIA_CHAIN_ID ?? '',
  e.VITE_BSC_TESTNET_CHAIN_ID ?? '',
  e.VITE_RPC_URL ?? '',
  e.VITE_SEPOLIA_RPC_URL ?? '',
  e.VITE_BSC_TESTNET_RPC_URL ?? '',
  e.VITE_SWAP_ROUTER_ADDRESS ?? '',
  e.VITE_SEPOLIA_SWAP_ROUTER_ADDRESS ?? '',
  e.VITE_BSC_TESTNET_SWAP_ROUTER_ADDRESS ?? '',
  e.VITE_QUOTER_ADDRESS ?? '',
  e.VITE_SEPOLIA_QUOTER_ADDRESS ?? '',
  e.VITE_BSC_TESTNET_QUOTER_ADDRESS ?? '',
  e.VITE_POSITION_MANAGER_ADDRESS ?? '',
  e.VITE_SEPOLIA_POSITION_MANAGER_ADDRESS ?? '',
  e.VITE_BSC_TESTNET_POSITION_MANAGER_ADDRESS ?? '',
  e.VITE_FACTORY_ADDRESS ?? '',
  e.VITE_SEPOLIA_FACTORY_ADDRESS ?? '',
  e.VITE_BSC_TESTNET_FACTORY_ADDRESS ?? '',
  e.VITE_WETH_ADDRESS ?? '',
  e.VITE_SEPOLIA_WETH_ADDRESS ?? '',
  e.VITE_BSC_TESTNET_WETH_ADDRESS ?? '',
  e.VITE_USDC_ADDRESS ?? '',
  e.VITE_SEPOLIA_USDC_ADDRESS ?? '',
  e.VITE_BSC_TESTNET_USDC_ADDRESS ?? '',
  e.VITE_DAI_ADDRESS ?? '',
  e.VITE_SEPOLIA_DAI_ADDRESS ?? '',
  e.VITE_BSC_TESTNET_DAI_ADDRESS ?? '',
  e.VITE_MAINNET_RPC_URL ?? '',
  e.VITE_BSC_MAINNET_RPC_URL ?? '',
  e.VITE_SEPOLIA_USDT_ADDRESS ?? '',
  e.VITE_BSC_TESTNET_USDT_ADDRESS ?? '',
  e.VITE_MAINNET_USDT_ADDRESS ?? '',
  e.VITE_BSC_MAINNET_USDT_ADDRESS ?? '',
  e.VITE_USDT_ADDRESS ?? '',
].join('::');

export function saveSelectedChainId(id: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EVM_CHAIN_STORAGE_KEY, String(id));
    window.localStorage.setItem(EVM_ENV_FINGERPRINT_KEY, ENV_FINGERPRINT);
  } catch {
    // ignore localStorage errors (e.g. private browsing or disabled storage)
  }
}

export function clearSelectedChainId(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(EVM_CHAIN_STORAGE_KEY);
    window.localStorage.setItem(EVM_ENV_FINGERPRINT_KEY, ENV_FINGERPRINT);
  } catch {
    // ignore
  }
}

function resolveActiveChainId(): number {
  if (typeof window === 'undefined') {
    return defaultChainId;
  }

  try {
    const savedFingerprint = window.localStorage.getItem(EVM_ENV_FINGERPRINT_KEY);
    // If the .env file has changed, invalidate any stale stored selection from a previous run.
    if (savedFingerprint !== ENV_FINGERPRINT) {
      window.localStorage.removeItem(EVM_CHAIN_STORAGE_KEY);
      window.localStorage.setItem(EVM_ENV_FINGERPRINT_KEY, ENV_FINGERPRINT);
      return defaultChainId;
    }

    const storedRaw = window.localStorage.getItem(EVM_CHAIN_STORAGE_KEY);
    if (!storedRaw) {
      return defaultChainId;
    }

    const storedChainId = Number(storedRaw);
    if (KNOWN_CHAIN_IDS.includes(storedChainId)) {
      return storedChainId;
    }
  } catch {
    // ignore localStorage errors
  }

  return defaultChainId;
}

const chainId = resolveActiveChainId();

/**
 * USDC decimals: mainnet USDC = 6, but your deployed MockToken USDC may use 18.
 * Override with VITE_SEPOLIA_USDC_DECIMALS or VITE_BSC_TESTNET_USDC_DECIMALS.
 * Default: 18 (the standard ERC-20 default and the most common MockToken setting).
 */
function parseDecimals(envVal: string | undefined, fallback: number): number {
  const n = Number(envVal);
  return Number.isInteger(n) && n >= 0 && n <= 255 ? n : fallback;
}

/** First non-empty value. An empty `VITE_X=` line in .env is "" (not undefined), so `??` would let it hide a real fallback. */
function pick(...values: (string | undefined)[]): string {
  return values.map((v) => v?.trim() ?? '').find((v) => v !== '') ?? '';
}

function rpcUrl(...values: (string | undefined)[]): string {
  return values
    .map((value) => value?.trim() ?? '')
    .find((value) => value !== '' && !/^(?:your(?:[_ -]|$)|change[_ -]?me|<)/i.test(value)) ?? '';
}

const isSepoliaDefault = defaultChainId === sepoliaChainId;
const isBscDefault = defaultChainId === bscTestnetChainId;

const sepoliaEnvironment = {
  rpcUrl: rpcUrl(e.VITE_SEPOLIA_RPC_URL, isSepoliaDefault ? e.VITE_RPC_URL : undefined),
  routerAddress: pick(e.VITE_SEPOLIA_SWAP_ROUTER_ADDRESS, isSepoliaDefault ? e.VITE_SWAP_ROUTER_ADDRESS : undefined),
  quoterAddress: pick(e.VITE_SEPOLIA_QUOTER_ADDRESS, isSepoliaDefault ? e.VITE_QUOTER_ADDRESS : undefined),
  positionManagerAddress: pick(e.VITE_SEPOLIA_POSITION_MANAGER_ADDRESS, isSepoliaDefault ? e.VITE_POSITION_MANAGER_ADDRESS : undefined),
  factoryAddress: pick(e.VITE_SEPOLIA_FACTORY_ADDRESS, isSepoliaDefault ? e.VITE_FACTORY_ADDRESS : undefined),
  wethAddress: pick(e.VITE_SEPOLIA_WETH_ADDRESS, isSepoliaDefault ? e.VITE_WETH_ADDRESS : undefined),
  usdcAddress: pick(e.VITE_SEPOLIA_USDC_ADDRESS, isSepoliaDefault ? e.VITE_USDC_ADDRESS : undefined),
  usdcDecimals: parseDecimals(e.VITE_SEPOLIA_USDC_DECIMALS, 18),
  daiAddress: pick(e.VITE_SEPOLIA_DAI_ADDRESS, isSepoliaDefault ? e.VITE_DAI_ADDRESS : undefined),
  // USDT is a test token you deploy yourself (contracts/MockUSDT.sol), then paste its address here.
  usdtAddress: pick(e.VITE_SEPOLIA_USDT_ADDRESS, isSepoliaDefault ? e.VITE_USDT_ADDRESS : undefined),
  usdtDecimals: parseDecimals(e.VITE_SEPOLIA_USDT_DECIMALS, 6),
};

const bscTestnetEnvironment = {
  rpcUrl: rpcUrl(e.VITE_BSC_TESTNET_RPC_URL, isBscDefault ? e.VITE_RPC_URL : undefined),
  routerAddress: pick(e.VITE_BSC_TESTNET_SWAP_ROUTER_ADDRESS, isBscDefault ? e.VITE_SWAP_ROUTER_ADDRESS : undefined),
  quoterAddress: pick(e.VITE_BSC_TESTNET_QUOTER_ADDRESS, isBscDefault ? e.VITE_QUOTER_ADDRESS : undefined),
  positionManagerAddress: pick(e.VITE_BSC_TESTNET_POSITION_MANAGER_ADDRESS, isBscDefault ? e.VITE_POSITION_MANAGER_ADDRESS : undefined),
  factoryAddress: pick(e.VITE_BSC_TESTNET_FACTORY_ADDRESS, isBscDefault ? e.VITE_FACTORY_ADDRESS : undefined),
  wethAddress: pick(e.VITE_BSC_TESTNET_WETH_ADDRESS, isBscDefault ? e.VITE_WETH_ADDRESS : undefined),
  usdcAddress: pick(e.VITE_BSC_TESTNET_USDC_ADDRESS, isBscDefault ? e.VITE_USDC_ADDRESS : undefined),
  usdcDecimals: parseDecimals(e.VITE_BSC_TESTNET_USDC_DECIMALS, 18),
  daiAddress: pick(e.VITE_BSC_TESTNET_DAI_ADDRESS, isBscDefault ? e.VITE_DAI_ADDRESS : undefined),
  usdtAddress: pick(e.VITE_BSC_TESTNET_USDT_ADDRESS, isBscDefault ? e.VITE_USDT_ADDRESS : undefined),
  usdtDecimals: parseDecimals(e.VITE_BSC_TESTNET_USDT_DECIMALS, 18), // BEP-20 USDT uses 18 decimals
};

/**
 * Ethereum MAINNET (real funds). The defaults below are PilotSwap V3 deployments and the canonical
 * WETH / USDC / DAI contracts on Ethereum. Each can be overridden with VITE_MAINNET_*.
 */
const mainnetEnvironment = {
  rpcUrl: rpcUrl(e.VITE_MAINNET_RPC_URL),
  routerAddress: pick(e.VITE_MAINNET_SWAP_ROUTER_ADDRESS, '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'), // SwapRouter02
  quoterAddress: pick(e.VITE_MAINNET_QUOTER_ADDRESS, '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'), // QuoterV2
  positionManagerAddress: pick(e.VITE_MAINNET_POSITION_MANAGER_ADDRESS, '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'),
  factoryAddress: pick(e.VITE_MAINNET_FACTORY_ADDRESS, '0x1F98431c8aD98523631AE4a59f267346ea31F984'),
  wethAddress: pick(e.VITE_MAINNET_WETH_ADDRESS, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'),
  usdcAddress: pick(e.VITE_MAINNET_USDC_ADDRESS, '0xA0b86991c6218b36c1d19D4a2E9Eb0cE3606eB48'),
  usdcDecimals: parseDecimals(e.VITE_MAINNET_USDC_DECIMALS, 6), // real USDC has 6 decimals
  daiAddress: pick(e.VITE_MAINNET_DAI_ADDRESS, '0x6B175474E89094C44Da98b954EedeAC495271d0F'),
  usdtAddress: pick(e.VITE_MAINNET_USDT_ADDRESS, '0xdAC17F958D2ee523a2206206994597C13D831ec7'),
  usdtDecimals: parseDecimals(e.VITE_MAINNET_USDT_DECIMALS, 6), // real USDT on Ethereum has 6 decimals
};

/**
 * BNB Smart Chain MAINNET (real funds). Defaults are PancakeSwap's V3 deployments and the canonical
 * WBNB / USDC / USDT / DAI (Binance-Peg, 18 decimals) contracts. Override any with VITE_BSC_MAINNET_*.
 */
const bscMainnetEnvironment = {
  rpcUrl: rpcUrl(e.VITE_BSC_MAINNET_RPC_URL),
  routerAddress: pick(e.VITE_BSC_MAINNET_SWAP_ROUTER_ADDRESS, '0x1b81D678ffb9C0263b24A97847620C99d213eB14'), // PancakeSwap V3 SwapRouter
  quoterAddress: pick(e.VITE_BSC_MAINNET_QUOTER_ADDRESS, '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997'), // QuoterV2
  positionManagerAddress: pick(e.VITE_BSC_MAINNET_POSITION_MANAGER_ADDRESS, '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364'),
  factoryAddress: pick(e.VITE_BSC_MAINNET_FACTORY_ADDRESS, '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865'),
  wethAddress: pick(e.VITE_BSC_MAINNET_WETH_ADDRESS, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'), // WBNB
  usdcAddress: pick(e.VITE_BSC_MAINNET_USDC_ADDRESS, '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'),
  usdcDecimals: parseDecimals(e.VITE_BSC_MAINNET_USDC_DECIMALS, 18),
  daiAddress: pick(e.VITE_BSC_MAINNET_DAI_ADDRESS, '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3'),
  usdtAddress: pick(e.VITE_BSC_MAINNET_USDT_ADDRESS, '0x55d398326f99059fF775485246999027B3197955'),
  usdtDecimals: parseDecimals(e.VITE_BSC_MAINNET_USDT_DECIMALS, 18),
};

/** Returns the environment-backed contract configuration for a particular EVM chain. */
export function getEvmEnvironment(chainId: number) {
  if (chainId === mainnetChainId) return mainnetEnvironment;
  if (chainId === bscMainnetChainId) return bscMainnetEnvironment;
  return chainId === bscTestnetChainId ? bscTestnetEnvironment : sepoliaEnvironment;
}

export const ENV = {
  chainId,
  ...getEvmEnvironment(chainId),
  /** Optional CoinGecko demo key (free). Public API works without it but is rate-limited. */
  coingeckoApiKey: (e.VITE_COINGECKO_API_KEY ?? '').trim(),
} as const;
