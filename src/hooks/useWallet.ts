import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createWalletClient, custom, getAddress, type Address, type EIP1193Provider, type WalletClient } from 'viem';
import { ACTIVE_CHAIN, ADD_CHAIN_PARAMS, CHAIN_ID_HEX } from '../config/chains';
import { useToast } from '../components/Toast';
import {
  accountsForFamily,
  connectStdWallet,
  disconnectStdWallet,
  findStdWallet,
  onWalletsChange,
  startWalletStandard,
  subscribeStdWallet,
} from '../lib/walletStandard';
import { addLegacyWalletIfNeeded, getDiscoveredWallets, onDiscoveryChange, startDiscovery, type DiscoveredWallet } from '../lib/eip6963';

export type NonEvmFamily = 'solana' | 'bitcoin';

export const METAMASK_MISSING = 'No browser wallet found. Please install MetaMask or Trust Wallet to continue.';
export const WRONG_NETWORK = 'Wrong network. Please switch to the supported network.';
// Only a boolean "user clicked disconnect" flag is stored. No keys, no seed phrases, ever.
const DISCONNECT_FLAG = 'pilotswap.disconnected';
// Which wallet the user picked last (e.g. "io.metamask"), so we can reconnect silently after a reload.
const WALLET_KEY = 'pilotswap.wallet';

export interface WalletState {
  isInstalled: boolean;
  account: Address | null;
  chainId: number | null;
  isConnected: boolean;
  isWrongNetwork: boolean;
  isConnecting: boolean;
  walletClient: WalletClient | null;
  /** Browser wallets found through EIP-6963 (MetaMask, Trust Wallet, ...). */
  wallets: DiscoveredWallet[];
  selectedWallet: DiscoveredWallet | null;
  pickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  /** Connect to one specific wallet from the picker. */
  connectWith: (wallet: DiscoveredWallet) => Promise<void>;
  /** Every Ethereum address MetaMask has shared with this site (active one first). */
  evmAccounts: Address[];
  solanaAccounts: string[];
  bitcoinAccounts: string[];
  activeSolana: string | null;
  activeBitcoin: string | null;
  /** Does this browser's MetaMask expose a Solana / Bitcoin wallet to websites? */
  solanaAvailable: boolean;
  bitcoinAvailable: boolean;
  /** Which non-EVM family is currently waiting for the MetaMask popup. */
  connectingFamily: NonEvmFamily | null;
  isSwitching: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  connectFamily: (family: NonEvmFamily) => Promise<void>;
  /** Ask MetaMask to make `address` the active account, and follow whatever MetaMask ends up selecting. */
  switchAccount: (family: 'evm' | NonEvmFamily, address: string) => Promise<void>;
}

function useWalletState(): WalletState {
  const { push } = useToast();
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [selected, setSelected] = useState<DiscoveredWallet | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const provider = selected?.provider ?? null;
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [evmAccounts, setEvmAccounts] = useState<Address[]>([]);
  const [connectingFamily, setConnectingFamily] = useState<NonEvmFamily | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [preferredSol, setPreferredSol] = useState<string | null>(null);
  const [preferredBtc, setPreferredBtc] = useState<string | null>(null);
  // Bumps whenever the Wallet Standard registry or a wallet's account list changes.
  const [stdTick, setStdTick] = useState(0);

  // Discover Solana / Bitcoin wallets (Wallet Standard) and re-render when their accounts change.
  useEffect(() => {
    startWalletStandard();
    const off = onWalletsChange(() => setStdTick((t) => t + 1));
    return off;
  }, []);

  const solWallet = useMemo(() => findStdWallet('solana', selected?.info.name ?? null), [stdTick, selected]); // eslint-disable-line react-hooks/exhaustive-deps
  const btcWallet = useMemo(() => findStdWallet('bitcoin', selected?.info.name ?? null), [stdTick, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const offs = [solWallet, btcWallet].filter(Boolean).map((w) => subscribeStdWallet(w!, () => setStdTick((t) => t + 1)));
    return () => offs.forEach((o) => o());
  }, [solWallet, btcWallet]);

  const solanaAccounts = useMemo(() => accountsForFamily(solWallet, 'solana'), [solWallet, stdTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const bitcoinAccounts = useMemo(() => accountsForFamily(btcWallet, 'bitcoin'), [btcWallet, stdTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeSolana = preferredSol && solanaAccounts.includes(preferredSol) ? preferredSol : solanaAccounts[0] ?? null;
  const activeBitcoin = preferredBtc && bitcoinAccounts.includes(preferredBtc) ? preferredBtc : bitcoinAccounts[0] ?? null;

  // Discover installed wallets (EIP-6963). Old wallets without it fall back to window.ethereum.
  useEffect(() => {
    startDiscovery();
    const sync = () => setWallets(getDiscoveredWallets());
    const off = onDiscoveryChange(sync);
    sync();
    const t = window.setTimeout(addLegacyWalletIfNeeded, 800);
    return () => {
      off();
      window.clearTimeout(t);
    };
  }, []);

  // Reconnect to the wallet the user used last time (only if they did not click Disconnect).
  useEffect(() => {
    if (selected || localStorage.getItem(DISCONNECT_FLAG) === '1') return;
    const saved = localStorage.getItem(WALLET_KEY);
    const match = saved ? wallets.find((w) => w.info.rdns === saved) : null;
    if (match) setSelected(match);
  }, [wallets, selected]);

  // Restore an already-authorised session silently + subscribe to wallet events.
  useEffect(() => {
    if (!provider) return;

    const onAccounts = (accs: string[]) => {
      if (!accs.length) {
        setAccount(null);
        setEvmAccounts([]);
        push({ kind: 'info', title: 'Wallet disconnected' });
      } else {
        localStorage.removeItem(DISCONNECT_FLAG);
        setEvmAccounts(accs.map((a) => getAddress(a)));
        setAccount(getAddress(accs[0])); // MetaMask's active account is always first
      }
    };
    const onChain = (hex: string) => setChainId(parseInt(hex, 16));
    const onDisconnect = () => setAccount(null);

    provider.on('accountsChanged', onAccounts);
    provider.on('chainChanged', onChain);
    provider.on('disconnect', onDisconnect);

    provider.request({ method: 'eth_chainId' }).then((id) => setChainId(parseInt(id as string, 16))).catch(() => {});
    if (localStorage.getItem(DISCONNECT_FLAG) !== '1') {
      provider
        .request({ method: 'eth_accounts' }) // does NOT open a popup
        .then((accs) => {
          const list = accs as string[];
          if (list.length) {
            setEvmAccounts(list.map((a) => getAddress(a)));
            setAccount(getAddress(list[0]));
          }
        })
        .catch(() => {});
    }

    // Fallback: some wallet/iframe setups miss 'chainChanged', so re-read the chain id every 2 s.
    const poll = window.setInterval(() => {
      provider.request({ method: 'eth_chainId' }).then((id) => setChainId(parseInt(id as string, 16))).catch(() => {});
    }, 2000);

    return () => {
      window.clearInterval(poll);
      provider.removeListener('accountsChanged', onAccounts);
      provider.removeListener('chainChanged', onChain);
      provider.removeListener('disconnect', onDisconnect);
    };
  }, [provider, push]);

  const openPicker = useCallback(() => setPickerOpen(true), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const connectWith = useCallback(
    async (w: DiscoveredWallet) => {
      const p = w.provider;
      const name = w.info.name;
      setIsConnecting(true);
      try {
        const accs = (await p.request({ method: 'eth_requestAccounts' })) as string[];
        if (!accs.length) throw new Error('No account returned');
        localStorage.removeItem(DISCONNECT_FLAG);
        localStorage.setItem(WALLET_KEY, w.info.rdns);
        setSelected(w);
        setEvmAccounts(accs.map((a) => getAddress(a)));
        setAccount(getAddress(accs[0]));
        setChainId(parseInt((await p.request({ method: 'eth_chainId' })) as string, 16));
        setPickerOpen(false);
        push({ kind: 'success', title: `${name} connected` });
      } catch (e: any) {
        if (e?.code === 4001) push({ kind: 'error', title: 'Connection rejected', message: 'You declined the connection request.' });
        else if (e?.code === -32002) push({ kind: 'info', title: 'Request pending', message: `Open the ${name} extension to finish connecting.` });
        else push({ kind: 'error', title: 'Could not connect', message: e?.message ?? 'Unknown error' });
      } finally {
        setIsConnecting(false);
      }
    },
    [push],
  );

  /** "Connect Wallet" buttons call this: it opens the wallet picker. */
  const connect = useCallback(async () => {
    setPickerOpen(true);
  }, []);

  const disconnect = useCallback(async () => {
    localStorage.setItem(DISCONNECT_FLAG, '1');
    setAccount(null);
    setEvmAccounts([]);
    setPreferredSol(null);
    setPreferredBtc(null);
    if (solWallet) void disconnectStdWallet(solWallet);
    if (btcWallet && btcWallet !== solWallet) void disconnectStdWallet(btcWallet);
    try {
      // Newer MetaMask versions support revoking site permissions; ignore if unsupported.
      await provider?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
    } catch {
      /* not supported: the app-level disconnect is enough */
    }
  }, [provider, solWallet, btcWallet]);

  /** Only runs when the user clicks "Switch Network". Never called automatically. */
  const switchNetwork = useCallback(async () => {
    if (!provider) return;
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
    } catch (e: any) {
      if (e?.code === 4902 || e?.data?.originalError?.code === 4902) {
        try {
          await provider.request({ method: 'wallet_addEthereumChain', params: [ADD_CHAIN_PARAMS] });
        } catch (e2: any) {
          if (e2?.code !== 4001) push({ kind: 'error', title: 'Could not add network', message: e2?.message });
        }
      } else if (e?.code !== 4001) {
        push({ kind: 'error', title: 'Could not switch network', message: e?.message });
      }
    }
  }, [provider, push]);

  /** Connect MetaMask's Solana or Bitcoin side (opens a MetaMask popup). */
  const connectFamily = useCallback(
    async (family: NonEvmFamily) => {
      const w = family === 'solana' ? solWallet : btcWallet;
      if (!w) {
        push({ kind: 'info', title: `${family === 'solana' ? 'Solana' : 'Bitcoin'} not available`, message: 'Your wallet does not expose this network to websites yet. Update MetaMask and reload.' });
        return;
      }
      setConnectingFamily(family);
      try {
        const addrs = await connectStdWallet(w, family);
        setStdTick((t) => t + 1);
        if (!addrs.length) push({ kind: 'info', title: 'No account shared', message: 'Select at least one account in your wallet.' });
        else push({ kind: 'success', title: `${family === 'solana' ? 'Solana' : 'Bitcoin'} connected` });
      } catch (e: any) {
        if (e?.code === 4001 || /reject|denied|declin/i.test(e?.message ?? '')) push({ kind: 'error', title: 'Connection rejected', message: 'You declined the request in your wallet.' });
        else push({ kind: 'error', title: 'Could not connect', message: e?.message ?? 'Unknown error' });
      } finally {
        setConnectingFamily(null);
      }
    },
    [solWallet, btcWallet, push],
  );

  /**
   * A website cannot silently change MetaMask's selected account (a wallet security rule).
   * What it CAN do is open MetaMask's own account picker. We open it here, then follow whatever
   * MetaMask reports afterwards, so PilotSwap and MetaMask always end up on the same address.
   */
  const switchAccount = useCallback(
    async (family: 'evm' | NonEvmFamily, address: string) => {
      setIsSwitching(true);
      try {
        if (family === 'evm') {
          if (!provider) return;
          push({ kind: 'info', title: 'Confirm in your wallet', message: `Select ${address.slice(0, 6)}…${address.slice(-4)} in the wallet popup.` });
          await provider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
          const accs = (await provider.request({ method: 'eth_accounts' })) as string[];
          if (accs.length) {
            setEvmAccounts(accs.map((a) => getAddress(a)));
            setAccount(getAddress(accs[0]));
          }
        } else {
          const w = family === 'solana' ? solWallet : btcWallet;
          if (!w) return;
          push({ kind: 'info', title: 'Confirm in your wallet', message: `Select ${address.slice(0, 4)}…${address.slice(-4)} in the wallet popup.` });
          const addrs = await connectStdWallet(w, family);
          const next = addrs.includes(address) ? address : addrs[0] ?? null;
          if (family === 'solana') setPreferredSol(next);
          else setPreferredBtc(next);
          setStdTick((t) => t + 1);
        }
      } catch (e: any) {
        if (e?.code !== 4001 && !/reject|denied|declin/i.test(e?.message ?? '')) {
          if (e?.code === -32002) push({ kind: 'info', title: 'Request pending', message: 'Open your wallet extension to finish.' });
          else push({ kind: 'error', title: 'Could not switch account', message: e?.message ?? 'Unknown error' });
        }
      } finally {
        setIsSwitching(false);
      }
    },
    [provider, solWallet, btcWallet, push],
  );

  const walletClient = useMemo<WalletClient | null>(
    () => (provider && account ? createWalletClient({ account, chain: ACTIVE_CHAIN, transport: custom(provider as unknown as EIP1193Provider) }) : null),
    [provider, account],
  );

  return {
    isInstalled: wallets.length > 0,
    account,
    chainId,
    isConnected: !!account,
    isWrongNetwork: !!account && chainId !== null && chainId !== ACTIVE_CHAIN.id,
    isConnecting,
    walletClient,
    wallets,
    selectedWallet: selected,
    pickerOpen,
    openPicker,
    closePicker,
    connectWith,
    evmAccounts,
    solanaAccounts,
    bitcoinAccounts,
    activeSolana,
    activeBitcoin,
    solanaAvailable: !!solWallet,
    bitcoinAvailable: !!btcWallet,
    connectingFamily,
    isSwitching,
    connect,
    disconnect,
    switchNetwork,
    connectFamily,
    switchAccount,
  };
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const value = useWalletState();
  return createElement(WalletContext.Provider, { value }, children);
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}
