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

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../../src/reserve/ReserveVault.sol";

contract MockCComptroller is IComptroller {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 private comp;

    function set(IERC20 _comp) external {
        comp = _comp;
    }

    function claimComp(address holder) public {
        comp.safeTransfer(holder, comp.balanceOf(address(this)));
    }
}
