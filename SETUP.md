# PilotSwap: run it in 4 steps (Sepolia, blue & white theme)

Requires Node 18+.

1. **Install**
   ```
   npm install
   ```
2. **Add your deployer key (throwaway test wallet only)**
   ```
   cp .env.deploy.example .env.deploy
   ```
   Paste the private key of the wallet that holds your 0.00705 SepoliaETH into `DEPLOYER_PRIVATE_KEY`.
   (MetaMask → ⋮ → Account details → Show private key.) This file is git-ignored and used only by the deploy script.
3. **Check the budget, then deploy**
   ```
   npm run deploy:dry     # prints gas price + estimated cost, sends nothing
   npm run deploy         # deploys USDC + DAI, mints, creates ETH/USDC + ETH/DAI pools
   ```
   It writes `VITE_USDC_ADDRESS` and `VITE_DAI_ADDRESS` into `.env` automatically.
   If it stops (low balance, RPC error) just run `npm run deploy` again: it resumes from `deployments.json`.
4. **Run the app**
   ```
   npm run dev
   ```
   Open http://localhost:5173, connect the SAME wallet, and swap ETH, USDC and DAI.

## Notes
- Pools are intentionally tiny (default 0.0006 ETH each) so the whole thing fits your balance. Keep swaps small
  (about 0.0001 ETH) or the price impact will be huge. Change `LIQ_ETH` in `.env.deploy` for more or less.
- USDC to DAI routes through WETH automatically (USDC > WETH > DAI).
- `faucet()` on each token (via Etherscan "Write Contract") gives 1,000 more tokens per hour.
- Recommended: put a free Alchemy/Infura Sepolia URL in `.env` as `VITE_RPC_URL` (or `RPC_URL` in `.env.deploy`).
