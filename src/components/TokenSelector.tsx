import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { TOKENS, isTokenConfigured, type Token } from '../config/tokens';
import { formatAmount } from '../lib/format';
import TokenIcon from './TokenIcon';

interface Props {
  value: Token;
  onChange: (id: string) => void;
  balances: Record<string, bigint>;
  /** token ids that cannot be picked (e.g. the token on the other side) */
  disabledIds?: string[];
  disabled?: boolean;
}

export default function TokenSelector({ value, onChange, balances, disabledIds = [], disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOKENS.filter((t) => !q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-2 rounded-full border border-blue-100 bg-blue-50 py-1.5 pl-1.5 pr-3 transition hover:bg-blue-100/70 disabled:opacity-60 focus-ring"
        aria-label={`Select token, currently ${value.symbol}`}
      >
        <TokenIcon token={value} size={28} />
        <span className="font-display font-semibold">{value.symbol}</span>
        <span aria-hidden className="text-xs text-slate-500">▾</span>
      </button>

      {/* Portal to <body> so the picker also works inside other popups (backdrop-blur would otherwise trap a fixed overlay). */}
      {open && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onMouseDown={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Select a token">
          <div className="glass w-full max-w-sm rounded-3xl p-4" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Select a token</h3>
              <button className="text-slate-500 hover:text-cloud" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or symbol" className="mb-3 w-full rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-2.5 text-sm outline-none focus:border-altitude/60" />
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {list.map((t) => {
                const configured = isTokenConfigured(t);
                const blocked = !configured || disabledIds.includes(t.id);
                return (
                  <li key={t.id}>
                    <button
                      disabled={blocked}
                      onClick={() => { onChange(t.id); setOpen(false); setQuery(''); }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-blue-100/70 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${t.id === value.id ? 'bg-blue-100/70' : ''}`}
                    >
                      <TokenIcon token={t} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{t.symbol}</span>
                        <span className="block truncate text-xs text-slate-500">{configured ? t.name : 'Address not configured'}</span>
                      </span>
                      <span className="font-mono text-sm text-slate-600">{configured ? formatAmount(balances[t.id] ?? 0n, t.decimals, 4) : '–'}</span>
                    </button>
                  </li>
                );
              })}
              {!list.length && <li className="px-3 py-6 text-center text-sm text-slate-500">No tokens match “{query}”.</li>}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
