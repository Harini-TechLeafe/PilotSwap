import type { ChainEntry } from '../chains/registry';

/** Placeholder card for chains whose swap adapter is not written yet. Nothing is faked. */
export default function ChainComingSoon({ chain }: { chain: ChainEntry }) {
  return (
    <section className="glass rounded-3xl p-6" id="swap">
      <h2 className="text-xl font-semibold">Swap on {chain.name}</h2>
      <p className="mt-3 text-slate-600">Swaps on {chain.name} are coming soon.</p>
<p className="mt-2 text-sm text-slate-500">In the meantime, switch to Ethereum Sepolia to swap tokens.</p>
    </section>
  );
}
