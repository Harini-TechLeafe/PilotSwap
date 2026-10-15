import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useToast } from '../components/Toast';
import { fetchSolPortfolio, parseSolError, sendSol, sendSpl, solExplorerTx, type SolPortfolio } from '../lib/solana';
import { listSolanaWallets, onSolanaWalletsChange, startSolanaDiscovery, type SolWallet } from '../lib/solanaWallets';

const DISCONNECT_FLAG = 'pilotswap.sol.disconnected';
const WALLET_KEY = 'pilotswap.sol.wallet';

export interface SolTx {
  phase: 'wallet' | 'pending' | 'success' | 'error';
  signature?: string;
  message?: string;
}

export interface SolanaState {
  wallets: SolWallet[];
  selected: SolWallet | null;
  address: string | null;
  connecting: boolean;
  portfolio: SolPortfolio | null;
  loading: boolean;
  tx: SolTx | null;
  clearTx: () => void;
  connect: (w: SolWallet) => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  /** mint === null means native SOL. `amount` is in the smallest unit (lamports / token base units). */
  send: (args: { to: string; mint: string | null; amount: bigint; decimals: number }) => Promise<void>;
}

const Ctx = createContext<SolanaState | null>(null);

export function SolanaProvider({ children }: { children: ReactNode }) {
  const { push } = useToast();
  const [wallets, setWallets] = useState<SolWallet[]>([]);
  const [selected, setSelected] = useState<SolWallet | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [portfolio, setPortfolio] = useState<SolPortfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [tx, setTx] = useState<SolTx | null>(null);
  const triedAuto = useRef(false);

  // Discover wallets
  useEffect(() => {
    startSolanaDiscovery();
    const sync = () => setWallets(listSolanaWallets());
    sync();
    return onSolanaWalletsChange(sync);
  }, []);

  // Silent reconnect to the wallet used last time (no popup). Skipped after the user clicked Disconnect.
  useEffect(() => {
    if (triedAuto.current || selected || localStorage.getItem(DISCONNECT_FLAG) === '1') return;
    const saved = localStorage.getItem(WALLET_KEY);
    const match = saved ? wallets.find((w) => w.id === saved) : null;
    if (!match) return;
    triedAuto.current = true;
    match
      .connect({ silent: true })
      .then((addr) => {
        if (addr) {
          setSelected(match);
          setAddress(addr);
        }
      })
      .catch(() => {});
  }, [wallets, selected]);

  // Follow account switches / disconnects made inside the wallet
  useEffect(() => {
    if (!selected) return;
    return selected.subscribe((addr) => {
      setAddress(addr);
      if (!addr) push({ kind: 'info', title: 'Solana wallet disconnected' });
    });
  }, [selected, push]);

  const refresh = useCallback(async () => {
    if (!address) {
      setPortfolio(null);
      return;
    }
    setLoading(true);
    try {
      setPortfolio(await fetchSolPortfolio(address));
    } catch (e) {
      push({ kind: 'error', title: 'Could not load Solana balances', message: parseSolError(e).message });
    } finally {
      setLoading(false);
    }
  }, [address, push]);

  useEffect(() => {
    void refresh();
    if (!address) return;
    const id = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(id);
  }, [address, refresh]);

  const connect = useCallback(
    async (w: SolWallet) => {
      setConnecting(true);
      try {
        const addr = await w.connect();
        if (!addr) throw new Error('The wallet did not share a Solana account.');
        localStorage.removeItem(DISCONNECT_FLAG);
        localStorage.setItem(WALLET_KEY, w.id);
        setSelected(w);
        setAddress(addr);
        push({ kind: 'success', title: `${w.name} connected` });
      } catch (e) {
        const { message, rejected } = parseSolError(e);
        push({ kind: 'error', title: rejected ? 'Connection rejected' : 'Could not connect', message });
      } finally {
        setConnecting(false);
      }
    },
    [push],
  );

  const disconnect = useCallback(async () => {
    localStorage.setItem(DISCONNECT_FLAG, '1');
    const w = selected;
    setSelected(null);
    setAddress(null);
    setPortfolio(null);
    setTx(null);
    if (w) await w.disconnect();
  }, [selected]);

  const send = useCallback<SolanaState['send']>(
    async ({ to, mint, amount, decimals }) => {
      if (!selected || !address) return;
      setTx({ phase: 'wallet' });
      try {
        const onSent = (signature: string) => setTx({ phase: 'pending', signature });
        const sig = mint ? await sendSpl(selected, address, to, mint, amount, decimals, onSent) : await sendSol(selected, address, to, amount, onSent);
        setTx({ phase: 'success', signature: sig });
        push({ kind: 'success', title: 'Transfer confirmed', href: solExplorerTx(sig) });
        await refresh();
      } catch (e) {
        const { message, rejected } = parseSolError(e);
        setTx((t) => ({ phase: 'error', message, signature: t?.signature }));
        push({ kind: 'error', title: rejected ? 'Request rejected' : 'Transfer failed', message });
      }
    },
    [selected, address, push, refresh],
  );

  const value = useMemo<SolanaState>(
    () => ({ wallets, selected, address, connecting, portfolio, loading, tx, clearTx: () => setTx(null), connect, disconnect, refresh, send }),
    [wallets, selected, address, connecting, portfolio, loading, tx, connect, disconnect, refresh, send],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSolana(): SolanaState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSolana must be used inside <SolanaProvider>');
  return v;
}
