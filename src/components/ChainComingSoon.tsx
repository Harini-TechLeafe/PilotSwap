import type { ChainEntry } from '../chains/registry';

/** Placeholder card for chains whose swap adapter is not written yet. Nothing is faked. */
export default function ChainComingSoon({ chain }: { chain: ChainEntry }) {
  return (
    <section className="glass rounded-3xl p-6" id="swap">
      <h2 className="text-xl font-semibold">Swap on {chain.name}</h2>
      <p className="mt-3 text-slate-600">Swaps on this network are not implemented yet.</p>
      <p className="mt-2 text-sm text-slate-500">{chain.note}. See <code className="rounded bg-blue-100/70 px-1.5 py-0.5">src/chains/registry.ts</code> for the adapter interface.</p>
    </section>
  );
}
