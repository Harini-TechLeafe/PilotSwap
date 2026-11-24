import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createWalletClient, custom, getAddress, type Address, type EIP1193Provider, type WalletClient } from 'viem';
import { ACTIVE_CHAIN, getAddChainParams, SUPPORTED_CHAINS } from '../config/chains';
import { useToast } from '../components/Toast';
import { addLegacyWalletIfNeeded, getDiscoveredWallets, onDiscoveryChange, startDiscovery, type DiscoveredWallet } from '../lib/eip6963';

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
  isSwitching: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchNetwork: (chainId?: number, quiet?: boolean) => Promise<boolean>;
  /** Ask MetaMask to make `address` the active account, and follow whatever MetaMask ends up selecting. */
  switchAccount: (address: string) => Promise<void>;
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
  const [isSwitching, setIsSwitching] = useState(false);

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
        setPickerOpen(false);
        localStorage.removeItem(DISCONNECT_FLAG);
        localStorage.setItem(WALLET_KEY, w.info.rdns);
        setSelected(w);
        setEvmAccounts(accs.map((a) => getAddress(a)));
        setAccount(getAddress(accs[0]));
        setChainId(parseInt((await p.request({ method: 'eth_chainId' })) as string, 16));
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
    try {
      // Newer MetaMask versions support revoking site permissions; ignore if unsupported.
      await provider?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
    } catch {
      /* not supported: the app-level disconnect is enough */
    }
  }, [provider]);

  /** Only runs when the user clicks "Switch Network". Never called automatically. */
  const switchNetwork = useCallback(async (targetChainId = ACTIVE_CHAIN.id, quiet = false) => {
    if (!provider) return false;
    const targetChain = SUPPORTED_CHAINS[targetChainId];
    if (!targetChain) {
      if (!quiet) push({ kind: 'error', title: 'Unsupported network', message: `Chain ID ${targetChainId} is not configured in PilotSwap.` });
      return false;
    }
    const chainIdHex = `0x${targetChainId.toString(16)}`;
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
      return true;
    } catch (e: any) {
      if (e?.code === 4902 || e?.data?.originalError?.code === 4902) {
        try {
          await provider.request({ method: 'wallet_addEthereumChain', params: [getAddChainParams(targetChainId)] });
          await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
          return true;
        } catch (e2: any) {
          if (!quiet && e2?.code !== 4001) push({ kind: 'error', title: 'Could not switch network', message: e2?.message });
        }
      } else if (e?.code !== 4001) {
        if (!quiet) push({ kind: 'error', title: 'Could not switch network', message: e?.message });
      }
      return false;
    }
  }, [provider, push]);

  const switchAccount = useCallback(
    async (address: string) => {
      setIsSwitching(true);
      try {
        if (!provider) return;
        push({ kind: 'info', title: 'Confirm in your wallet', message: `Select ${address.slice(0, 6)}…${address.slice(-4)} in the wallet popup.` });
        await provider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
        const accs = (await provider.request({ method: 'eth_accounts' })) as string[];
        if (accs.length) {
          setEvmAccounts(accs.map((a) => getAddress(a)));
          setAccount(getAddress(accs[0]));
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
    [provider, push],
  );

  const walletClient = useMemo<WalletClient | null>(
    () => (provider && account && chainId === ACTIVE_CHAIN.id ? createWalletClient({ account, chain: ACTIVE_CHAIN, transport: custom(provider as unknown as EIP1193Provider) }) : null),
    [provider, account, chainId],
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
    isSwitching,
    connect,
    disconnect,
    switchNetwork,
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
