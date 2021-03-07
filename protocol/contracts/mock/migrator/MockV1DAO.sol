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
import "../../src/migrator/Migrator.sol";

contract MockV1DAO is IDAO {
    using SafeMath for uint256;

    uint256 public totalSupply;
    uint256 public totalCouponUnderlying;
    mapping(address => uint256) public balanceOf;

    function set(uint256 newTotalCouponUnderlying) external {
        totalCouponUnderlying = newTotalCouponUnderlying;
    }

    function addUserBalance(address account, uint256 balance) external {
        balanceOf[account] = balanceOf[account].add(balance);
        totalSupply = totalSupply.add(balance);
    }

    // @notice Burns the account's ESDS balance, callable by Migrator only
    function burn(address account, uint256 amount) external {
        balanceOf[account] = balanceOf[account].sub(amount, "MockV1DAO: insufficient balance");
        totalSupply = totalSupply.sub(amount, "MockV1DAO: insufficient supply");
    }
}
