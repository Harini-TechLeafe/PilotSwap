import { memo, useEffect, useState } from 'react';
import { getCachedLogo, resolveTokenLogo, type TokenRef } from '../lib/tokenLogos';

export interface TokenLogoProps {
  /** Network-specific identity of the token (chain + address / mint / policy id). */
  token: TokenRef;
  symbol: string;
  name?: string;
  /** Logo URL already returned by your pool API, if any (validated before use). */
  logoURI?: string | null;
  size?: number;
  alt?: string;
  className?: string;
}

/** Neutral fallback: first letters of the symbol on a plain circle. It never imitates another token's logo. */
function Fallback({ symbol, size, loading }: { symbol: string; size: number; loading: boolean }) {
  return (
    <span
      className={`flex h-full w-full items-center justify-center bg-blue-100 font-display font-semibold text-slate-500 ${loading ? 'animate-pulse' : ''}`}
      style={{ fontSize: Math.max(8, size * 0.36) }}
    >
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** Round token logo with loading + broken-image fallback. The size is fixed so rows never shift. */
function TokenLogoBase({ token, symbol, name, logoURI, size = 36, alt, className = '' }: TokenLogoProps) {
  const cached = getCachedLogo(token);
  const [src, setSrc] = useState<string | null>(cached ?? null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>(cached === undefined ? 'loading' : cached ? 'ready' : 'missing');

  // Re-run only when the token identity changes, not on every render of the parent.
  const idKey = JSON.stringify(token);
  useEffect(() => {
    let off = false;
    const c = getCachedLogo(token);
    if (c !== undefined) {
      setSrc(c);
      setStatus(c ? 'ready' : 'missing');
      return;
    }
    setStatus('loading');
    void resolveTokenLogo(token, logoURI).then((u) => {
      if (off) return;
      setSrc(u);
      setStatus(u ? 'ready' : 'missing');
    });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey, logoURI]);

  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-full bg-white ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={alt ?? `${name ?? symbol} logo`}
    >
      {status === 'ready' && src ? (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          // One error → fallback. No retry, so it can never loop.
          onError={() => { setSrc(null); setStatus('missing'); }}
        />
      ) : (
        <Fallback symbol={symbol} size={size} loading={status === 'loading'} />
      )}
    </span>
  );
}

export default memo(TokenLogoBase);
