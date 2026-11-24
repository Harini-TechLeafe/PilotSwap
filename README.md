# PilotSwap — Simple. Secure. Decentralized.

A React + Vite + TypeScript + Tailwind token-swap front end. Wallet + chain I/O uses **viem** and the injected **EIP-1193** provider.

> **Honest status:** Sepolia and BNB Smart Chain Testnet use the V3 swap and liquidity flows. Use verified router, quoter,
> position manager, factory, wrapped-native, and token addresses for the selected network. Swaps require an initialized pool with liquidity.

## Supported EVM networks
Four EVM networks use the same swap, liquidity, balance and "Buy USDT" flows. Every network has the same variable set,
only the prefix changes:

| Network | Chain ID | DEX | `.env` prefix | Funds |
|---|---|---|---|---|
| Ethereum Mainnet | 1 | Uniswap V3 | `VITE_MAINNET_*` | **real** |
| BNB Smart Chain | 56 | PancakeSwap V3 | `VITE_BSC_MAINNET_*` | **real** |
| Ethereum Sepolia | 11155111 | Uniswap V3 | `VITE_SEPOLIA_*` | test |
| BNB Smart Chain Testnet | 97 | PancakeSwap V3 | `VITE_BSC_TESTNET_*` | test |

Sepolia is the default on first launch (`VITE_CHAIN_ID` changes that); pick another network in the selector to switch without
restarting Vite. The two mainnets ship with the official router / quoter / position manager / factory and the real
WETH-WBNB / USDC / USDT / DAI addresses as defaults, so only an RPC URL is needed (use your own provider for reliability).
Real-money networks show a warning banner. The app checks on load that the router, quoter and position manager belong together.

**Tokens:** ETH/BNB (gas coin), WETH/WBNB, USDC, DAI and **USDT**. On the testnets USDT is a token you deploy yourself with
`contracts/MockUSDT.sol` (see `contracts/README.md`) and set in `VITE_SEPOLIA_USDT_ADDRESS` / `VITE_BSC_TESTNET_USDT_ADDRESS`.
The **Buy USDT** page (navbar, after Liquidity) is the swap card with USDT preselected; it shows setup steps when USDT is not
configured on the current testnet.

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
| `VITE_SEPOLIA_CHAIN_ID` / `VITE_BSC_TESTNET_CHAIN_ID` | Network IDs: `11155111` (Sepolia, default) / `97` (BNB Testnet) |
| `VITE_SEPOLIA_RPC_URL` / `VITE_BSC_TESTNET_RPC_URL` | Network RPC URL (optional; public RPC is the fallback) |
| `VITE_SEPOLIA_SWAP_ROUTER_ADDRESS` / `VITE_BSC_TESTNET_SWAP_ROUTER_ADDRESS` | Verified V3 SwapRouter for the selected network |
| `VITE_SEPOLIA_QUOTER_ADDRESS` / `VITE_BSC_TESTNET_QUOTER_ADDRESS` | Verified V3 QuoterV2 |
| `VITE_SEPOLIA_POSITION_MANAGER_ADDRESS` / `VITE_BSC_TESTNET_POSITION_MANAGER_ADDRESS` | Verified V3 NonfungiblePositionManager |
| `VITE_SEPOLIA_FACTORY_ADDRESS` / `VITE_BSC_TESTNET_FACTORY_ADDRESS` | Verified V3 factory |
| `VITE_SEPOLIA_WETH_ADDRESS` / `VITE_BSC_TESTNET_WETH_ADDRESS` | Wrapped native token (WETH / WBNB) |
| `VITE_SEPOLIA_USDC_ADDRESS`, `VITE_SEPOLIA_DAI_ADDRESS` | Sepolia ERC-20 test tokens; use their `VITE_BSC_TESTNET_*` equivalents on BNB (blank = disabled) |

Never put private keys or secrets in `.env`: every `VITE_*` value is public in the browser bundle.
For BNB Testnet, use PancakeSwap's V3 **SwapRouter** address, not the SmartRouter address; see the [official V3 deployments](https://developer.pancakeswap.finance/contracts/v3/addresses).

## 3. Connect MetaMask / configure the testnet
1. Install MetaMask (https://metamask.io/download/) and create/import a **dedicated test account**.
2. Run the app and click **Connect Wallet**; approve in MetaMask.
3. If MetaMask is on another network the app shows *"Wrong network. Please switch to the supported network."*.
   Click **Switch Network**. MetaMask asks you first, and the app also offers to add the network if it's missing. Nothing switches silently.

## 4. Get testnet ETH and tokens
* **Gas coin:** get testnet ETH for Sepolia or tBNB for BNB Smart Chain Testnet from a faucet for that network.
* **Tokens:** deploy or obtain ERC-20 test tokens on the same network, configure their addresses, then add liquidity.
  Tokens on Sepolia cannot be used on BNB Testnet. `contracts/MockToken.sol` includes a `faucet()`; see `contracts/README.md`.

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
Only in `.env`. `src/config/contracts.ts` and `src/config/token.ts` read from it and validate addresses
(format, non-zero, and on-chain contract code). To add a token, append an entry in `src/config/token.ts`.

## Structure
```
src/
  config/      env.ts chains.ts token.ts contracts.ts
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

## Wallets and market data

Wallet connection and swaps use EVM-compatible wallets on Sepolia or BNB Smart Chain Testnet. BTC and SOL may appear in market listings and price data, but PilotSwap does not connect Bitcoin or Solana wallets or execute swaps on those networks.

Logo files live in `public/` (`logo-icon.png`, `logo-full.png`, `favicon.png`).


## Wallet picker (MetaMask, Trust Wallet, ...)

"Connect Wallet" opens a dialog listing every browser wallet installed (found with **EIP-6963**, `src/lib/eip6963.ts`). Wallets that are not installed show an Install link. Your last wallet is remembered and reconnects silently after a reload, unless you clicked Disconnect.

- Mobile Trust Wallet has no browser extension to detect. Supporting it needs WalletConnect (free project ID from cloud.reown.com); that is not included here.
## Supported networks
`src/config/chains.ts` lists supported EVM networks, including Sepolia and BNB Smart Chain Testnet. The network selector
switches between these configured EVM networks; MetaMask may ask for approval to switch or add the selected network.
`VITE_SEPOLIA_CHAIN_ID` sets the startup default, and changing `.env` requires restarting the server.

## Clean URLs and dark mode

- Pages use real paths, no `#`: `/`, `/tokens`, `/tokens/usdc`, `/liquidity`, `/buy-usdt`. Old links such as `#liquidity` or `#tokens/usdc` are redirected to the clean path automatically.
- Because these are real paths, the host must serve `index.html` for unknown paths. `public/_redirects` (Netlify/Cloudflare Pages) and `vercel.json` (Vercel) are included; `npm run dev` and `npm run preview` already do this.
- The moon button in the navbar switches light/dark (sun in dark mode). The choice is saved, and the first visit follows the system setting. Theme colours live as CSS variables in `src/index.css`.
