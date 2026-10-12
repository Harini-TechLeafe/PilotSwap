const BASE = import.meta.env.BASE_URL;

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <a href="#top" className={`flex items-center gap-2.5 ${className}`} aria-label="PilotSwap home">
      {/* Icon cropped from the brand logo. White tile on the light blue/white theme. */}
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-white p-1 shadow-md shadow-blue-900/10">
        <img src={`${BASE}logo-icon.png`} alt="" width={32} height={22} className="h-auto w-full" draggable={false} />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight text-cloud">PilotSwap</span>
    </a>
  );
}
