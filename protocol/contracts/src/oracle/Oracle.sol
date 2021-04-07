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

import "@openzeppelin/contracts/ownership/Ownable.sol";
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '../lib/UniswapV2OracleLibrary.sol';
import '../lib/UniswapV2Library.sol';
import "../lib/Decimal.sol";
import "../Interfaces.sol";

/**
 * @title Oracle
 * @notice Generic ownable USDC-based Uniswap V2 TWAP oracle
 * @dev Tracks the USDC price for any registered ERC20 token
 *      The owner may capture TWAP updates at any interval
 */
contract Oracle is IOracle, Ownable {
    using Decimal for Decimal.D256;

    /**
     * @notice Uniswap V2 factory address
     */
    address private constant UNISWAP_FACTORY = address(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);

    /**
     * @notice Minimum USDC liquidity for a pool to be considered healthy
     */
    uint256 private constant ORACLE_RESERVE_MINIMUM = 1e10; // 10,000 USDC

    /**
     * @notice State for a single ERC20 token's TWAP oracle
     */
    struct Market {

        /**
         * @notice ERC20 token that is being tracked
         */
        address token;

        /**
         * @notice Corresponding Uniswap V2 USDC-token pair
         */
        IUniswapV2Pair pair;

        /**
         * @notice Index of token in the pair: 0, token == token0; 1, token == token1
         */
        uint256 index;

        /**
         * @notice Has this market been initialized
         */
        bool initialized;

        /**
         * @notice The last recorded cumulative price counter
         */
        uint256 cumulative;

        /**
         * @notice The timestamp of the last recorded cumulative price counter
         */
        uint32 timestamp;
    }

    /**
     * @notice Address of the USDC token
     */
    address public usdc;

    /**
     * @notice Mapping of all registered markets
     */
    mapping(address => Market) internal _markets;

    /**
     * @notice Construct the oracle contract
     * @param usdc_ Address of the USDC token
     */
    constructor(address usdc_) public {
        usdc = usdc_;
    }

    /**
     * @notice Setup the token for price tracking
     * @dev Owner only
     *      Must be called before capture will return a healthy state for the token
     * @param token EC20 token to register
     */
    function setup(address token) public onlyOwner {
        _markets[token].token = token;
        _markets[token].pair = _createOrGetPair(token);

        IUniswapV2Pair pair = pairFor(token);
        (address token0, address token1) = (pair.token0(), pair.token1());
        _markets[token].index = token == token0 ? 0 : 1;

        require(token == token0 || token == token1, "Oracle: token not found");
        require(usdc == token0 || usdc == token1, "Oracle: USDC not found");
        require(token0 != token1, "Oracle: token is USDC");
    }

    /**
     * @notice Capture the TWAP price since last capture
     * @dev Owner only
     *
     *      Can be called at any cadence by the owner, returns the elapsed seconds since last call
     *      for further computation by the consumer
     *
     *      Trades/Liquidity: (1) Initializes reserve and blockTimestampLast (can calculate a price)
     *                        (2) Has non-zero cumulative prices
     *
     *      Steps: (1) Captures a reference blockTimestampLast
     *             (2) First reported value
     *
     * @param token EC20 token to capture
     * @return The price decimal-normalized as a Decimal.256, seconds since last capture, and oracle health flag
     */
    function capture(address token) public onlyOwner returns (Decimal.D256 memory, uint256, bool) {

        // The owner has not yet setup this market
        if (!setupFor(token)) {
            return (Decimal.one(), 0, false);
        }

        // This is the first capture call for the market, initialize
        if (!initializedFor(token)) {
            _initializeOracle(token);
            return (Decimal.one(), 0, false);
        }

        // Market is setup and initialized, proceed as normal
        return _updateOracle(token);
    }

    /**
     * @notice Capture the initial window and initial state for the specific market
     * @dev Internal only - helper
     *      Is called on the first capture for each market
     * @param token EC20 token to initialize
     */
    function _initializeOracle(address token) private {
        IUniswapV2Pair pair = pairFor(token);
        uint256 priceCumulative = _choose(token, pair.price0CumulativeLast(), pair.price1CumulativeLast());
        (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) = pair.getReserves();
        if(reserve0 != 0 && reserve1 != 0 && blockTimestampLast != 0) {
            _updateMarket(token, priceCumulative, blockTimestampLast);
            _markets[token].initialized = true;
        }
    }

    /**
    /**
     * @notice Captures TWAP data then checks the health of the oracle
     * @dev Internal only - helper
     * @param token EC20 token to capture
     * @return The price decimal-normalized as a Decimal.256, seconds since last capture, and oracle health flag
     */
    function _updateOracle(address token) private returns (Decimal.D256 memory price, uint256 elapsed, bool valid) {
        (price, elapsed) = _updatePrice(token);
        bool isBlacklisted = IUSDC(usdc).isBlacklisted(address(pairFor(token)));
        valid = !isBlacklisted && (_liquidity(token) >= ORACLE_RESERVE_MINIMUM);
    }

    /**
     * @notice Captures oracle data from Uniswap V2, computes and stores the new TWAP oracle state
     * @dev Internal only - helper
     *      If no time has passed, returns a default 1.00 price
     * @param token EC20 token to capture
     * @return The price decimal-normalized as a Decimal.256, seconds since last capture
     */
    function _updatePrice(address token) private returns (Decimal.D256 memory, uint256) {
        (uint256 price0Cumulative, uint256 price1Cumulative, uint32 blockTimestamp) =
            UniswapV2OracleLibrary.currentCumulativePrices(address(pairFor(token)));
        uint32 timeElapsed = blockTimestamp - timestampFor(token); // overflow is desired
        if (timeElapsed == 0) return (Decimal.one(), 0);

        uint256 priceCumulative = _choose(token, price0Cumulative, price1Cumulative);
        Decimal.D256 memory price = Decimal.ratio((priceCumulative - cumulativeFor(token)) / timeElapsed, 2**112);

        _updateMarket(token, priceCumulative, blockTimestamp);

        return (_normalize(token, price), uint256(timeElapsed));
    }

    // GETTERS

    /**
     * @notice Whether the `token` has been setup by the owner
     * @param token EC20 token to check
     * @return token setup status
     */
    function setupFor(address token) public view returns (bool) {
        return _markets[token].token != address(0);
    }

    /**
     * @notice Whether the market for `token` has been initialized
     * @param token EC20 token to check
     * @return token initialization status
     */
    function initializedFor(address token) public view returns (bool) {
        return _markets[token].initialized;
    }

    /**
     * @notice The cumulative price counter for the `token` market
     * @param token EC20 token to check
     * @return Cumulative price counter
     */
    function cumulativeFor(address token) public view returns (uint256) {
        return _markets[token].cumulative;
    }

    /**
     * @notice The last timestamp cumulative price counter was updated for the `token` market
     * @param token EC20 token to check
     * @return Last update timestamp
     */
    function timestampFor(address token) public view returns (uint32) {
        return _markets[token].timestamp;
    }

    /**
     * @notice The address of the USDC-`token` Uniswap V2 pair
     * @param token EC20 token to check
     * @return Uniswap V2 pair address
     */
    function pairFor(address token) public view returns (IUniswapV2Pair) {
        return _markets[token].pair;
    }

    // INTERNAL

    /**
     * @notice Creates the USDC-`token` Uniswap V2 if it does not already exist
     * @dev Internal only - helper
     * @param token EC20 token to create for
     * @return The existing or new pair address
     */
    function _createOrGetPair(address token) internal returns (IUniswapV2Pair) {
        address pair = IUniswapV2Factory(UNISWAP_FACTORY).getPair(usdc, token);
        if (pair == address(0)) {
            return IUniswapV2Pair(IUniswapV2Factory(UNISWAP_FACTORY).createPair(usdc, token));
        }
        return IUniswapV2Pair(pair);
    }

    /**
     * @notice Stores the new `cumulative` and `timestamp` state for the `token` market
     * @dev Internal only
     * @param token EC20 token to update
     * @param cumulative New cumulative price counter value
     * @param timestamp New latest updated timestamp value
     */
    function _updateMarket(address token, uint256 cumulative, uint32 timestamp) private {
        _markets[token].timestamp = timestamp;
        _markets[token].cumulative = cumulative;
    }

    /**
     * @notice Normalizes `price` for the difference in decimals between USDC and `token`
     * @dev Internal only - helper
     * @param token EC20 token for the price that is being normalized
     * @param price Decimal.D256 price to normalize
     * @return normalized Decimal.D256 price
     */
    function _normalize(address token, Decimal.D256 memory price) private view returns (Decimal.D256 memory) {
        uint8 decimals = IToken(token).decimals();
        if (decimals > 6) {
            return price.mul(10 ** (uint256(decimals) - 6));
        } else if (decimals < 6) {
            return price.div(10 ** (6 - uint256(decimals)));
        }
        return price;
    }

    /**
     * @notice Retrieve the total amount of USDC liquidity currently in the `token` market
     * @dev Internal only - helper
     * @param token EC20 token to retrieve liquidity for
     * @return total USDC supplied to USDC-`token` market
     */
    function _liquidity(address token) private view returns (uint256) {
        (uint112 reserve0, uint112 reserve1,) = _markets[token].pair.getReserves();
        return _choose(token, uint256(reserve1), uint256(reserve0)); // get counter's reserve
    }

    /**
     * @notice Choose between two values based on the index of the `token` market
     * @dev Internal only - helper
     * @param token EC20 token to choose for
     * @param index0Value Value if market index is 0
     * @param index1Value Value if market index is 1
     * @return index == 0, index0Value; index == 1, index1Value
     */
    function _choose(address token, uint256 index0Value, uint256 index1Value) private view returns (uint256) {
        return _markets[token].index == 0 ? index0Value : index1Value;
    }
}