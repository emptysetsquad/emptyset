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

import "../ReserveState.sol";

/**
 * @title ReserveStabilizerTypes
 * @notice Contains Stabilizer-specific reserve state structs
 */
contract ReserveStabilizerTypes {

    /**
     * @notice Stores state related to borrowing
     */
    struct Borrower {
        /**
         * @notice Current amount of reserve debt for stabilizer borrowing
         */
        uint256 debt;

        /**
         * @notice Current borrow controller state
         */
        BorrowController controller;
    }

    /**
     * @notice Stores state related to the borrow controller
     */
    struct BorrowController {
        /**
         * @notice Amount borrowed during the current rate-limiting window
         */
        uint256 borrowed;

        /**
         * @notice Last timestamp the rate-limiting window was updated
         */
        uint256 last;
    }

    /**
     * @notice Stores state for the entire reserve
     */
    struct State {
        /**
         * @notice Current redemption tax for artificially lowering the {redeemPrice}
         */
        Decimal.D256 redemptionTax;

        /**
         * @notice Stores state related to borrowing
         */
        ReserveStabilizerTypes.Borrower borrower;
    }
}

/**
 * @title ReserveStabilizerState
 * @notice Stabilizer-specific Reserve state
 */
contract ReserveStabilizerState {

    /**
     * @notice Entirety of the reserve contract state
     * @dev To upgrade state, append additional state variables at the end of this contract
     */
    ReserveStabilizerTypes.State internal _sState;
}

/**
 * @title ReserveAdmin
 * @notice Reserve admin state accessor helpers
 */
contract ReserveStabilizerAdmin is Implementation, ReserveStabilizerState {
    using Decimal for Decimal.D256;

    /**
     * @notice Cap redemption tax at 100% to avoid math errors
     */
    uint256 private constant REDEMPTION_TAX_CAP = 1e18;

    /**
     * @notice Emitted when {redemptionTax} is updated with `newRedemptionTax`
     */
    event RedemptionTaxUpdate(uint256 newRedemptionTax);

    // COMPTROLLER

    /**
     * @notice Current redemption tax for artificially lowering the {redeemPrice}
     * @return Reserve debt
     */
    function redemptionTax() public view returns (Decimal.D256 memory) {
        return _sState.redemptionTax;
    }

    /**
     * @notice Sets the redemption tax to `newRedemptionTax`
     * @dev Owner only - governance hook
     * @param newRedemptionTax New redemption tax
     */
    function setRedemptionTax(uint256 newRedemptionTax) external onlyOwner {
        require(newRedemptionTax <= REDEMPTION_TAX_CAP, "ReserveAdmin: too large");

        _sState.redemptionTax = Decimal.D256({value: newRedemptionTax});

        emit RedemptionTaxUpdate(newRedemptionTax);
    }
}

/**
 * @title ReserveStabilizerAccessors
 * @notice Stabilizer-specific Reserve state accessor helpers
 */
contract ReserveStabilizerAccessors is ReserveStabilizerAdmin {
    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    // COMPTROLLER

    /**
     * @notice Current reserve debt accrued from stabilizer borrowing
     * @return Reserve debt
     */
    function debt() public view returns (uint256) {
        return _sState.borrower.debt;
    }

    /**
     * @notice Increments the reserve debt by `amount`
     * @dev Internal only
     * @param amount Amount to increment debt in ESD
     */
    function _incrementDebt(uint256 amount) internal {
        _sState.borrower.debt = _sState.borrower.debt.add(amount);
    }

    /**
     * @notice Decrements the reserve debt by `amount`
     * @dev Internal only
            Reverts when insufficient debt with reason `reason`
     * @param amount Amount to decrement debt in ESD
     * @param reason Revert reason
     */
    function _decrementDebt(uint256 amount, string memory reason) internal {
        _sState.borrower.debt = _sState.borrower.debt.sub(amount, reason);
    }

    /**
     * @notice Current borrow controller state for rate-limiting borrowing
     * @dev Internal only
     * @return Borrow controller
     */
    function _borrowController() internal view returns (ReserveStabilizerTypes.BorrowController memory) {
        return _sState.borrower.controller;
    }

    /**
     * @notice Updates the borrow controller state
     * @dev Internal only
     * @param newBorrowed Newly calculated borrow amount for the current window
     * @param newLast Timestamp of update
     */
    function _updateBorrowController(uint256 newBorrowed, uint256 newLast) internal {
        _sState.borrower.controller.borrowed = newBorrowed;
        _sState.borrower.controller.last = newLast;
    }
}