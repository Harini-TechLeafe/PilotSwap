import { memo } from 'react';
import type { TokenRef } from '../lib/tokenLogos';
import TokenLogo from './TokenLogo';

export interface PairToken {
  symbol: string;
  name?: string;
  token: TokenRef;
  logoURI?: string | null;
}

/** Two overlapping round token logos, as in the pool list. Each side resolves independently. */
function LiquidityPairLogo({ a, b, size = 36 }: { a: PairToken; b: PairToken; size?: number }) {
  return (
    <span className="flex shrink-0 items-center" role="group" aria-label={`${a.symbol} and ${b.symbol}`}>
      <TokenLogo {...a} size={size} className="border-2 border-panel" />
      <TokenLogo {...b} size={size} className="-ml-2.5 border-2 border-panel" />
    </span>
  );
}

export default memo(LiquidityPairLogo);
