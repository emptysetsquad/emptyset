/*
    Copyright 2020, 2021 Empty Set Squad <emptysetsquad@protonmail.com>

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./lib/Decimal.sol";

/**
 * @title IToken
 * @notice Accompanies IERC20 to get decimals() which is not explicitly part of the standard
 */
interface IToken {

    /**
     * @notice Display decimals of precision for the token
     * @return token decimals
     */
    function decimals() external view returns (uint8);
}

/**
 * @title IUSDC
 * @notice Extra functions available on the USDC token aside from the standard IERC20 interface
 */
interface IUSDC {

    /**
     * @notice Checks whether `_account` has been blacklisted for USDC transfers
     * @param _account Account to check status for
     * @return Whether `_account` is blacklisted
     */
    function isBlacklisted(address _account) external view returns (bool);
}

/**
 * @title IManagedToken
 * @notice Generic interface for ERC20 tokens that can be minted and burned by their owner
 * @dev Used by Dollar and Stake in this protocol
 */
interface IManagedToken {

    /**
     * @notice Mints `amount` tokens to the {owner}
     * @param amount Amount of token to mint
     */
    function burn(uint256 amount) external;

    /**
     * @notice Burns `amount` tokens from the {owner}
     * @param amount Amount of token to burn
     */
    function mint(uint256 amount) external;
}

/**
 * @title IGovToken
 * @notice Generic interface for ERC20 tokens that have Compound-governance features
 * @dev Used by Stake and other compatible reserve-held tokens
 */
interface IGovToken {

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) external;
}

/**
 * @title IOracle
 * @notice Interface for the Uniswap V2 TWAP oracle
 */
interface IOracle {

    /**
     * @notice Setup the token for price tracking
     * @param token EC20 token to register
     */
    function setup(address token) external;

    /**
     * @notice Capture the TWAP price since last capture
     * @param token EC20 token to capture
     * @return The price decimal-normalized as a Decimal.256, seconds since last capture, and oracle health flag
     */
    function capture(address token) external returns (Decimal.D256 memory, uint256, bool);

    /**
      * @notice Whether the `token` has been setup by the owner
      * @param token EC20 token to check
      * @return token setup status
      */
    function setupFor(address token) external view returns (bool);

    /**
     * @notice The address of the USDC-`token` Uniswap V2 pair
     * @param token EC20 token to check
     * @return Uniswap V2 pair address
     */
    function pairFor(address token) external view returns (IUniswapV2Pair);
}

/**
 * @title IReserve
 * @notice Interface for the protocol reserve
 */
interface IReserve {
    /**
     * @notice The price that one ESD can currently be sold to the reserve for
     * @dev Returned as a Decimal.D256
     *      Normalizes for decimals (e.g. 1.00 USDC == Decimal.one())
     * @return Current ESD redemption price
     */
    function redeemPrice() external view returns (Decimal.D256 memory);

    /**
     * @notice Allows the stabilizer to mint `amount` ESD to itself, while incrementing reserve debt equivalently
     * @dev Increments reserve debt by `amount`
     * @param amount Amount of ESD to borrow
     */
    function borrow(uint256 amount) external;
}

interface IRegistry {
    /**
     * @notice USDC token contract
     */
    function usdc() external view returns (address);

    /**
     * @notice Compound protocol cUSDC pool
     */
    function cUsdc() external view returns (address);

    /**
     * @notice ESD stablecoin contract
     */
    function dollar() external view returns (address);

    /**
     * @notice ESDS governance token contract
     */
    function stake() external view returns (address);

    /**
     * @notice ESD reserve contract
     */
    function reserve() external view returns (address);

    /**
     * @notice ESD stabilizer contract
     */
    function stabilizer() external view returns (address);

    /**
     * @notice ESD oracle contract
     */
    function oracle() external view returns (address);

    /**
     * @notice ESD governor contract
     */
    function governor() external view returns (address);

    /**
     * @notice ESD timelock contract, owner for the protocol
     */
    function timelock() external view returns (address);

    /**
     * @notice Migration contract to bride v1 assets with current system
     */
    function migrator() external view returns (address);

    /**
     * @notice Registers a new address for USDC
     * @dev Owner only - governance hook
     * @param newValue New address to register
     */
    function setUsdc(address newValue) external;

    /**
     * @notice Registers a new address for cUSDC
     * @dev Owner only - governance hook
     * @param newValue New address to register
     */
    function setCUsdc(address newValue) external;

    /**
     * @notice Registers a new address for ESD
     * @dev Owner only - governance hook
     * @param newValue New address to register
     */
    function setDollar(address newValue) external;

    /**
     * @notice Registers a new address for ESDS
     * @dev Owner only - governance hook
     * @param newValue New address to register
     */
    function setStake(address newValue) external;

    /**
     * @notice Registers a new address for the reserve
     * @dev Owner only - governance hook
     * @param newValue New address to register
     */
    function setReserve(address newValue) external;

    /**
     * @notice Registers a new address for the stabilizer
     * @dev Owner only - governance hook
     * @param newValue New address to register
     */
    function setStabilizer(address newValue) external;

    /**
     * @notice Registers a new address for the oracle
     * @dev Owner only - governance hook
     * @param newValue New address to register
     */
    function setOracle(address newValue) external;

    /**
     * @notice Registers a new address for the governor
     * @dev Owner only - governance hook
     * @param newValue New address to register
     */
    function setGovernor(address newValue) external;

    /**
     * @notice Registers a new address for the timelock
     * @dev Owner only - governance hook
     *      Does not automatically update the owner of all owned protocol contracts
     * @param newValue New address to register
     */
    function setTimelock(address newValue) external;

    /**
     * @notice Registers a new address for the v1 migration contract
     * @dev Owner only - governance hook
     * @param newValue New address to register
     */
    function setMigrator(address newValue) external;
}