# PilotSwap — Simple. Secure. Decentralized.

A React + Vite + TypeScript + Tailwind token-swap front end. Wallet + chain I/O uses **viem** and the injected **MetaMask** provider (EIP-1193).

> **Honest status:** the UI, wallet flow, approval flow and swap flow are complete. Swaps only work after you
> configure a **real Uniswap V2-style router, WETH and token addresses that exist on your testnet, with liquidity**.
> Until then the app shows a "Configuration incomplete" notice and keeps the Swap button disabled. No result is ever faked.

## Which protocol, and why
**Uniswap V2 Router02 interface** (or any V2 fork). It has a tiny, stable ABI, gives real on-chain quotes with
`getAmountsOut` (no off-chain quoter), and works with any ERC-20 pair. PilotSwap calls
`getAmountsOut`, `swapExactETHForTokens`, `swapExactTokensForETH`, `swapExactTokensForTokens`.
It tries a direct pool and a route through WETH and picks the better quote. See `contracts/README.md` for pools/liquidity.

## 1. Install
```bash
# Node.js 18+ required
cd pilotswap
npm install
```

## 2. Create `.env`
```bash
cp .env.example .env     # Windows: copy .env.example .env
```
| Variable | What to provide |
|---|---|
| `VITE_CHAIN_ID` | `11155111` (Sepolia, default), `84532` Base Sepolia, `421614` Arbitrum Sepolia, `11155420` OP Sepolia |
| `VITE_RPC_URL` | Your Alchemy/Infura/QuickNode URL for that testnet (optional; public RPC is the fallback) |
| `VITE_SWAP_ROUTER_ADDRESS` | **Replace**: verified Router02 on that testnet |
| `VITE_WETH_ADDRESS` | **Replace**: the router's WETH9 (`router.WETH()`) |
| `VITE_TBTC_ADDRESS` | Optional: your test Bitcoin token (`MockToken` with 8 decimals). Not real BTC |
| `VITE_USDC_ADDRESS`, `VITE_DAI_ADDRESS` | **Replace**: your verified ERC-20 test tokens (blank = token disabled) |

Never put private keys or secrets in `.env`: every `VITE_*` value is public in the browser bundle.

## 3. Connect MetaMask / configure the testnet
1. Install MetaMask (https://metamask.io/download/) and create/import a **dedicated test account**.
2. Run the app and click **Connect Wallet**; approve in MetaMask.
3. If MetaMask is on another network the app shows *"Wrong network. Please switch to the supported network."*.
   Click **Switch Network**. MetaMask asks you first, and the app also offers to add the network if it's missing. Nothing switches silently.

## 4. Get testnet ETH and tokens
* **ETH:** use a Sepolia faucet (e.g. Google Cloud Web3 faucet, Alchemy or Infura faucets). Gas needs ETH.
* **Tokens:** deploy your own with `contracts/MockToken.sol` (has a `faucet()`), then add liquidity. Steps in `contracts/README.md`.

## 5. Run locally
```bash
npm run dev          # http://localhost:5173
npm run typecheck    # TypeScript check
npm run build        # production build in dist/
```
Restart `npm run dev` whenever you edit `.env`.

## 6. Test a swap
1. Connect on the right network; balances appear.
2. Choose ETH → USDC (or any configured pair), type an amount. A quote, min received, price impact, fee estimate and route appear.
3. For ERC-20 inputs, click **Approve** (approves exactly that amount) and confirm in MetaMask, then click **Swap** and confirm.
4. Watch the pending animation. On success you get a toast and a block-explorer link to the tx hash.

## 7. Where to replace addresses
Only in `.env`. `src/config/contracts.ts` and `src/config/tokens.ts` read from it and validate addresses
(format, non-zero, and on-chain contract code). To add a token, append an entry in `src/config/tokens.ts`.

## Structure
```
src/
  config/      env.ts chains.ts tokens.ts contracts.ts
  hooks/       useWallet.ts useBalances.ts useSwap.ts useDeploymentCheck.ts
  components/  Navbar ConnectWallet SwapCard TokenSelector TokenIcon SlippageSettings TransactionStatus Toast Logo
  lib/         format.ts errors.ts
  pages/Home.tsx   App.tsx   main.tsx
contracts/     MockToken.sol (testnet faucet token) + liquidity guide
```

## Security handled
No key/seed requests or storage (only a boolean "disconnected" flag in localStorage) · token/router address validation incl. on-chain code check ·
strict amount parsing (no zero/negative/over-precision) · same-token and ETH↔WETH blocked · insufficient balance & gas ·
rejected MetaMask requests · wrong network · reverts are simulated before MetaMask opens and receipts are checked after · exact-amount approvals · 20-minute deadline · slippage bounds.

## Notes / limits
* Price impact is an estimate (compares your quote with a 0.1%-size quote). Network fee is an estimate.
* Fee-on-transfer tokens and tokens needing allowance-reset (e.g. USDT mainnet) are not supported in v1.
* Not audited. Testnet use only.

## Multi-chain address menu

Click your address in the top-right to see addresses grouped by **Ethereum, Solana and Bitcoin**.

- Ethereum comes from MetaMask's standard provider (`window.ethereum`).
- Solana and Bitcoin are discovered through the [Wallet Standard](https://github.com/wallet-standard/wallet-standard) (`src/lib/walletStandard.ts`). They only show up if your MetaMask version exposes that network to websites; otherwise the menu says "Not available in this MetaMask yet".
- Clicking a non-active address opens MetaMask's own account picker. A website is not allowed to change MetaMask's selected account silently, so PilotSwap asks MetaMask and then follows whichever account MetaMask reports. Switching accounts inside MetaMask also updates PilotSwap automatically.
- Swaps still run on the configured Ethereum testnet only.

Logo files live in `public/` (`logo-icon.png`, `logo-full.png`, `favicon.png`).


## Wallet picker (MetaMask, Trust Wallet, ...)

"Connect Wallet" opens a dialog listing every browser wallet installed (found with **EIP-6963**, `src/lib/eip6963.ts`). Wallets that are not installed show an Install link. Your last wallet is remembered and reconnects silently after a reload, unless you clicked Disconnect.

- Mobile Trust Wallet has no browser extension to detect. Supporting it needs WalletConnect (free project ID from cloud.reown.com); that is not included here.
- The Solana/Bitcoin rows in the address menu appear only if the wallet you picked exposes them (matched by wallet name).

## Multi-chain (EVM + non-EVM)
`src/chains/registry.ts` lists chains by family and defines the `SwapAdapter` interface. The navbar chain selector switches the
active chain; EVM (Sepolia) is fully working, while Solana, Cardano and Bitcoin show a "not implemented" card (nothing is faked).
To add one: implement a `SwapAdapter` for it, set `supported: true`, and render it in `src/pages/Home.tsx`.
Note: a single swap cannot cross families (e.g. ETH to SOL) without a bridge/cross-chain service.
