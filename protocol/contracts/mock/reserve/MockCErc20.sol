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

contract MockCErc20 is ICErc20 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public exchangeRateStored;
    IComptroller public comptroller_;
    mapping(address => uint256) public balanceOf;

    IERC20 private underlyingToken;
    uint256 private statusCode;

    function set(IERC20 _underlyingToken, IComptroller _comptroller) external {
        underlyingToken = _underlyingToken;
        comptroller_ = _comptroller;
    }

    function setExchangeRate(uint256 _exchangeRate) external {
        exchangeRateStored = _exchangeRate;
    }

    function setStatusCode(uint256 _statusCode) external {
        statusCode = _statusCode;
    }

    function comptroller() public view returns (IComptroller) {
        return comptroller_;
    }

    function mint(uint mintAmount) external returns (uint256) {
        underlyingToken.safeTransferFrom(msg.sender, address(this), mintAmount);
        balanceOf[msg.sender] = balanceOf[msg.sender].add(mintAmount.mul(1e18).div(exchangeRateStored, "CToken: exchange rate 0"));

        return statusCode;
    }

    function redeemUnderlying(uint redeemAmount) external returns (uint256) {
        underlyingToken.transfer(msg.sender, redeemAmount);
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(redeemAmount.mul(1e18).div(exchangeRateStored), "CToken: insufficient balance");

        return statusCode;
    }
}
