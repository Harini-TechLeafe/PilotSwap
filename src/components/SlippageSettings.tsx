import { useEffect, useRef, useState } from 'react';

const PRESETS = [10, 50, 100]; // basis points

export default function SlippageSettings({ valueBps, onChange, disabled }: { valueBps: number; onChange: (bps: number) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const applyCustom = (v: string) => {
    setCustom(v);
    const n = Number(v);
    if (v !== '' && Number.isFinite(n) && n >= 0.01 && n <= 50) onChange(Math.round(n * 100));
  };

  return (
    <div className="relative" ref={ref}>
      <button disabled={disabled} onClick={() => setOpen((o) => !o)} className="btn-ghost focus-ring" aria-expanded={open} aria-label="Slippage settings">
        ⚙ {(valueBps / 100).toFixed(2)}%
      </button>
      {open && (
        <div className="glass absolute right-0 top-11 z-30 w-64 rounded-2xl p-4">
          <p className="mb-2 text-sm font-medium">Slippage tolerance</p>
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => { onChange(p); setCustom(''); }} className={`flex-1 rounded-lg border px-2 py-1.5 text-sm ${valueBps === p ? 'border-horizon text-horizon' : 'border-blue-100 hover:bg-blue-100/70'}`}>
                {p / 100}%
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-1.5 text-sm">
            <input value={custom} onChange={(e) => applyCustom(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Custom" className="w-full bg-transparent outline-none" />%
          </label>
          <p className="mt-2 text-xs text-slate-500">Allowed range 0.01% – 50%. {valueBps > 500 ? 'High slippage can cost you funds to price swings.' : 'Swaps revert if the price moves more than this.'}</p>
        </div>
      )}
    </div>
  );
}
