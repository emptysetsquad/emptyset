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

import "../../src/reserve/ReserveState.sol";

contract MockReserveState is ReserveAccessors {

    // SWAPPER

    function updateOrderE(address makerToken, address takerToken, uint256 price, uint256 amount) external {
        super._updateOrder(makerToken, takerToken, price, amount);
    }

    function decrementOrderAmountE(address makerToken, address takerToken, uint256 amount, string calldata reason) external {
        super._decrementOrderAmount(makerToken, takerToken, amount, reason);
    }

    // COMPTROLLER

    function incrementDebtE(address borrower, uint256 amount) external {
        super._incrementDebt(borrower, amount);
    }

    function decrementDebtE(address borrower, uint256 amount, string calldata reason) external {
        super._decrementDebt(borrower, amount, reason);
    }

    // IMPLEMENTATION

    function setRegistryE(address implementation) external {
        super._setRegistry(implementation);
    }

    function setOwnerE(address newOwner) external {
        super._setOwner(newOwner);
    }
}
