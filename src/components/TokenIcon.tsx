import type { Token } from '../config/tokens';

export default function TokenIcon({ token, size = 32 }: { token: Token; size?: number }) {
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
