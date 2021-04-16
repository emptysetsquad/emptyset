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
