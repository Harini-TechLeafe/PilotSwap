/**
 * Multi-chain registry. Each chain belongs to a "family" (EVM or non-EVM).
 * Only the EVM family has a working swap adapter today (Uniswap V2 router via viem).
 * To add a chain: add an entry here, then implement a SwapAdapter for its family
 * in src/chains/<family>/ and render it in Home.tsx.
 */
export type ChainFamily = 'evm' | 'solana' | 'cardano' | 'bitcoin';

export interface ChainEntry {
  id: string;
  name: string;
  family: ChainFamily;
  badge: string;
  /** true = swap flow implemented in this repo */
  supported: boolean;
  note: string;
}

/** Contract every family adapter must implement (EVM's lives in hooks/useSwap.ts + config/). */
export interface SwapAdapter {
  family: ChainFamily;
  connect(): Promise<string>;
  getBalance(account: string, tokenId: string): Promise<bigint>;
  getQuote(fromId: string, toId: string, amountIn: bigint): Promise<bigint>;
  swap(fromId: string, toId: string, amountIn: bigint, minOut: bigint): Promise<string>;
}

export const CHAINS: ChainEntry[] = [
  { id: 'evm', name: 'Ethereum Sepolia', family: 'evm', badge: 'ETH', supported: true, note: 'Uniswap V2 router' },
  { id: 'solana', name: 'Solana Devnet', family: 'solana', badge: 'SOL', supported: false, note: 'Needs a Solana adapter (wallet-adapter + Jupiter/Raydium)' },
  { id: 'cardano', name: 'Cardano Preprod', family: 'cardano', badge: 'ADA', supported: false, note: 'Needs a Cardano adapter (CIP-30 + Minswap SDK)' },
  { id: 'bitcoin', name: 'Bitcoin Testnet', family: 'bitcoin', badge: 'BTC', supported: false, note: 'No native swaps on Bitcoin; needs a bridge or wrapped BTC' },
];
