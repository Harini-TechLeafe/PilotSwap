/** Tiny price line. Green when the day is up, red when down, flat line for stablecoins. */
export default function Sparkline({ values, className = '' }: { values?: number[]; className?: string }) {
  if (!values || values.length < 2) return <span className={`block ${className}`} aria-hidden />;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(2)},${(30 - ((v - lo) / span) * 28 - 1).toFixed(2)}`).join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden>
      <polyline points={hi === lo ? '0,15 100,15' : pts} fill="none" stroke={up ? '#059669' : '#e11d48'} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
