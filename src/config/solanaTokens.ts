/**
 * Names for Solana token mints. The wallet panel shows EVERY token the connected wallet holds (found
 * on-chain), and uses this list only to give known mints a nice symbol/name. Unknown mints show a short mint address.
 *
 * Add YOUR mints here (e.g. a test token you created with `spl-token create-token` on devnet).
 */
export interface KnownSolToken {
  symbol: string;
  name: string;
}

export const KNOWN_SOL_TOKENS: Record<string, KnownSolToken> = {
  // Circle's devnet USDC. Verify on https://explorer.solana.com/?cluster=devnet before trusting it.
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': { symbol: 'USDC', name: 'USD Coin (devnet)' },
  // Popular mainnet tokens (JUP, RAY, BONK) are listed in components/SolanaSwapCard.tsx.
  // 'YourMintAddressHere': { symbol: 'PILOT', name: 'Pilot Token' },
};
