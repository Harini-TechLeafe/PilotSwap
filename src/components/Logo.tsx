const BASE = import.meta.env.BASE_URL;

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <a href="#top" className={`flex shrink-0 items-center gap-3 ${className}`} aria-label="PilotSwap home">
      {/* Icon cropped from the brand logo. White tile on the light blue/white theme. */}
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-white p-1.5 shadow-md shadow-blue-900/10">
        <img src={`${BASE}logo-icon.png`} alt="" width={40} height={28} className="h-auto w-full" draggable={false} />
      </span>
      <span className="font-display text-2xl font-bold tracking-tight text-cloud">PilotSwap</span>
    </a>
  );
}
