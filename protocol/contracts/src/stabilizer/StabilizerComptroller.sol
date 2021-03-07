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

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../Interfaces.sol";
import "../lib/Decimal.sol";
import "../lib/TimeUtils.sol";
import "./StabilizerState.sol";
import "./StabilizerToken.sol";

/**
 * @title StabilizerComptroller
 * @notice Stabilizer core accounting logic supplying, redeeming, and managing ESD.
 * @dev Any ESD that is airdropped into the stabilizer will be automatically become part of the pool
 */
contract StabilizerComptroller is StabilizerAccessors, StabilizerToken {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /**
     * @notice Emitted when `account` supplies `amount` ESD to the stabilizer for `mintAmount` sESD
     */
    event Supply(address indexed account, uint256 amount, uint256 mintAmount);

    /**
     * @notice Emitted when `account` redeems `amount` ESD from the stabilizer for `burnAmount` sESD
     */
    event Redeem(address indexed account, uint256 amount, uint256 burnAmount);

    /**
     * @notice Emitted every time the stabilizer borrows `amount` ESD from the reserve to accrue rewards
     */
    event Settle(uint256 amount);

    // EXTERNAL

    /**
     * @notice The total amount of ESD held by the stabilizer
     * @return Total ESD holdings
     */
    function totalUnderlying() public view returns (uint256) {
        return IERC20(registry().dollar()).balanceOf(address(this));
    }

    /**
     * @notice The ESD balance for `account`
     * @param account Account to retrieve balance information for
     * @return ESD balance
     */
    function balanceOfUnderlying(address account) public view returns (uint256) {
        return balanceOf(account).mul(totalUnderlying()).div(totalSupply());
    }

    /**
     * @notice Deposits ESD into the stabilizer in exchange for sESD reward-accruing tokens
     * @param amount Amount of ESD to supply
     */
    function supply(uint256 amount) external {
        _settle();

        uint256 mintAmount = totalUnderlying() == 0 ? amount : amount.mul(totalSupply()).div(totalUnderlying());

        _supply(msg.sender, amount, mintAmount);
    }

    /**
     * @notice Withdraws ESD from the stabilizer in exchange for sESD reward-accruing tokens
     * @param amount Amount of sESD to redeem
     */
    function redeem(uint256 amount) external {
        _settle();

        uint256 redeemAmount = amount.mul(totalUnderlying()).div(totalSupply(), "StabilizerComptroller: no supply");

        _redeem(msg.sender, redeemAmount, amount);
    }

    /**
     * @notice Withdraws ESD from the stabilizer in exchange for sESD reward-accruing tokens
     * @param amount Amount of ESD to redeem
     */
    function redeemUnderlying(uint256 amount) external {
        _settle();

        uint256 burnAmount = amount.mul(totalSupply()).div(totalUnderlying(), "StabilizerComptroller: no underlying");

        _redeem(msg.sender, amount, burnAmount);
    }

    // FLYWHEEL

    /**
     * @notice The stabilizer's current effective reward rate
     * @dev In terms of % of the totalUnderlying per day
     *      Uses EMA floored at the current reserve redemption price and maxed at 1.00
     * @return Current effective reward rate
     */
    function setup() external onlyOwner {
        IOracle oracle = IOracle(registry().oracle());
        address dollar = registry().dollar();

        require(!oracle.setupFor(dollar), "StabilizerComptroller: already setup");

        oracle.setup(dollar);
        _state.oracle.ema = Decimal.one();
    }

    /**
     * @notice The stabilizer's current effective reward rate
     * @dev In terms of % of the totalUnderlying per day
     *      Uses EMA floored at the current reserve redemption price and maxed at 1.00
     * @return Current effective reward rate
     */
    function rate() public view returns (Decimal.D256 memory) {
        Decimal.D256 memory emaMin = IReserve(registry().reserve()).redeemPrice();
        Decimal.D256 memory emaMax = Decimal.one();
        Decimal.D256 memory ema = ema();
        Decimal.D256 memory emaLimited = Decimal.min(Decimal.max(ema, emaMin), emaMax);

        return Decimal.one().sub(emaLimited).mul(rewardRate());
    }

    /**
     * @notice Core flywheel which captures the oracle TWAP, updates the EMA, and borrows the corresponding amount
     * @dev EMA_1 = (alpha * price) + ((1 - alpha) * EMA_0)
     *      alpha = decayRate * elapsedDays, maxed out at maxAlpha()
     *      If oracle becomes unhealthy immediately set EMA to 1
     *
     *      Borrows rate() * elapsedDays * totalUnderlying() ESD from the stabilizer
     *      Uses rate() before EMA update to prevent same-block price manipulation
     */
    function _settle() internal {

        // Get current oracle snapshot
        (Decimal.D256 memory price, uint256 elapsed, bool healthy) =
            IOracle(registry().oracle()).capture(registry().dollar());
        Decimal.D256 memory elapsedDays = TimeUtils.secondsToDays(elapsed);

        // Borrow ESD per prior rate
        uint256 borrowAmount = rate().mul(elapsedDays).mul(totalUnderlying()).asUint256();
        if (borrowAmount != 0) IReserve(registry().reserve()).borrow(borrowAmount);

        // Update EMA
        if (healthy) {
            Decimal.D256 memory alpha = Decimal.min(decayRate().mul(elapsedDays), maxAlpha());
            _updateEma(alpha.mul(price).add(Decimal.one().sub(alpha).mul(ema())));
        } else {
            _updateEma(Decimal.one());
        }

        emit Settle(borrowAmount);
    }

    // INTERNAL

    /**
     * @notice Deposits ESD into the stabilizer in exchange for sESD reward-accruing tokens
     * @dev Internal only - generic helper
     * @param account Account that is supplying
     * @param supplyAmount ESD amount to supply
     * @param mintAmount sESD amount to mint
     */
    function _supply(address account, uint256 supplyAmount, uint256 mintAmount) internal {
        IERC20(registry().dollar()).safeTransferFrom(account, address(this), supplyAmount);
        _mint(msg.sender, mintAmount);

        emit Supply(account, supplyAmount, mintAmount);
    }

    /**
     * @notice Deposits ESD into the stabilizer in exchange for sESD reward-accruing tokens
     * @dev Internal only - generic helper
     * @param account Account that is redeeming
     * @param redeemAmount ESD amount to redeem
     * @param burnAmount sESD amount to burn
     */
    function _redeem(address account, uint256 redeemAmount, uint256 burnAmount) internal {
        _burn(msg.sender, burnAmount);
        IERC20(registry().dollar()).safeTransfer(msg.sender, redeemAmount);

        emit Redeem(account, redeemAmount, burnAmount);
    }
}