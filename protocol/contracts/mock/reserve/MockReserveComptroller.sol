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

import "../../src/reserve/ReserveComptroller.sol";
import "./MockReserveState.sol";

contract MockReserveComptroller is ReserveComptroller, MockReserveState {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    function mintToE(address account, uint256 amount) external {
        address dollar = registry().dollar();
        IManagedToken(dollar).mint(amount);
        IERC20(dollar).safeTransfer(account, amount);
    }
}
