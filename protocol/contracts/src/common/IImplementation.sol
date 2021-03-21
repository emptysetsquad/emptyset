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

import "../Interfaces.sol";

/**
 * @title Implementation
 * @notice Common functions and accessors across upgradeable, ownable contracts
 */
contract IImplementation {
    /**
     * @notice Common state for upgradeable, ownable, implementation contracts
     */
    struct ImplementationState {

        /**
         * @notice Contract which is granted admin control over this contract
         */
        address owner;

        /**
         * @notice Registry containing mappings for all protocol contracts
         */
        address registry;

        /**
         * @notice Entered state for tracking call reentrancy
         */
        bool notEntered;
    }

    /**
     * @notice Emitted when {owner} is updated with `newOwner`
     */
    event OwnerUpdate(address newOwner);

    /**
     * @notice Emitted when {registry} is updated with `newRegistry`
     */
    event RegistryUpdate(address newRegistry);

    // REGISTRY

    /**
     * @notice Registry containing mappings for all protocol contracts
     * @return Protocol registry
     */
    function registry() public view returns (IRegistry);

    /**
     * @notice Updates the registry contract
     * @dev Internal only
     * @param newRegistry New registry contract
     */
    function _setRegistry(address newRegistry) internal;

    // OWNER

    /**
     * @notice Owner contract with admin permission over this contract
     * @return Owner contract
     */
    function owner() public view returns (address);

    /**
     * @notice Updates the owner contract
     * @dev Internal only
     * @param newOwner New owner contract
     */
    function _setOwner(address newOwner) internal;

    // NON REENTRANT

    /**
     * @notice The entered status of the current call
     * @return entered status
     */
    function notEntered() internal view returns (bool);

    /**
     * @notice Updates the entered status of the current call
     * @dev Internal only
     * @param newNotEntered New entered status
     */
    function _setNotEntered(bool newNotEntered) internal;
}
