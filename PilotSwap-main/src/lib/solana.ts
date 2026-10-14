import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { ENV } from '../config/env';
import { KNOWN_SOL_TOKENS } from '../config/solanaTokens';
import type { SolWallet } from './solanaWallets';

export const connection = new Connection(ENV.solanaRpcUrl, 'confirmed');
export const SOL_DECIMALS = 9;
/** Keep a little SOL so the account stays alive and can pay fees. */
export const SOL_FEE_RESERVE = BigInt(Math.round(0.002 * LAMPORTS_PER_SOL));

export const solExplorerTx = (sig: string): string =>
  `https://explorer.solana.com/tx/${sig}${ENV.solanaCluster === 'mainnet-beta' ? '' : `?cluster=${ENV.solanaCluster}`}`;
export const solExplorerAddress = (a: string): string =>
  `https://explorer.solana.com/address/${a}${ENV.solanaCluster === 'mainnet-beta' ? '' : `?cluster=${ENV.solanaCluster}`}`;

export function isValidSolAddress(value: string): boolean {
  try {
    new PublicKey(value.trim());
    return true;
  } catch {
    return false;
  }
}

export interface SolToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  amount: bigint;
}
export interface SolPortfolio {
  sol: bigint;
  tokens: SolToken[];
}

/** SOL + every SPL token account the wallet owns (read straight from the chain, no API key). */
export async function fetchSolPortfolio(owner: string): Promise<SolPortfolio> {
  const pk = new PublicKey(owner);
  const [lamports, accounts] = await Promise.all([
    connection.getBalance(pk),
    connection.getParsedTokenAccountsByOwner(pk, { programId: TOKEN_PROGRAM_ID }),
  ]);
  const byMint = new Map<string, SolToken>();
  for (const { account } of accounts.value) {
    const info = (account.data as any).parsed?.info;
    if (!info) continue;
    const mint: string = info.mint;
    const amount = BigInt(info.tokenAmount.amount);
    const prev = byMint.get(mint);
    if (prev) {
      prev.amount += amount;
      continue;
    }
    const known = KNOWN_SOL_TOKENS[mint];
    byMint.set(mint, {
      mint,
      symbol: known?.symbol ?? `${mint.slice(0, 4)}…${mint.slice(-4)}`,
      name: known?.name ?? 'Unknown token',
      decimals: info.tokenAmount.decimals,
      amount,
    });
  }
  const tokens = [...byMint.values()].filter((t) => t.amount > 0n || KNOWN_SOL_TOKENS[t.mint]);
  tokens.sort((a, b) => (KNOWN_SOL_TOKENS[b.mint] ? 1 : 0) - (KNOWN_SOL_TOKENS[a.mint] ? 1 : 0) || a.symbol.localeCompare(b.symbol));
  return { sol: BigInt(lamports), tokens };
}

/** Sign with the wallet, send, and wait for confirmation. Returns the signature. */
async function signSendConfirm(wallet: SolWallet, feePayer: PublicKey, tx: Transaction, onSent?: (sig: string) => void): Promise<string> {
  const latest = await connection.getLatestBlockhash('confirmed');
  tx.feePayer = feePayer;
  tx.recentBlockhash = latest.blockhash;
  const signed = await wallet.signTransaction(tx);
  // sendRawTransaction runs the RPC's own simulation first, so a bad transfer fails here with a reason.
  const sig = await connection.sendRawTransaction(signed.serialize());
  onSent?.(sig);
  const res = await connection.confirmTransaction({ signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, 'confirmed');
  if (res.value.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(res.value.err)}`);
  return sig;
}

export async function sendSol(wallet: SolWallet, from: string, to: string, lamports: bigint, onSent?: (sig: string) => void): Promise<string> {
  const fromPk = new PublicKey(from);
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: fromPk, toPubkey: new PublicKey(to), lamports }));
  return signSendConfirm(wallet, fromPk, tx, onSent);
}

/** Send an SPL token. Creates the receiver's token account if it does not exist yet (sender pays the small rent). */
export async function sendSpl(
  wallet: SolWallet,
  from: string,
  to: string,
  mint: string,
  amount: bigint,
  decimals: number,
  onSent?: (sig: string) => void,
): Promise<string> {
  const fromPk = new PublicKey(from);
  const toPk = new PublicKey(to);
  const mintPk = new PublicKey(mint);
  const src = getAssociatedTokenAddressSync(mintPk, fromPk);
  const dst = getAssociatedTokenAddressSync(mintPk, toPk, true);
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(fromPk, dst, toPk, mintPk),
    createTransferCheckedInstruction(src, mintPk, dst, fromPk, amount, decimals),
  );
  return signSendConfirm(wallet, fromPk, tx, onSent);
}

/** Short, friendly text for wallet / RPC errors. */
export function parseSolError(e: unknown): { message: string; rejected: boolean } {
  const text = `${(e as any)?.message ?? e}`;
  const lower = text.toLowerCase();
  if ((e as any)?.code === 4001 || /reject|denied|declin|cancel/.test(lower)) return { message: 'You rejected the request in your wallet. Nothing was sent.', rejected: true };
  if (lower.includes('insufficient lamports') || lower.includes('insufficient funds')) return { message: 'Not enough SOL for the amount plus the network fee.', rejected: false };
  if (lower.includes('blockhash not found') || lower.includes('block height exceeded')) return { message: 'The transaction expired before confirming. Please try again.', rejected: false };
  if (lower.includes('failed to fetch') || lower.includes('403') || lower.includes('429')) return { message: 'Solana RPC is busy or blocked. Set VITE_SOLANA_RPC_URL to your own free RPC URL.', rejected: false };
  return { message: text.length > 220 ? `${text.slice(0, 220)}…` : text, rejected: false };
}
