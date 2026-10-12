import { useEffect, useState, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { ACTIVE_CHAIN, explorerAddressUrl } from '../config/chains';
import { isTokenConfigured, type Token } from '../config/tokens';
import { useSend } from '../hooks/useSend';
import { WRONG_NETWORK, useWallet } from '../hooks/useWallet';
import type { TokenPrice } from '../hooks/usePrices';
import { formatAmount, formatUsd, parseAmount, sanitizeAmountInput, shortAddress } from '../lib/format';
import QrCode from './QrCode';
import SwapCard from './SwapCard';
import TokenIcon from './TokenIcon';
import TokenSelector from './TokenSelector';
import TransactionStatus from './TransactionStatus';

type Tab = 'send' | 'receive' | 'swap';

interface Props {
  token: Token;
  balances: Record<string, bigint>;
  balancesLoading: boolean;
  refreshBalances: () => Promise<void>;
  prices: Record<string, TokenPrice>;
  onClose: () => void;
}

const Spinner = () => <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-horizon transition hover:bg-blue-100/70 focus-ring"
    >
      {copied ? 'Copied ✓' : label}
    </button>
  );
}

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</label>;
}

const ICONS: Record<Tab, ReactNode> = {
  send: <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
  receive: <path d="M12 5v14m0 0-6-6m6 6 6-6" />,
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4m4 4H7" />,
};

export default function TokenModal({ token, balances, balancesLoading, refreshBalances, prices, onClose }: Props) {
  const { account, isConnected, isConnecting, isWrongNetwork, walletClient, connect, switchNetwork } = useWallet();
  const ready = isConnected && !isWrongNetwork;
  const [tab, setTab] = useState<Tab | null>(null);
  const configured = isTokenConfigured(token);

  // Close on Escape (unless the inner token picker is the one that is open) and lock page scroll.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[aria-label="Select a token"]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const bal = balances[token.id];
  const price = prices[token.coingeckoId]?.usd;
  const usdValue = bal !== undefined && price !== undefined ? Number(formatUnits(bal, token.decimals)) * price : null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label={`${token.symbol} wallet actions`}>
      <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-blue-100 bg-white p-5 shadow-2xl shadow-blue-900/20 sm:rounded-3xl sm:p-6" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <TokenIcon token={token} size={44} />
            <div className="min-w-0">
              <h3 className="font-display text-xl font-semibold leading-tight">{token.symbol}</h3>
              <p className="truncate text-sm text-slate-500">{token.name} · {ACTIVE_CHAIN.name}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-500 transition hover:bg-blue-50 hover:text-cloud focus-ring">✕</button>
        </div>

        {/* Balance — the first and most prominent thing */}
        <div className="mt-5 rounded-2xl bg-gradient-to-br from-horizon to-altitude p-5 text-white shadow-lg shadow-blue-600/25">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">Your balance</p>
          <p className="mt-1 break-all font-display text-3xl font-bold tabular-nums sm:text-4xl">
            {!ready ? '—' : bal === undefined ? (balancesLoading ? 'Loading…' : '—') : `${formatAmount(bal, token.decimals, 6)} ${token.symbol}`}
          </p>
          <p className="mt-1 text-sm text-white/85 tabular-nums">
            {!isConnected ? 'Connect your wallet to see your balance'
              : isWrongNetwork ? `Switch to ${ACTIVE_CHAIN.name} to see your balance`
              : usdValue !== null ? `≈ ${formatUsd(usdValue)}${token.id === 'TBTC' ? ' (at real BTC price, test token)' : ''}` : ' '}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Token actions">
          {(['send', 'receive', 'swap'] as Tab[]).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(active ? null : t)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 font-display text-sm font-semibold uppercase tracking-wide transition focus-ring ${
                  active ? 'border-horizon bg-horizon text-white shadow-lg shadow-blue-600/25' : 'border-blue-100 bg-blue-50/70 text-horizon hover:bg-blue-100/70'
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[t]}</svg>
                {t}
              </button>
            );
          })}
        </div>

        {/* Panel */}
        {tab && (
          <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-4">
            {!isConnected ? (
              <div className="text-center">
                <p className="text-sm text-slate-600">Connect your wallet to {tab} {token.symbol}.</p>
                <button className="btn-primary mt-3" onClick={() => void connect()} disabled={isConnecting}>
                  {isConnecting ? <><Spinner /> Check your wallet…</> : 'Connect Wallet'}
                </button>
              </div>
            ) : isWrongNetwork ? (
              <div>
                <p role="alert" className="mb-3 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-sm text-rose-700">{WRONG_NETWORK} ({ACTIVE_CHAIN.name})</p>
                <button className="btn-primary" onClick={() => void switchNetwork()}>Switch Network</button>
              </div>
            ) : !configured ? (
              <p className="text-sm text-slate-600">{token.symbol} has no contract address configured yet. Add it to your <code className="rounded bg-blue-100/70 px-1">.env</code> file first.</p>
            ) : tab === 'send' ? (
              <SendPanel key={token.id} token={token} account={account!} walletClient={walletClient} balances={balances} refreshBalances={refreshBalances} prices={prices} />
            ) : tab === 'receive' ? (
              <ReceivePanel token={token} account={account!} />
            ) : (
              <SwapCard key={token.id} initialFromId={token.id} embedded onSwapped={() => void refreshBalances()} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────── SEND ───────────────────────────────
function SendPanel({ token: initial, account, walletClient, balances, refreshBalances, prices }: {
  token: Token;
  account: NonNullable<ReturnType<typeof useWallet>['account']>;
  walletClient: ReturnType<typeof useWallet>['walletClient'];
  balances: Record<string, bigint>;
  refreshBalances: () => Promise<void>;
  prices: Record<string, TokenPrice>;
}) {
  const s = useSend({ account, walletClient, ready: true, balances, refreshBalances, initialTokenId: initial.id });
  const { token } = s;
  const bal = balances[token.id] ?? 0n;
  const parsed = parseAmount(s.amount, token.decimals);
  const over = parsed !== null && parsed > bal;
  const price = prices[token.coingeckoId]?.usd;
  const usd = price !== undefined && s.amount && parsed !== null ? Number(s.amount) * price : null;
  const toInvalid = s.to.trim() !== '' && !s.toValid;

  return (
    <form onSubmit={(e) => { e.preventDefault(); void s.send(); }}>
      <fieldset disabled={s.busy} className="m-0 min-w-0 space-y-4 border-0 p-0">
        <div>
          <FieldLabel>From address</FieldLabel>
          <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5">
            <span className="min-w-0 flex-1 break-all font-mono text-sm text-cloud">{account}</span>
            <CopyButton text={account} />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="send-to">To address</FieldLabel>
          <input
            id="send-to"
            value={s.to}
            onChange={(e) => s.setTo(e.target.value)}
            placeholder="0x… recipient wallet address"
            autoComplete="off"
            spellCheck={false}
            className={`w-full rounded-xl border bg-white px-3 py-2.5 font-mono text-sm outline-none transition focus:border-altitude/60 ${toInvalid ? 'border-rose-400' : 'border-blue-100'}`}
          />
          {toInvalid && <p className="mt-1 text-xs text-rose-600">Not a valid {ACTIVE_CHAIN.name} address.</p>}
        </div>

        <div>
          <FieldLabel>Token</FieldLabel>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2">
            <TokenSelector value={token} onChange={s.setTokenId} balances={balances} />
            <p className="text-right text-sm text-slate-500">
              Balance<br />
              <span className="font-semibold text-cloud tabular-nums">{formatAmount(bal, token.decimals, 6)} {token.symbol}</span>
            </p>
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="send-amount">Amount</FieldLabel>
          <div className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2 transition focus-within:border-altitude/60 ${over ? 'border-rose-400' : 'border-blue-100'}`}>
            <input
              id="send-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.0"
              value={s.amount}
              onChange={(e) => s.setAmount(sanitizeAmountInput(e.target.value))}
              className={`min-w-0 flex-1 bg-transparent font-display text-2xl font-semibold outline-none placeholder:text-slate-300 ${over ? 'text-rose-600' : ''}`}
            />
            <button type="button" onClick={s.setMax} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-horizon hover:bg-blue-100/70">MAX</button>
            <span className="font-display font-semibold text-slate-600">{token.symbol}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{usd !== null ? `≈ ${formatUsd(usd)}` : token.isNative ? 'MAX keeps 0.002 ETH back for the network fee.' : 'Network fee is paid in ETH.'}</p>
        </div>
      </fieldset>

      <div className="mt-4">
        {s.busy ? (
          <button type="button" className="btn-primary" disabled><Spinner /> {s.tx?.phase === 'wallet' ? 'Confirm in your wallet…' : 'Sending…'}</button>
        ) : (
          <button type="submit" className="btn-primary" disabled={!!s.blocker}>{s.blocker ?? `Send ${s.amount} ${token.symbol}`}</button>
        )}
      </div>
      {s.tx && <TransactionStatus tx={s.tx} onDismiss={() => s.setTx(null)} />}
    </form>
  );
}

// ────────────────────────────── RECEIVE ─────────────────────────────
function ReceivePanel({ token, account }: { token: Token; account: string }) {
  const contractUrl = token.address ? explorerAddressUrl(token.address) : null;
  return (
    <div className="text-center">
      <p className="font-display text-base font-semibold">Receive {token.symbol}</p>
      <p className="mt-0.5 text-sm text-slate-500">Scan or share this address to get {token.symbol} on {ACTIVE_CHAIN.name}.</p>

      <div className="mx-auto mt-4 inline-block rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
        <QrCode value={account} size={208} label={`QR code of your ${token.symbol} receive address`} />
      </div>

      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your {token.symbol} address</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="min-w-0 flex-1 break-all font-mono text-sm text-cloud">{account}</span>
          <CopyButton text={account} />
        </div>
      </div>

      {!token.isNative && token.address && (
        <div className="mt-2 rounded-xl border border-blue-100 p-3 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{token.symbol} token contract</p>
          <div className="mt-1 flex items-center gap-2">
            <a href={contractUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 font-mono text-sm text-horizon hover:underline">{shortAddress(token.address)}</a>
            <CopyButton text={token.address} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Import this contract in your wallet if {token.symbol} does not show up after you receive it.</p>
        </div>
      )}

      <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-left text-xs text-amber-800">
        Only send {token.symbol} on <b>{ACTIVE_CHAIN.name}</b> to this address. Tokens sent from another network can be lost.
      </p>
    </div>
  );
}
