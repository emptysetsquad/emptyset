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

import "../../../src/reserve/stabilizer/ReserveStabilizerState.sol";
import "../../../src/reserve/stabilizer/ReserveStabilizer.sol";

contract MockReserveStabilizerState is ReserveStabilizerAccessors {
    address private _owner;
    address private _registry;

    function incrementDebtE(uint256 amount) external {
        super._incrementDebt(amount);
    }

    function decrementDebtE(uint256 amount, string calldata reason) external {
        super._decrementDebt(amount, reason);
    }

    function borrowControllerE() external view returns (ReserveStabilizerTypes.BorrowController memory) {
        return super._borrowController();
    }

    function updateBorrowControllerE(uint256 newBorrowed, uint256 newLast) external {
        super._updateBorrowController(newBorrowed, newLast);
    }

    // IMPLEMENTATION

    function owner() public view returns (address) {
        return _owner;
    }

    function registry() public view returns (IRegistry) {
        return IRegistry(_registry);
    }

    function _setRegistry(address newRegistry) internal {
        _registry = newRegistry;
    }

    function _setOwner(address newOwner) internal {
        _owner = newOwner;
    }
}
