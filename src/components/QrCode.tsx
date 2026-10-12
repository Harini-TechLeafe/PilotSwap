import { useMemo } from 'react';
import { encodeQr } from '../lib/qr';

/** Crisp SVG QR code with a 4-module quiet zone (needed for reliable scanning). */
export default function QrCode({ value, size = 200, label }: { value: string; size?: number; label?: string }) {
  const { path, n } = useMemo(() => {
    const m = encodeQr(value);
    let d = '';
    m.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
    return { path: d, n: m.length + 8 };
  }, [value]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label={label ?? `QR code for ${value}`}>
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#0B1F4D" />
    </svg>
  );
}
