
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  TOKENS,
  isTokenConfigured,
  type Token,
} from '../config/tokens';
import { formatAmount } from '../lib/format';
import TokenIcon from './TokenIcon';

interface Props {
  value: Token;
  onChange: (id: string) => void;
  balances: Record<string, bigint>;
  disabledIds?: string[];
  disabled?: boolean;
}

export default function TokenSelector({
  value,
  onChange,
  balances,
  disabledIds = [],
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();

    return TOKENS.filter(
      (t) =>
        !q ||
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)
    );
  }, [query]);

  const closePicker = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      {/* TOKEN SELECTOR BUTTON */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="
          flex
          w-full
          min-w-0
          max-w-full
          items-center
          justify-center
          gap-1.5
          rounded-full
          border
          border-blue-100
          bg-blue-50
          py-1.5
          pl-1.5
          pr-2
          transition
          hover:bg-blue-100/70
          disabled:opacity-60
          focus-ring
        "
        aria-label={`Select token, currently ${value.symbol}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="shrink-0">
          <TokenIcon token={value} size={28} />
        </span>

        <span className="min-w-0 truncate font-display text-sm font-semibold sm:text-base">
          {value.symbol}
        </span>

        <span
          aria-hidden
          className="shrink-0 text-xs text-slate-500"
        >
          ▾
        </span>
      </button>

      {/* TOKEN SELECTION POPUP */}
      {open &&
        createPortal(
          <div
            className="
              fixed
              inset-0
              z-[60]
              flex
              items-end
              justify-center
              bg-black/40
              p-3
              backdrop-blur-sm
              sm:items-center
              sm:p-4
            "
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                closePicker();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Select a token"
          >
            <div
              className="
                glass
                w-full
                min-w-0
                max-w-sm
                rounded-3xl
                p-4
              "
            >
              {/* POPUP HEADER */}
              <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                <h3 className="min-w-0 text-lg font-semibold">
                  Select a token
                </h3>

                <button
                  type="button"
                  className="shrink-0 text-slate-500 hover:text-cloud"
                  onClick={closePicker}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* SEARCH INPUT */}
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or symbol"
                className="
                  mb-3
                  w-full
                  min-w-0
                  rounded-xl
                  border
                  border-blue-100
                  bg-blue-50/70
                  px-3.5
                  py-2.5
                  text-base
                  outline-none
                  focus:border-altitude/60
                "
              />

              {/* TOKEN LIST */}
              <ul className="max-h-[60vh] space-y-1 overflow-y-auto sm:max-h-72">
                {list.map((t) => {
                  const configured = isTokenConfigured(t);

                  const blocked =
                    !configured || disabledIds.includes(t.id);

                  return (
                    <li key={t.id} className="min-w-0">
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => {
                          onChange(t.id);
                          closePicker();
                        }}
                        className={`
                          flex
                          w-full
                          min-w-0
                          items-center
                          gap-3
                          rounded-xl
                          px-3
                          py-2.5
                          text-left
                          transition
                          hover:bg-blue-100/70
                          disabled:cursor-not-allowed
                          disabled:opacity-40
                          disabled:hover:bg-transparent
                          ${
                            t.id === value.id
                              ? 'bg-blue-100/70'
                              : ''
                          }
                        `}
                      >
                        {/* TOKEN ICON */}
                        <span className="shrink-0">
                          <TokenIcon token={t} />
                        </span>

                        {/* TOKEN NAME */}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {t.symbol}
                          </span>

                          <span className="block truncate text-xs text-slate-500">
                            {configured
                              ? t.name
                              : 'Address not configured'}
                          </span>
                        </span>

                        {/* TOKEN BALANCE */}
                        <span className="max-w-[40%] min-w-0 shrink-0 truncate text-right font-mono text-sm text-slate-600">
                          {configured
                            ? formatAmount(
                                balances[t.id] ?? 0n,
                                t.decimals,
                                4
                              )
                            : '–'}
                        </span>
                      </button>
                    </li>
                  );
                })}

                {!list.length && (
                  <li className="px-3 py-6 text-center text-sm text-slate-500">
                    No tokens match “{query}”.
                  </li>
                )}
              </ul>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
