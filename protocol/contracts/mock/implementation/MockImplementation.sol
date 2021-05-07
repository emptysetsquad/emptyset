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

import "../../src/common/Implementation.sol";

contract MockImplementation is Implementation {
    address private _registry;
    address private _owner;
    bool private _notEntered;

    function registry() public view returns (IRegistry) {
        return IRegistry(_registry);
    }

    function _setRegistry(address newRegistry) internal {
        _registry = newRegistry;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function _setOwner(address newOwner) internal {
        _owner = newOwner;
    }

    function notEnteredE() external view returns (bool) {
        return notEntered();
    }

    function notEntered() internal view returns (bool) {
        return _notEntered;
    }

    function _setNotEntered(bool newNotEntered) internal {
        _notEntered = newNotEntered;
    }

    function onlyOwnerE() external onlyOwner { }

    function reenters() public nonReentrant {
        reenters();
    }
}
