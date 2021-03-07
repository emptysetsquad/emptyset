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

import "../lib/Decimal.sol";
import "../common/Implementation.sol";

/**
 * @title ReserveTypes
 * @notice Contains all reserve state structs
 */
contract ReserveTypes {

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
     * @notice Stores state for a single order
     */
    struct Order {
        /**
         * @notice price (takerAmount per makerAmount) for the order as a Decimal
         */
        Decimal.D256 price;

        /**
         * @notice total available amount of the maker token
         */
        uint256 amount;
    }

    /**
     * @notice Stores state for the entire reserve
     */
    struct State {
        /**
         * @notice Common state for upgradeable, ownable, implementation contracts
         */
        IImplementation.ImplementationState implementation;

        /**
         * @notice Current redemption tax for artificially lowering the {redeemPrice}
         */
        Decimal.D256 redemptionTax;

        /**
         * @notice Stores state related to borrowing
         */
        ReserveTypes.Borrower borrower;

        /**
         * @notice Mapping of all registered limit orders
         */
        mapping(address => mapping(address => ReserveTypes.Order)) orders;
    }
}

/**
 * @title ReserveState
 * @notice Reserve state
 */
contract ReserveState {

    /**
     * @notice Entirety of the reserve contract state
     * @dev To upgrade state, append additional state variables at the end of this contract
     */
    ReserveTypes.State internal _state;
}

/**
 * @title ReserveAdmin
 * @notice Reserve admin state accessor helpers
 */
contract ReserveAdmin is Implementation, ReserveState {

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
        return _state.redemptionTax;
    }

    /**
     * @notice Sets the redemption tax to `newRedemptionTax`
     * @dev Owner only - governance hook
     * @param newRedemptionTax New redemption tax
     */
    function setRedemptionTax(uint256 newRedemptionTax) external onlyOwner {
        require(newRedemptionTax <= REDEMPTION_TAX_CAP, "ReserveAdmin: too large");

        _state.redemptionTax = Decimal.D256({value: newRedemptionTax});

        emit RedemptionTaxUpdate(newRedemptionTax);
    }
}

/**
 * @title ReserveAccessors
 * @notice Reserve state accessor helpers
 */
contract ReserveAccessors is IImplementation, ReserveAdmin {
    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    // COMPTROLLER

    /**
     * @notice Current reserve debt accrued from stabilizer borrowing
     * @return Reserve debt
     */
    function debt() public view returns (uint256) {
        return _state.borrower.debt;
    }

    /**
     * @notice Increments the reserve debt by `amount`
     * @dev Internal only
     * @param amount Amount to increment debt in ESD
     */
    function _incrementDebt(uint256 amount) internal {
        _state.borrower.debt = _state.borrower.debt.add(amount);
    }

    /**
     * @notice Decrements the reserve debt by `amount`
     * @dev Internal only
            Reverts when insufficient debt with reason `reason`
     * @param amount Amount to decrement debt in ESD
     * @param reason Revert reason
     */
    function _decrementDebt(uint256 amount, string memory reason) internal {
        _state.borrower.debt = _state.borrower.debt.sub(amount, reason);
    }

    /**
     * @notice Current borrow controller state for rate-limiting borrowing
     * @dev Internal only
     * @return Borrow controller
     */
    function _borrowController() internal view returns (ReserveTypes.BorrowController memory) {
        return _state.borrower.controller;
    }

    /**
     * @notice Updates the borrow controller state
     * @dev Internal only
     * @param newBorrowed Newly calculated borrow amount for the current window
     * @param newLast Timestamp of update
     */
    function _updateBorrowController(uint256 newBorrowed, uint256 newLast) internal {
        _state.borrower.controller.borrowed = newBorrowed;
        _state.borrower.controller.last = newLast;
    }

    // SWAPPER

    /**
     * @notice Full state of the `makerToken`-`takerToken` order
     * @param makerToken Token that the reserve wishes to sell
     * @param takerToken Token that the reserve wishes to buy
     * @return Specified order
     */
    function order(address makerToken, address takerToken) public view returns (ReserveTypes.Order memory) {
        return _state.orders[makerToken][takerToken];
    }

    /**
     * @notice Sets the `price` and `amount` of the specified `makerToken`-`takerToken` order
     * @dev Internal only
     * @param makerToken Token that the reserve wishes to sell
     * @param takerToken Token that the reserve wishes to buy
     * @param price Price as a ratio of takerAmount:makerAmount times 10^18
     * @param amount Amount to decrement in ESD
     */
    function _updateOrder(address makerToken, address takerToken, uint256 price, uint256 amount) internal {
        _state.orders[makerToken][takerToken] = ReserveTypes.Order({price: Decimal.D256({value: price}), amount: amount});
    }

    /**
     * @notice Decrements the available amount of the specified `makerToken`-`takerToken` order
     * @dev Internal only
            Reverts when insufficient amount with reason `reason`
     * @param makerToken Token that the reserve wishes to sell
     * @param takerToken Token that the reserve wishes to buy
     * @param amount Amount to decrement in ESD
     * @param reason revert reason
     */
    function _decrementOrderAmount(address makerToken, address takerToken, uint256 amount, string memory reason) internal {
        _state.orders[makerToken][takerToken].amount = _state.orders[makerToken][takerToken].amount.sub(amount, reason);
    }

    // IMPLEMENTATION

    /**
     * @notice Registry containing mappings for all protocol contracts
     * @return Protocol registry
     */
    function registry() public view returns (IRegistry) {
        return IRegistry(_state.implementation.registry);
    }

    /**
     * @notice Updates the registry contract
     * @dev Internal only
     * @param newRegistry New registry contract
     */
    function _setRegistry(address newRegistry) internal {
        _state.implementation.registry = newRegistry;
    }

    /**
     * @notice Owner contract with admin permission over this contract
     * @return Owner contract
     */
    function owner() public view returns (address) {
        return _state.implementation.owner;
    }

    /**
     * @notice Updates the owner contract
     * @dev Internal only
     * @param newOwner New owner contract
     */
    function _setOwner(address newOwner) internal {
        _state.implementation.owner = newOwner;
    }
}
