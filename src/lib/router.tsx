import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

/** Tiny History-API router: clean URLs ("/", "/tokens", "/tokens/usdc", "/liquidity") with no "#". */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, ''); // '' or '/subfolder'
const NAV_EVENT = 'pilotswap:navigate';

const withBase = (p: string) => BASE + p;

/** Normalised app path without base or trailing slash, e.g. "/tokens/usdc". Unknown paths fall back to "/". */
function readPath(): string {
  let p = window.location.pathname;
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length);
  p = ('/' + p.replace(/^\/+/, '')).replace(/\/+$/, '') || '/';
  if (p === '/index.html') return '/';
  return p;
}

/** Old links like "#liquidity", "#tokens/usdc", "#swap", "#top" keep working: they are rewritten to clean URLs. */
function migrateLegacyHash() {
  const h = window.location.hash;
  if (!h) return;
  const m = h.replace(/^#\/?/, '').split('?')[0];
  let target: string | null = null;
  if (m === '' || m === 'swap' || m === 'top') target = '/';
  else if (m === 'liquidity') target = '/liquidity';
  else if (m === 'tokens' || m.startsWith('tokens/')) target = '/' + m;
  if (target) window.history.replaceState(null, '', withBase(target) + window.location.search);
}

if (typeof window !== 'undefined') migrateLegacyHash();

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const url = withBase(to);
  if (url !== window.location.pathname) {
    window.history[opts.replace ? 'replaceState' : 'pushState'](null, '', url);
  }
  window.dispatchEvent(new Event(NAV_EVENT));
}

export function usePath(): string {
  const [path, setPath] = useState(readPath);
  useEffect(() => {
    const sync = () => { migrateLegacyHash(); setPath(readPath()); };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener(NAV_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener(NAV_EVENT, sync);
    };
  }, []);
  return path;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string };

/** Anchor with a real clean href (works with open-in-new-tab / copy link) that navigates without a page reload. */
export function Link({ to, onClick, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === '_blank') return;
    e.preventDefault();
    navigate(to);
    window.scrollTo({ top: 0 });
  };
  return <a {...rest} href={withBase(to)} onClick={handle} />;
}
