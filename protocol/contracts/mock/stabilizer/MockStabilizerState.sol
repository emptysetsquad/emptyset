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

import "../../src/stabilizer/StabilizerState.sol";

contract MockStabilizerState is StabilizerAccessors {

    // TOKEN

    function transferBalanceE(address sender, address recipient, uint256 amount, string calldata reason) external {
        super._transferBalance(sender, recipient, amount, reason);
    }

    function incrementBalanceE(address account, uint256 amount) external {
        super._incrementBalance(account, amount);
    }

    function decrementBalanceE(address account, uint256 amount, string calldata reason) external {
        super._decrementBalance(account, amount, reason);
    }

    function updateAllowanceE(address owner, address spender, uint256 amount) external {
        super._updateAllowance(owner, spender, amount);
    }

    // COMPTROLLER

    function updateEmaE(uint256 newEma) external {
        super._updateEma(Decimal.D256({value: newEma}));
    }

    // IMPLEMENTATION

    function setRegistryE(address implementation) external {
        super._setRegistry(implementation);
    }

    function setOwnerE(address newOwner) external {
        super._setOwner(newOwner);
    }
}
