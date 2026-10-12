import { createContext, useContext, useState, type ReactNode } from 'react';
import { CHAINS, type ChainEntry } from './registry';

interface Ctx { chain: ChainEntry; setChainId: (id: string) => void }
const ChainCtx = createContext<Ctx | null>(null);

export function ChainProvider({ children }: { children: ReactNode }) {
  const [id, setChainId] = useState(CHAINS[0].id);
  const chain = CHAINS.find((c) => c.id === id) ?? CHAINS[0];
  return <ChainCtx.Provider value={{ chain, setChainId }}>{children}</ChainCtx.Provider>;
}

export function useChain(): Ctx {
  const v = useContext(ChainCtx);
  if (!v) throw new Error('useChain must be used inside <ChainProvider>');
  return v;
}
