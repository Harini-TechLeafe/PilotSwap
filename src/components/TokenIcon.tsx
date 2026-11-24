import type { Token } from '../config/tokens';
import { LOGO_REFS } from '../lib/tokenLogoRefs';
import TokenLogo from './TokenLogo';

/**
 * Token icon used across the app (swap card, token picker, wallet, liquidity).
 * Known tokens show their real logo (tBNB/WBNB show BNB on BNB Chain); anything else keeps a coloured glyph.
 */
export default function TokenIcon({ token, size = 32 }: { token: Token; size?: number }) {
  const ref = LOGO_REFS[token.id];
  if (ref) {
    return <TokenLogo token={ref} symbol={token.symbol} name={token.name} size={size} />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.46, background: `radial-gradient(circle at 30% 25%, #fff6, ${token.color})` }}
    >
      {token.glyph}
    </span>
  );
}
