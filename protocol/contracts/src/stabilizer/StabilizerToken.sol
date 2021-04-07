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
import "./StabilizerState.sol";

/**
 * @title StabilizerToken
 * @notice Stabilizer sESD ERC20 implementation logic
 */
contract StabilizerToken is StabilizerAccessors {
    using SafeMath for uint256;

    /**
     * @notice Emitted when `value` sESD is transferred from `from` to `to`
     */
    event Transfer(address indexed from, address indexed to, uint256 value);
    /**
     * @notice Emitted when `owner` approves `spender` for `value` sESD
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @notice Display name of the sESD token
     * return sESD name
     */
    function name() public view returns (string memory) {
        return "Saved Empty Set Dollar";
    }

    /**
     * @notice Symbol of the sESD token
     * return sESD symbol
     */
    function symbol() public view returns (string memory) {
        return "sESD";
    }

    /**
     * @notice Display decimals of precision for the sESD token
     * return sESD decimals
     */
    function decimals() public view returns (uint8) {
        return 18;
    }

    /**
     * @notice Transfers `amount` sESD from the caller to the `recipient`
     * @param recipient Account to receive the sESD
     * @param amount Amount of sESD to transfer
     * return Whether the transfer was successful
     */
    function transfer(address recipient, uint256 amount) public returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    /**
     * @notice Approves `spender` to transfer `amount` sESD of the caller
     * @param spender Account being approved to transfer caller's funds
     * @param amount Amount of sESD to approve
     * return Whether the approval was successful
     */
    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    /**
     * @notice Transfers `amount` sESD from `sender` to the `recipient`
     * @dev caller must have the required approval amount from `sender`
     * @param sender Account to send the sESD
     * @param recipient Account to receive the sESD
     * @param amount Amount of sESD to transfer
     * return Whether the transfer was successful
     */
    function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
        _approve(sender, msg.sender, allowance(sender, msg.sender).sub(amount, "StabilizerToken: transfer amount exceeds allowance"));
        _transfer(sender, recipient, amount);
        return true;
    }

    // INTERNAL

    /**
     * @notice Transfers `amount` sESD from `sender` to the `recipient`
     * @dev Internal only - helper
     * @param sender Account to send the sESD
     * @param recipient Account to receive the sESD
     * @param amount Amount of sESD to transfer
     */
    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "StabilizerToken: transfer from the zero address");
        require(recipient != address(0), "StabilizerToken: transfer to the zero address");

        _transferBalance(sender, recipient, amount, "StabilizerToken: transfer amount exceeds balance");

        emit Transfer(sender, recipient, amount);
    }

    /**
     * @notice Mints `amount` sESD to `account`
     * @dev Internal only - helper
     * @param account Account to receive minted sESD
     * @param amount Amount of sESD to mint
     */
    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "StabilizerToken: mint to the zero address");

        _incrementBalance(account, amount);

        emit Transfer(address(0), account, amount);
    }

    /**
     * @notice Burns `amount` sESD from `account`
     * @dev Internal only - helper
     * @param account Account being burned from
     * @param amount Amount of sESD to burn
     */
    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "StabilizerToken: burn from the zero address");

        _decrementBalance(account, amount, "StabilizerToken: burn amount exceeds balance");

        emit Transfer(account, address(0), amount);
    }

    /**
     * @notice Approves `spender` to transfer `amount` sESD of the `owner`
     * @param owner Account approving sESD to be transferred
     * @param spender Account being approved to transfer sESD
     * @param amount Amount of sESD to approve
     */
    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "StabilizerToken: approve from the zero address");
        require(spender != address(0), "StabilizerToken: approve to the zero address");

        _updateAllowance(owner, spender, amount);

        emit Approval(owner, spender, amount);
    }
}