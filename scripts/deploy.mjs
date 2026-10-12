#!/usr/bin/env node
/**
 * PilotSwap one-shot testnet setup  (Ethereum Sepolia)
 *
 *   1. deploys MockToken as  USD Coin (USDC, 6 decimals)  and  Dai Stablecoin (DAI, 18 decimals)
 *   2. mints tokens to your deployer wallet
 *   3. creates ETH/USDC and ETH/DAI pools on the Uniswap V2 router in .env  (USDC <-> DAI routes via WETH)
 *   4. writes VITE_USDC_ADDRESS / VITE_DAI_ADDRESS into .env
 *
 * It is RESUMABLE: progress is saved in deployments.json, so if you run out of gas or the RPC
 * hiccups, top up / retry with `npm run deploy` and it continues where it stopped.
 *
 * Usage:   npm run deploy:dry     # budget check only, sends nothing
 *          npm run deploy         # does it (asks for confirmation; add --yes to skip)
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, http, parseAbi, parseEther, formatEther, formatGwei, getAddress, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const YES = process.argv.includes('--yes');

// ── tiny .env reader (no dependencies) ──────────────────────────────────────
function readEnv(file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}
const appEnv = readEnv('.env');
const depEnv = { ...readEnv('.env.deploy'), ...process.env };

const fail = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

// ── config ──────────────────────────────────────────────────────────────────
let pk = (depEnv.DEPLOYER_PRIVATE_KEY || '').trim();
if (!pk) fail('DEPLOYER_PRIVATE_KEY is missing. Copy .env.deploy.example to .env.deploy and paste the key of a THROWAWAY test wallet (never a wallet that holds real funds).');
if (!pk.startsWith('0x')) pk = `0x${pk}`;
if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) fail('DEPLOYER_PRIVATE_KEY must be 64 hex characters (export it from MetaMask: Account details → Show private key).');

const CHAIN_ID = Number(appEnv.VITE_CHAIN_ID || 11155111);
if (CHAIN_ID !== sepolia.id) fail(`This script is set up for Ethereum Sepolia (11155111); .env has VITE_CHAIN_ID=${CHAIN_ID}.`);
const RPC = depEnv.RPC_URL || appEnv.VITE_RPC_URL || sepolia.rpcUrls.default.http[0];
const ROUTER = appEnv.VITE_SWAP_ROUTER_ADDRESS;
const WETH = appEnv.VITE_WETH_ADDRESS;
if (!isAddress(ROUTER || '') || !isAddress(WETH || '')) fail('VITE_SWAP_ROUTER_ADDRESS / VITE_WETH_ADDRESS are missing in .env.');

const LIQ_ETH = parseEther(depEnv.LIQ_ETH || '0.0006');          // ETH put into EACH pool
const ETH_PRICE = BigInt(Math.round(Number(depEnv.ETH_PRICE_USD || 3000))); // initial pool price
const EXTRA_MINT = BigInt(depEnv.EXTRA_MINT_UNITS || 100000);     // whole tokens minted on top of the pool amount
const MAX_GWEI = depEnv.MAX_GAS_GWEI ? Number(depEnv.MAX_GAS_GWEI) : null; // optional safety cap

const TOKENS = [
  { key: 'usdc', name: 'USD Coin', symbol: 'USDC', decimals: 6, envKey: 'VITE_USDC_ADDRESS' },
  { key: 'dai', name: 'Dai Stablecoin', symbol: 'DAI', decimals: 18, envKey: 'VITE_DAI_ADDRESS' },
];

const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'MockToken.json'), 'utf8'));
const routerAbi = parseAbi([
  'function WETH() view returns (address)',
  'function factory() view returns (address)',
  'function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)',
]);
const factoryAbi = parseAbi(['function getPair(address,address) view returns (address)']);
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function mint(address to, uint256 amount)',
]);

const account = privateKeyToAccount(pk);
const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

// ── saved progress ──────────────────────────────────────────────────────────
const STATE_FILE = path.join(ROOT, 'deployments.json');
const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
state.chainId = CHAIN_ID; state.deployer = account.address; state.router = getAddress(ROUTER); state.weth = getAddress(WETH);
state.tokens ??= {}; state.steps ??= {};
const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

function writeEnv(key, value) {
  const p = path.join(ROOT, '.env');
  let text = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const re = new RegExp(`^${key}=.*$`, 'm');
  text = re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
  fs.writeFileSync(p, text);
}

const hasCode = async (addr) => { const c = await pub.getCode({ address: addr }); return !!c && c !== '0x'; };
const scaled = (dec) => (LIQ_ETH * ETH_PRICE * 10n ** BigInt(dec)) / 10n ** 18n; // token units worth LIQ_ETH at ETH_PRICE

async function send(label, fn) {
  process.stdout.write(`  • ${label} … `);
  const hash = await fn();
  process.stdout.write(`sent ${hash.slice(0, 12)}… `);
  const r = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (r.status !== 'success') fail(`${label} reverted. Tx: https://sepolia.etherscan.io/tx/${hash}`);
  console.log(`confirmed (gas ${r.gasUsed}, cost ${formatEther(r.gasUsed * r.effectiveGasPrice)} ETH)`);
  return r;
}

async function main() {
  console.log(`\nPilotSwap testnet setup\n  wallet : ${account.address}\n  network: Ethereum Sepolia\n  router : ${ROUTER}`);

  // 1) sanity checks
  const chainId = await pub.getChainId();
  if (chainId !== sepolia.id) fail(`RPC returned chain ${chainId}, expected Sepolia (11155111). Check RPC_URL / VITE_RPC_URL.`);
  if (!(await hasCode(ROUTER))) fail('The router address has no contract code on Sepolia.');
  const routerWeth = await pub.readContract({ address: ROUTER, abi: routerAbi, functionName: 'WETH' });
  if (routerWeth.toLowerCase() !== WETH.toLowerCase()) fail(`router.WETH() is ${routerWeth} but .env has VITE_WETH_ADDRESS=${WETH}. Fix .env.`);
  const factory = await pub.readContract({ address: ROUTER, abi: routerAbi, functionName: 'factory' });

  // 2) budget
  const balance = await pub.getBalance({ address: account.address });
  const fees = await pub.estimateFeesPerGas();
  const gasPrice = fees.maxFeePerGas ?? (await pub.getGasPrice());
  if (MAX_GWEI && Number(formatGwei(gasPrice)) > MAX_GWEI) fail(`Gas is ${formatGwei(gasPrice)} gwei, above your MAX_GAS_GWEI=${MAX_GWEI}. Try again later.`);

  // conservative gas figures (units): token deploy, mint, approve, first addLiquidityETH (creates the pair contract)
  const G = { deploy: 900_000n, mint: 80_000n, approve: 55_000n, addLiq: 2_600_000n };
  const doneTokens = TOKENS.filter((t) => state.tokens[t.key]).length;
  const doneLiq = TOKENS.filter((t) => state.steps[`liq_${t.key}`]).length;
  const gasUnits = BigInt(TOKENS.length - doneTokens) * G.deploy
    + BigInt(TOKENS.filter((t) => !state.steps[`mint_${t.key}`]).length) * G.mint
    + BigInt(TOKENS.length - doneLiq) * (G.approve + G.addLiq);
  const gasCost = gasUnits * gasPrice;
  const ethForPools = BigInt(TOKENS.length - doneLiq) * LIQ_ETH;
  const need = gasCost + ethForPools;

  console.log(`\nBudget`);
  console.log(`  balance            : ${formatEther(balance)} ETH`);
  console.log(`  gas price now      : ${formatGwei(gasPrice)} gwei`);
  console.log(`  est. gas (worst)   : ${gasUnits} units ≈ ${formatEther(gasCost)} ETH   (real cost is usually lower)`);
  console.log(`  ETH into pools     : ${formatEther(ethForPools)} ETH   (${formatEther(LIQ_ETH)} per pool, 1 ETH = ${ETH_PRICE} USDC/DAI)`);
  console.log(`  total needed       : ≈ ${formatEther(need)} ETH`);
  if (balance < need) {
    console.log(`\n⚠  Balance is below the worst-case estimate (short by ≈ ${formatEther(need - balance)} ETH).`);
    console.log(`   Options: lower LIQ_ETH in .env.deploy, wait for cheaper gas (set MAX_GAS_GWEI), or add a little more Sepolia ETH.`);
    console.log(`   The script is resumable, so if it runs dry mid-way just top up and run it again.`);
    if (!DRY && !YES) { /* let the user decide below */ }
  } else console.log(`\n✔ Balance covers the worst-case estimate.`);

  if (DRY) { console.log('\n(dry run: nothing was sent)\n'); return; }
  if (!YES) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const a = (await rl.question('\nProceed and send transactions on Sepolia? (y/N) ')).trim().toLowerCase();
    rl.close();
    if (a !== 'y' && a !== 'yes') { console.log('Cancelled.'); return; }
  }

  // 3) deploy tokens
  console.log('\nDeploying tokens');
  for (const t of TOKENS) {
    const saved = state.tokens[t.key];
    if (saved && (await hasCode(saved))) { console.log(`  • ${t.symbol} already deployed at ${saved}`); continue; }
    const r = await send(`deploy ${t.symbol}`, () => wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args: [t.name, t.symbol, t.decimals] }));
    state.tokens[t.key] = getAddress(r.contractAddress); save();
    writeEnv(t.envKey, state.tokens[t.key]);
    console.log(`    ${t.symbol} → ${state.tokens[t.key]}`);
  }

  // 4) mint
  console.log('\nMinting');
  for (const t of TOKENS) {
    if (state.steps[`mint_${t.key}`]) { console.log(`  • ${t.symbol} already minted`); continue; }
    const amount = scaled(t.decimals) + EXTRA_MINT * 10n ** BigInt(t.decimals);
    await send(`mint ${t.symbol} to your wallet`, () => wallet.writeContract({ address: state.tokens[t.key], abi: erc20Abi, functionName: 'mint', args: [account.address, amount] }));
    state.steps[`mint_${t.key}`] = true; save();
  }

  // 5) liquidity
  console.log('\nCreating ETH pools');
  for (const t of TOKENS) {
    if (state.steps[`liq_${t.key}`]) { console.log(`  • ETH/${t.symbol} pool already created`); continue; }
    const token = state.tokens[t.key];
    const tokenAmt = scaled(t.decimals);
    const bal = await pub.getBalance({ address: account.address });
    if (bal < LIQ_ETH + 2_800_000n * gasPrice) fail(`Not enough ETH left for the ETH/${t.symbol} pool (${formatEther(bal)} ETH). Top up and re-run \`npm run deploy\` — it will continue from here.`);
    const allowance = await pub.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [account.address, ROUTER] });
    if (allowance < tokenAmt) await send(`approve ${t.symbol} for router`, () => wallet.writeContract({ address: token, abi: erc20Abi, functionName: 'approve', args: [ROUTER, tokenAmt] }));
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
    await send(`add liquidity ETH/${t.symbol} (${formatEther(LIQ_ETH)} ETH)`, () =>
      wallet.writeContract({ address: ROUTER, abi: routerAbi, functionName: 'addLiquidityETH', args: [token, tokenAmt, 0n, 0n, account.address, deadline], value: LIQ_ETH }));
    state.steps[`liq_${t.key}`] = true; save();
  }

  // 6) report
  const left = await pub.getBalance({ address: account.address });
  console.log('\n──────────────── DONE ────────────────');
  for (const t of TOKENS) {
    const pair = await pub.readContract({ address: factory, abi: factoryAbi, functionName: 'getPair', args: [state.tokens[t.key], WETH] });
    console.log(`${t.symbol}: ${state.tokens[t.key]}\n   pool with WETH: ${pair}\n   https://sepolia.etherscan.io/address/${state.tokens[t.key]}`);
  }
  console.log(`\nETH left: ${formatEther(left)}`);
  console.log('.env was updated with VITE_USDC_ADDRESS and VITE_DAI_ADDRESS.');
  console.log('Next: npm run dev  → connect the SAME wallet (it holds the minted USDC/DAI).\n');
}

main().catch((e) => fail(e?.shortMessage || e?.message || String(e)));
