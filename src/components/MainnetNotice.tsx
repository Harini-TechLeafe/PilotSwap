import { ACTIVE_CHAIN, IS_MAINNET, chainName } from '../config/chains';

/** Shown only on the real-money networks (Ethereum mainnet, BNB Smart Chain), where every transaction moves real funds. */
export default function MainnetNotice({ className = '' }: { className?: string }) {
  if (!IS_MAINNET) return null;
  return (
    <p role="note" className={`flex items-start gap-2 rounded-xl border border-amber-600/40 bg-amber-50 px-3 py-2 text-xs text-amber-800 ${className}`}>
      <span aria-hidden="true">⚠</span>
      <span><strong>{chainName(ACTIVE_CHAIN.id)}.</strong> Transactions use real funds and cannot be undone. Check the token, amount and network before you confirm.</span>
    </p>
  );
}
