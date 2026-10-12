# Testnet liquidity setup (required for swaps to work)

PilotSwap **does not deploy a DEX**. It talks to an existing **Uniswap V2-style Router02**.
A swap can only succeed if (1) the router exists on your testnet, and (2) a liquidity pool
exists for the pair you want to trade. Public testnets often have empty or tiny pools,
so you will probably want to create your own.

## Architecture

```
PilotSwap UI ──(viem)──► Router02 ──► Factory ──► Pair (pool) contracts ──► your ERC-20s
   │ reads: getAmountsOut, allowance, balanceOf
   └ writes (via MetaMask): approve, swapExact*
```

## Step 1: Find a verified router
Look up the **official V2 deployments page** in the Uniswap docs
(docs.uniswap.org → Contracts → V2 → Deployment addresses) for your testnet and copy
`UniswapV2Router02`. Open it on the block explorer and confirm that it is a contract.
If your testnet is not listed, deploy the official V2 contracts yourself, or use a V2 fork
that has an official deployment there. Call `router.WETH()` on the explorer to get
the matching WETH9 address.

## Step 2: Create your own test tokens (optional but recommended)
1. Open https://remix.ethereum.org, create `MockToken.sol`, paste `contracts/MockToken.sol`.
2. Compile (0.8.20+). Remix resolves the OpenZeppelin imports automatically.
3. In *Deploy & Run*, set the environment to *Injected Provider – MetaMask* (on your testnet).
4. Deploy twice: `("USD Coin","USDC",6)` and `("Dai Stablecoin","DAI",18)`.
5. Copy both addresses into `.env` as `VITE_USDC_ADDRESS` / `VITE_DAI_ADDRESS`.
6. Call `faucet()` on each token to give your wallet 1,000 tokens (repeat hourly), or `mint` as owner.

## Step 3: Create a pool (add liquidity)
On the router (use Remix "At Address" with a Router02 ABI, or the explorer's *Write Contract* tab):

1. On the token: `approve(router, amount)`.
2. For an ETH/USDC pool: `addLiquidityETH(token, amountTokenDesired, amountTokenMin, amountETHMin, to=yourWallet, deadline)`
   and send some testnet ETH as the call's *value*.
   For a token/token pool: `addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline)`.
3. The first deposit sets the price. Example: 0.1 ETH + 300 USDC makes 1 ETH ≈ 3,000 USDC.
   (Choose any price you like; it's a testnet.)

PilotSwap finds direct pools and also routes **token → WETH → token**, so pools paired with WETH/ETH are enough.

## Safety notes
* `MockToken` has an open faucet and an owner mint. It is for testnets only.
* Never use a mainnet wallet's keys with test tooling. Use a dedicated test account in MetaMask.
