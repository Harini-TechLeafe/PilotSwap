import { APP_VERSION_LABEL } from '../config/version';

const BASE = import.meta.env.BASE_URL;

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-blue-100/70 bg-night/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2.5">
          <img src={`${BASE}logo-icon.png`} alt="" width={798} height={582} className="h-9 w-auto sm:h-10" draggable={false} />
          <span className="font-display text-lg font-bold tracking-tight text-cloud">PilotSwap</span>
        </div>
        <p className="text-sm text-slate-500">PilotSwap {APP_VERSION_LABEL}</p>
        <p className="text-sm text-slate-500">Simple. Secure. Decentralized.</p>
      </div>
    </footer>
  );
}
