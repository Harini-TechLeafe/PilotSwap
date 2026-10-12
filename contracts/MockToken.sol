// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice TESTNET-ONLY ERC-20 with a public hourly faucet. NEVER deploy to mainnet.
/// Use it to create your own test USDC / DAI so you can seed a liquidity pool
/// on a Uniswap V2-style router (see contracts/README.md).
contract MockToken is ERC20, Ownable {
    uint8 private immutable _tokenDecimals;
    uint256 public constant FAUCET_UNITS = 1_000; // whole tokens per claim
    uint256 public constant FAUCET_COOLDOWN = 1 hours;
    mapping(address => uint256) public lastClaim;

    constructor(string memory name_, string memory symbol_, uint8 decimals_)
        ERC20(name_, symbol_)
        Ownable(msg.sender)
    {
        _tokenDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    /// @notice Anyone can claim FAUCET_UNITS tokens once per cooldown.
    function faucet() external {
        require(block.timestamp >= lastClaim[msg.sender] + FAUCET_COOLDOWN, "Faucet: come back later");
        lastClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_UNITS * 10 ** _tokenDecimals);
    }

    /// @notice Owner can mint larger amounts (e.g. to seed liquidity).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
