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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../../src/lib/Decimal.sol";
import "../../src/Interfaces.sol";

contract MockSettableReserve is IReserve {
    using SafeERC20 for IERC20;

    Decimal.D256 internal _redeemPrice;
    address internal _dollar;
    bool internal _borrowable;

    function mintToE(address account, uint256 amount) external {
        IManagedToken(_dollar).mint(amount);
        IERC20(_dollar).safeTransfer(account, amount);
    }

    function setDollar(address dollar) external {
        _dollar = dollar;
    }

    function setRedeemPrice(uint256 redeemPrice) external {
        _redeemPrice = Decimal.D256({value: redeemPrice});
    }

    function redeemPrice() external view returns (Decimal.D256 memory) {
        return _redeemPrice;
    }

    function setBorrowable(bool borrowable) external {
        _borrowable = borrowable;
    }

    function borrow(uint256 amount) external {
        require(_borrowable, "MockSettableOracle: failure");
        IManagedToken(_dollar).mint(amount);
        IERC20(_dollar).safeTransfer(msg.sender, amount);
    }
}
