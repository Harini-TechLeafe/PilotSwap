import { useMemo, useState } from 'react';
import { erc20Abi, formatUnits, getAddress, isAddress, parseEther, type Address, type Hex, type WalletClient } from 'viem';
import { ACTIVE_CHAIN, explorerTxUrl, publicClient } from '../config/chains';
import { getToken, isTokenConfigured } from '../config/tokens';
import { parseTxError } from '../lib/errors';
import { parseAmount } from '../lib/format';
import { useToast } from '../components/Toast';
import type { TxState } from './useSwap';

interface Args {
  account: Address | null;
  walletClient: WalletClient | null;
  ready: boolean;
  balances: Record<string, bigint>;
  refreshBalances: () => Promise<void>;
  initialTokenId: string;
}

/** Send ETH (native transfer) or an ERC-20 (transfer()) from the connected wallet to any address. */
export function useSend({ account, walletClient, ready, balances, refreshBalances, initialTokenId }: Args) {
  const { push } = useToast();
  const [tokenId, setTokenId] = useState(initialTokenId);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [tx, setTx] = useState<TxState | null>(null);

  const token = getToken(tokenId);
  const parsed = useMemo(() => parseAmount(amount, token.decimals), [amount, token.decimals]);
  const busy = tx?.phase === 'wallet' || tx?.phase === 'pending';
  const toTrimmed = to.trim();
  const toValid = isAddress(toTrimmed, { strict: false });

  const clearFinished = () => setTx((t) => (t && (t.phase === 'success' || t.phase === 'error') ? null : t));

  // First problem wins; null means the form can be submitted.
  const blocker = useMemo<string | null>(() => {
    if (!ready || !account) return 'Connect your wallet';
    if (!isTokenConfigured(token)) return `${token.symbol} address is not configured`;
    if (!toTrimmed) return 'Enter a recipient address';
    if (!toValid) return 'Recipient is not a valid address';
    if (getAddress(toTrimmed) === account) return 'You cannot send to your own address';
    if (token.address && getAddress(toTrimmed) === token.address) return 'That is the token contract, not a wallet';
    if (!amount) return 'Enter an amount';
    if (parsed === null || parsed <= 0n) return 'Enter a valid amount';
    if (parsed > (balances[token.id] ?? 0n)) return `Insufficient ${token.symbol} balance`;
    if ((balances.ETH ?? 0n) === 0n) return 'You need ETH to pay for gas';
    return null;
  }, [ready, account, token, toTrimmed, toValid, amount, parsed, balances]);

  const setMax = () => {
    clearFinished();
    const bal = balances[token.id] ?? 0n;
    const reserve = token.isNative ? parseEther('0.002') : 0n; // leave a little ETH for the gas fee
    setAmount(formatUnits(bal > reserve ? bal - reserve : 0n, token.decimals));
  };

  const send = async () => {
    if (blocker || busy || !walletClient || !account || !parsed) return;
    const recipient = getAddress(toTrimmed);
    setTx({ step: 'send', phase: 'wallet' });
    let hash: Hex | undefined;
    try {
      if (token.isNative) {
        hash = await walletClient.sendTransaction({ account, chain: ACTIVE_CHAIN, to: recipient, value: parsed });
      } else {
        const p = { account, address: token.address as Address, abi: erc20Abi, functionName: 'transfer', args: [recipient, parsed] } as const;
        await publicClient.simulateContract(p); // fails fast with a readable reason, before the wallet opens
        hash = await walletClient.writeContract({ ...p, chain: ACTIVE_CHAIN });
      }
      setTx({ step: 'send', phase: 'pending', hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Transfer reverted on-chain.');
      setTx({ step: 'send', phase: 'success', hash });
      push({ kind: 'success', title: `${amount} ${token.symbol} sent`, message: `To ${recipient.slice(0, 6)}…${recipient.slice(-4)}`, href: explorerTxUrl(hash) });
      setAmount('');
      await refreshBalances();
    } catch (e) {
      const { message, rejected } = parseTxError(e);
      setTx({ step: 'send', phase: 'error', message, hash });
      push({ kind: 'error', title: rejected ? 'Request rejected' : 'Transfer failed', message });
    }
  };

  return {
    token,
    setTokenId: (id: string) => { clearFinished(); setTokenId(id); setAmount(''); },
    to,
    setTo: (v: string) => { clearFinished(); setTo(v); },
    toValid,
    amount,
    setAmount: (v: string) => { clearFinished(); setAmount(v); },
    blocker,
    busy,
    tx,
    setTx,
    setMax,
    send,
  };
}
