import { useEffect, useRef, useState } from 'react';
import { useChain } from '../chains/ChainContext';
import { CHAINS } from '../chains/registry';

export default function ChainSelector() {
  const { chain, setChainId } = useChain();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost focus-ring" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="mr-2 rounded-md bg-blue-100/70 px-1.5 py-0.5 text-[10px] font-bold">{chain.badge}</span>
        <span className="hidden sm:inline">{chain.name}</span> ▾
      </button>
      {open && (
        <div role="menu" className="glass absolute right-0 top-12 z-50 w-72 rounded-2xl p-2 text-sm">
          {CHAINS.map((c) => (
            <button key={c.id} role="menuitemradio" aria-checked={c.id === chain.id}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-blue-50 focus-ring ${c.id === chain.id ? 'bg-blue-100/70' : ''}`}
              onClick={() => { setChainId(c.id); setOpen(false); }}>
              <span className="rounded-md bg-blue-100/70 px-1.5 py-0.5 text-[10px] font-bold">{c.badge}</span>
              <span className="flex-1 text-slate-800">{c.name}</span>
              <span className={`text-[11px] ${c.supported ? 'text-emerald-600' : 'text-slate-500'}`}>{c.supported ? 'Live' : 'Soon'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
