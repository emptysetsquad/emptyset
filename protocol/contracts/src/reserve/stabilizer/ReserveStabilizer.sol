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

import "../ReserveComptroller.sol";
import "./ReserveStabilizerState.sol";
import "../../registry/stabilizer/RegistryStabilizer.sol";

/**
 * @title ReserveComptroller
 * @notice Reserve accounting logic for managing the ESD stablecoin.
 */
contract ReserveStabilizer is ReserveStabilizerAccessors, ReserveComptroller {
    using SafeMath for uint256;
    using Decimal for Decimal.D256;
    using SafeERC20 for IERC20;

    /**
     * @notice Emitted when the stabilizer borrows `amount` ESD from the reserve
     */
    event Borrow(uint256 amount);

    /**
     * @notice Emitted when `account` settles `settleAmount` ESD of the reserve's debt for `costAmount` USDC
     */
    event Settle(address indexed account, uint256 settleAmount, uint256 proceedAmount);

    /**
     * @notice Per-day borrow limit expressed as a percentage of total supply
     * @dev Represents limit * 10^18
     */
    uint256 private constant DAILY_BORROW_LIMIT = 0.002e18; // 107% APY

    // EXTERNAL

    /**
     * @notice Allows the stabilizer to mint `amount` ESD to itself, while incrementing reserve debt equivalently
     * @dev Non-reentrant
     *      Only callable by the stabilizer
     *      Increments reserve debt by `amount`
     * @param amount Amount of ESD to borrow
     */
    function borrow(uint256 amount) external nonReentrant {
        require(msg.sender == RegistryStabilizer(address(registry())).stabilizer(), "ReserveComptroller: not stabilizer");

        _syncBorrowed(amount);
        _incrementDebt(amount);

        _mintDollar(RegistryStabilizer(address(registry())).stabilizer(), amount);

        emit Borrow(amount);
    }

    /**
     * @notice Burns `amount` ESD from the caller in exchange for equivalent amount of USDC
     * @dev Non-reentrant
     *      Normalizes for decimals
     *      Offsets `amount` of the reserve debt from borrowing
     *      Not available if there's insufficient debt
     * @param amount Amount of ESD to burn
     */
    function settle(uint256 amount) external nonReentrant {
        _decrementDebt(amount, "ReserveComptroller: insufficient debt");

        uint256 proceedAmount = _toUsdcAmount(amount);

        _transferFrom(registry().dollar(), msg.sender, address(this), amount);
        _burnDollar(amount);
        _redeemVault(proceedAmount);
        _transfer(registry().usdc(), msg.sender, proceedAmount);

        emit Settle(msg.sender, amount, proceedAmount);
    }

    // INTERNAL

    /**
     * @notice Updates the borrow controller for a new borrow
     * @dev Private only
     *      Manages a sliding-window rate-limiter with a per-day borrow limit of {DAILY_BORROW_LIMIT},
     *      measured as a percentage of total ESD supply
     *      Reverts if borrow exceeds limit
     * @param borrowAmount New borrow amount in ESD
     */
    function _syncBorrowed(uint256 borrowAmount) private {
        ReserveStabilizerTypes.BorrowController memory controller = _borrowController();
        uint256 totalSupply = _totalSupply(registry().dollar());
        uint256 dailyBorrowLimit = Decimal.D256({value: DAILY_BORROW_LIMIT}).mul(totalSupply).asUint256();

        // Free
        uint256 freed = TimeUtils.secondsToDays(now.sub(controller.last)).mul(dailyBorrowLimit).asUint256();
        uint256 newBorrowed = controller.borrowed > freed ? controller.borrowed.sub(freed) : 0;

        // Delta
        newBorrowed = newBorrowed.add(borrowAmount);

        // Commit
        _updateBorrowController(newBorrowed, now);

        // Limit
        require(_borrowController().borrowed <= dailyBorrowLimit, "ReserveComptroller: insufficient borrowable");
    }
}