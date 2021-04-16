/*
    Copyright 2021 Empty Set Squad <emptysetsquad@protonmail.com>

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

import "../../src/lib/Decimal.sol";
import "../../src/StabilizerInterfaces.sol";

contract MockSettableOracle is IOracle {
    Decimal.D256 internal _price;
    uint256 internal _elapsed;
    bool internal _valid;
    uint256 internal _lastReserve;
    uint256 internal _reserve;
    bool internal _setup;

    function set(uint256 price, uint256 elapsed, bool valid) external {
        _price = Decimal.D256({value: price});
        _elapsed = elapsed;
        _valid = valid;
    }

    function setup(address token) public {
        _setup = true;
    }

    function capture(address token) public returns (Decimal.D256 memory, uint256, bool) {
        return (_price, _elapsed, _valid);
    }

    function setupFor(address token) external view returns (bool) {
        return _setup;
    }

    function pairFor(address token) external view returns (IUniswapV2Pair) { revert("Should not use"); }
}
