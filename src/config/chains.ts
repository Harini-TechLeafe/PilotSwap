import { createPublicClient, http, type Address, type Chain, type Hex } from 'viem';
import { arbitrumSepolia, baseSepolia, optimismSepolia, sepolia } from 'viem/chains';
import { ENV } from './env';

/** Testnets PilotSwap can run on. Add more viem chains here if needed. */
export const SUPPORTED_CHAINS: Record<number, Chain> = {
  [sepolia.id]: sepolia,
  [baseSepolia.id]: baseSepolia,
  [arbitrumSepolia.id]: arbitrumSepolia,
  [optimismSepolia.id]: optimismSepolia,
};

export const CHAIN_CONFIG_ERROR: string | null = SUPPORTED_CHAINS[ENV.chainId]
  ? null
  : `VITE_CHAIN_ID=${ENV.chainId} is not supported. Use one of: ${Object.keys(SUPPORTED_CHAINS).join(', ')}.`;

export const ACTIVE_CHAIN: Chain = SUPPORTED_CHAINS[ENV.chainId] ?? sepolia;
export const RPC_URL: string = ENV.rpcUrl || ACTIVE_CHAIN.rpcUrls.default.http[0];
export const CHAIN_ID_HEX = `0x${ACTIVE_CHAIN.id.toString(16)}`;

/** Read-only client used for quotes, balances, allowances and receipts. */
export const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http(RPC_URL) });

/** Params for wallet_addEthereumChain (used only when the user clicks "Switch Network"). */
export const ADD_CHAIN_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: ACTIVE_CHAIN.name,
  nativeCurrency: ACTIVE_CHAIN.nativeCurrency,
  rpcUrls: [RPC_URL],
  blockExplorerUrls: ACTIVE_CHAIN.blockExplorers ? [ACTIVE_CHAIN.blockExplorers.default.url] : [],
};

const KNOWN_NAMES: Record<number, string> = { 1: 'Ethereum Mainnet', 10: 'Optimism', 56: 'BNB Chain', 137: 'Polygon', 8453: 'Base', 42161: 'Arbitrum One' };
export const chainName = (id: number): string => KNOWN_NAMES[id] ?? SUPPORTED_CHAINS[id]?.name ?? `Chain ${id}`;

const explorer = ACTIVE_CHAIN.blockExplorers?.default.url;
export const explorerTxUrl = (hash: Hex): string | null => (explorer ? `${explorer}/tx/${hash}` : null);
export const explorerAddressUrl = (addr: Address): string | null => (explorer ? `${explorer}/address/${addr}` : null);
