import { useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { RECOMMENDED_WALLETS } from '../lib/eip6963';

/** "Connect a wallet" dialog: lists every installed wallet (EIP-6963) plus Install links for the popular ones. */
export default function WalletPicker() {
  const { pickerOpen, closePicker, wallets, connectWith, isConnecting } = useWallet();

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePicker();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pickerOpen, closePicker]);

  if (!pickerOpen) return null;

  const detected = new Set(wallets.map((w) => w.info.rdns));
  const missing = RECOMMENDED_WALLETS.filter((r) => !detected.has(r.rdns));

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={closePicker}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connect a wallet"
        className="glass w-full max-w-sm rounded-3xl p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connect a wallet</h2>
          <button className="rounded-lg px-2 py-1 text-slate-500 hover:bg-blue-100/70 hover:text-cloud focus-ring" onClick={closePicker} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">Choose the wallet you want to use with PilotSwap.</p>

        <ul className="mt-4 space-y-2">
          {wallets.map((w) => (
            <li key={w.info.rdns}>
              <button
                disabled={isConnecting}
                onClick={() => void connectWith(w)}
                className="flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-left transition hover:bg-blue-100/70 disabled:opacity-60 focus-ring"
              >
                {w.info.icon ? (
                  <img src={w.info.icon} alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100/70 text-sm">👛</span>
                )}
                <span className="font-medium text-slate-800">{w.info.name}</span>
                <span className="ml-auto text-xs text-emerald-600">Detected</span>
              </button>
            </li>
          ))}

          {missing.map((r) => (
            <li key={r.rdns}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-blue-100 px-4 py-3 text-slate-600 transition hover:bg-blue-50 focus-ring"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100/70 text-sm">⬇</span>
                <span className="font-medium">{r.name}</span>
                <span className="ml-auto text-xs text-horizon">Install</span>
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          After installing a wallet, reload this page. PilotSwap never asks for your private key or seed phrase.
        </p>
      </div>
    </div>
  );
}
