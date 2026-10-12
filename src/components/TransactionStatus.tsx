import { explorerTxUrl } from '../config/chains';
import type { TxState } from '../hooks/useSwap';

const TITLES: Record<TxState['step'], Record<TxState['phase'], string>> = {
  approve: { wallet: 'Confirm the approval in MetaMask', pending: 'Approval pending on-chain', success: 'Approval confirmed', error: 'Approval failed' },
  swap: { wallet: 'Confirm the swap in MetaMask', pending: 'Swap pending on-chain', success: 'Swap successful', error: 'Swap failed' },
  send: { wallet: 'Confirm the transfer in your wallet', pending: 'Transfer pending on-chain', success: 'Transfer sent', error: 'Transfer failed' },
};

export default function TransactionStatus({ tx, onDismiss }: { tx: TxState; onDismiss: () => void }) {
  const link = tx.hash ? explorerTxUrl(tx.hash) : null;
  const working = tx.phase === 'wallet' || tx.phase === 'pending';
  const tone = tx.phase === 'success' ? 'border-emerald-400/40 bg-emerald-400/5' : tx.phase === 'error' ? 'border-rose-400/40 bg-rose-400/5' : 'border-horizon/30 bg-horizon/5';

  return (
    <div role="status" className={`mt-4 rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{TITLES[tx.step][tx.phase]}</p>
        {!working && <button onClick={onDismiss} aria-label="Dismiss" className="text-slate-500 hover:text-cloud">✕</button>}
      </div>

      {working && (
        <div className="relative mt-4 mb-1" aria-hidden>
          <div className="flight-track" />
          <svg className="flight-plane absolute -top-[10px] left-0" width="22" height="22" viewBox="0 0 32 32"><path d="M4 16 28 6l-7 20-4.5-7.5z" fill="#1550E8" /></svg>
        </div>
      )}
      {tx.phase === 'wallet' && <p className="mt-2 text-sm text-slate-600">Waiting for your signature. Nothing is sent until you confirm.</p>}
      {tx.phase === 'pending' && <p className="mt-2 text-sm text-slate-600">Submitted. Waiting for blockchain confirmation…</p>}
      {tx.phase === 'error' && <p className="mt-2 text-sm text-rose-700">{tx.message}</p>}

      {tx.hash && (
        <div className="mt-3 text-sm">
          <span className="text-slate-500">Tx hash: </span>
          <span className="font-mono">{tx.hash.slice(0, 10)}…{tx.hash.slice(-8)}</span>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="ml-2 font-medium text-horizon hover:underline">
              View on explorer
            </a>
          )}
        </div>
      )}
    </div>
  );
}
