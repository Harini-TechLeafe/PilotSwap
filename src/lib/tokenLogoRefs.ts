import { IS_BNB_CHAIN } from '../config/chains';
import type { TokenRef } from './tokenLogos';

/** Tokens without a logo entry keep the generic coloured icon. */
export const LOGO_REFS: Record<string, TokenRef> = {
  ETH: { family: 'evm', chainId: IS_BNB_CHAIN ? 56 : 1, address: null },
  WETH: IS_BNB_CHAIN
    ? { family: 'evm', chainId: 56, address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' }
    : { family: 'evm', chainId: 1, address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
  USDC: { family: 'evm', chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2E9Eb0cE3606eB48' },
  DAI: { family: 'evm', chainId: 1, address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
  USDT: { family: 'evm', chainId: 1, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
};
