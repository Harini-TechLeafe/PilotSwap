// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice TESTNET-ONLY "Tether USD" (USDT) with a public hourly faucet. NEVER deploy to a mainnet:
/// the mainnets use the real USDT contract (already built into PilotSwap's defaults).
///
/// Deploy with Remix on Sepolia or BNB Smart Chain Testnet:
///   constructor argument `decimals_`  →  6  on Ethereum Sepolia   (same as real USDT on Ethereum)
///                                        18 on BNB Smart Chain Testnet (same as BEP-20 USDT)
/// Then put the deployed address in .env:
///   VITE_SEPOLIA_USDT_ADDRESS=0x...        (Sepolia)
///   VITE_BSC_TESTNET_USDT_ADDRESS=0x...    (BNB Testnet)
contract MockUSDT is ERC20, Ownable {
    uint8 private immutable _tokenDecimals;
    uint256 public constant FAUCET_UNITS = 1_000; // whole USDT per claim
    uint256 public constant FAUCET_COOLDOWN = 1 hours;
    mapping(address => uint256) public lastClaim;

    constructor(uint8 decimals_) ERC20("Tether USD", "USDT") Ownable(msg.sender) {
        _tokenDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    /// @notice Anyone can claim FAUCET_UNITS USDT once per cooldown (call it from the explorer or Remix).
    function faucet() external {
        require(block.timestamp >= lastClaim[msg.sender] + FAUCET_COOLDOWN, "Faucet: come back later");
        lastClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_UNITS * 10 ** _tokenDecimals);
    }

    /// @notice Owner can mint larger amounts (e.g. to seed a liquidity pool).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
