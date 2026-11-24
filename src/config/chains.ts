import { createPublicClient, fallback, http, type Address, type Chain, type Hex } from 'viem';
import { bsc, bscTestnet, mainnet, sepolia } from 'viem/chains';
import { ENV, getEvmEnvironment } from './env';

/** Reliable public RPC fallbacks in case the primary configured RPC is down or rate-limited. */
export const DEFAULT_FALLBACK_RPCS: Record<number, string[]> = {
  [mainnet.id]: [
    'https://ethereum-rpc.publicnode.com',
    'https://eth.drpc.org',
    'https://1rpc.io/eth',
  ],
  [bsc.id]: [
    'https://bsc-rpc.publicnode.com',
    'https://bsc.drpc.org',
    'https://bsc-dataseed.bnbchain.org',
    'https://bsc-dataseed1.defibit.io',
  ],
  [sepolia.id]: [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.drpc.org',
  ],
  [bscTestnet.id]: [
    'https://bsc-testnet-rpc.publicnode.com',
    'https://bsc-testnet.drpc.org',
    // Binance's own seed nodes are heavily rate-limited and often lag behind, so they are the last resort.
    'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
    'https://data-seed-prebsc-2-s1.bnbchain.org:8545',
  ],
};

/** EVM networks configured for PilotSwap. */
export const SUPPORTED_CHAINS: Record<number, Chain> = {
  [mainnet.id]: mainnet, // Ethereum mainnet (1): PilotSwap V3, REAL funds
  [sepolia.id]: sepolia,
  [bscTestnet.id]: bscTestnet, // BNB Smart Chain Testnet (97): PancakeSwap V3 pools
  [bsc.id]: bsc, // BNB Smart Chain mainnet (56): PancakeSwap V3, REAL funds
};

/** EVM chains with complete swap and liquidity configuration in this app. */
export const CONFIGURED_EVM_CHAIN_IDS: number[] = [mainnet.id, sepolia.id, bscTestnet.id, bsc.id];

export const CHAIN_CONFIG_ERROR: string | null = SUPPORTED_CHAINS[ENV.chainId]
  ? null
  : `Configured EVM chain ID ${ENV.chainId} is not supported. Use one of: ${Object.keys(SUPPORTED_CHAINS).join(', ')}.`;

export const ACTIVE_CHAIN: Chain = SUPPORTED_CHAINS[ENV.chainId] ?? sepolia;

export function getChainRpcUrls(chainId: number): string[] {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported EVM chain ID: ${chainId}`);
  const envRpc = getEvmEnvironment(chainId).rpcUrl;
  const fallbacks = DEFAULT_FALLBACK_RPCS[chainId] ?? [];
  const viemRpc = chain.rpcUrls.default?.http?.[0] ?? '';
  // Avoid thirdweb default if rate-limited
  const viemFallback = viemRpc && !viemRpc.includes('thirdweb.com') ? [viemRpc] : [];
  const rawList = [envRpc, ...fallbacks, ...viemFallback];
  const list = rawList
    .map((url) => url?.trim() ?? '')
    .filter((url) => url.length > 0 && !/^(?:your(?:[_ -]|$)|change[_ -]?me|<)/i.test(url));
  return Array.from(new Set(list));
}

export function getChainRpcUrl(chainId: number): string {
  const urls = getChainRpcUrls(chainId);
  return urls[0] ?? '';
}

export function getAddChainParams(chainId: number) {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported EVM chain ID: ${chainId}`);
  const rpcUrls = getChainRpcUrls(chainId);
  return {
    chainId: `0x${chainId.toString(16)}`,
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls,
    blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : [],
  };
}

export const RPC_URL: string = getChainRpcUrl(ENV.chainId);
/** BNB Chain family (mainnet 56 / testnet 97): gas coin is BNB, V3 DEX is PancakeSwap. */
export const IS_BNB_CHAIN: boolean = ACTIVE_CHAIN.id === 56 || ACTIVE_CHAIN.id === 97;
/** A real-money network (Ethereum mainnet 1 or BNB Smart Chain 56): extra warnings, real token faucets are not available. */
export const IS_MAINNET: boolean = !ACTIVE_CHAIN.testnet;
/** Prefix of the .env variables that configure the active chain (used in error messages). */
export const ENV_PREFIX: string = ACTIVE_CHAIN.id === 1 ? 'VITE_MAINNET_' : ACTIVE_CHAIN.id === 56 ? 'VITE_BSC_MAINNET_' : ACTIVE_CHAIN.id === 97 ? 'VITE_BSC_TESTNET_' : 'VITE_SEPOLIA_';
/** Symbol of the chain's gas coin: ETH on Ethereum/Sepolia, tBNB on BNB Testnet, BNB on BNB Smart Chain. */
export const NATIVE_SYMBOL: string = ACTIVE_CHAIN.nativeCurrency.symbol;
export const CHAIN_ID_HEX = `0x${ACTIVE_CHAIN.id.toString(16)}`;

/** Read-only client used for quotes, balances, allowances and receipts. Supports automatic fallback. */
const activeTransports = getChainRpcUrls(ACTIVE_CHAIN.id).map((url) => http(url, { retryCount: 1, timeout: 10_000 }));
export const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: activeTransports.length > 1 ? fallback(activeTransports, { rank: false, retryCount: 1 }) : (activeTransports[0] ?? http()),
});

/** Params for wallet_addEthereumChain (used only after a user asks to switch). */
export const ADD_CHAIN_PARAMS = getAddChainParams(ACTIVE_CHAIN.id);

const KNOWN_NAMES: Record<number, string> = { 1: 'Ethereum Mainnet', 10: 'Optimism', 56: 'BNB Chain', 137: 'Polygon', 8453: 'Base', 42161: 'Arbitrum One' };
export const chainName = (id: number): string => KNOWN_NAMES[id] ?? SUPPORTED_CHAINS[id]?.name ?? `Chain ${id}`;

const explorer = ACTIVE_CHAIN.blockExplorers?.default.url;
export const explorerTxUrl = (hash: Hex): string | null => (explorer ? `${explorer}/tx/${hash}` : null);
export const explorerAddressUrl = (addr: Address): string | null => (explorer ? `${explorer}/address/${addr}` : null);
