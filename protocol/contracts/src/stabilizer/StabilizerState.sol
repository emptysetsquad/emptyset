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
import "../Interfaces.sol";
import "../common/IImplementation.sol";
import "../common/Implementation.sol";
import "../common/Implementation.sol";

/**
 * @title StabilizerTypes
 * @notice Contains all stabilizer state structs
 */
contract StabilizerTypes {

    /**
     * @notice Stores state for the sESD ERC20 implementation
     */
    struct Token {
        /**
         * @notice account to sESD balance mapping
         */
        mapping (address => uint256) balances;

        /**
         * @notice sESD allowance data
         */
        mapping (address => mapping (address => uint256)) allowances;

        /**
         * @notice total supply of sESD
         */
        uint256 totalSupply;
    }

    /**
     * @notice Stores state for the EMA oracle
     */
    struct Oracle {
        /**
         * @notice Exponential Moving Average ESD price
         */
        Decimal.D256 ema;
        /**
         * @notice Rate of decay for the EMA algorithm
         */
        Decimal.D256 decayRate;
        /**
         * @notice Maximum ratio that the EMA is allowed to be updated in a single settlement
         */
        Decimal.D256 maxAlpha;
    }

    /**
     * @notice Stores state for the entire stabilizer
     */
    struct State {
        /**
         * @notice Common state for upgradeable, ownable, implementation contracts
         */
        IImplementation.ImplementationState implementation;

        /**
         * @notice State for the sESD ERC20 implementation
         */
        StabilizerTypes.Token token;

        /**
         * @notice State for the EMA oracle
         */
        StabilizerTypes.Oracle oracle;

        /**
         * @notice Parameter determining the rate at which rewards accrue
         * @dev    Denoted as a % of totalUnderlying per day, assuming 100% off-peg (0.00 price)
         */
        Decimal.D256 rewardRate;
    }
}

/**
 * @title StabilizerState
 * @notice Stabilizer state
 */
contract StabilizerState {

    /**
     * @notice Entirety of the stabilizer contract state
     * @dev To upgrade state, append additional state variables at the end of this contract
     */
    StabilizerTypes.State internal _state;
}

/**
 * @title StabilizerAdmin
 * @notice Stabilizer admin state accessor helpers
 */
contract StabilizerAdmin is StabilizerState, Implementation {

    /**
     * @notice Cap decay at a 100% per day rate
     */
    uint256 private constant DECAY_RATE_CAP = 1e18;

    /**
     * @notice Alpha must by capped no higher than a 100% per day rate
     */
    uint256 private constant MAX_ALPHA_CAP = 1e18;

    /**
     * @notice Cap effective rate at (1.00 - price) * 2.5% per day
     * @dev Corresponds to 31.5% APY at 0.97 price
     */
    uint256 private constant REWARD_RATE_CAP = 0.025e18;

    /**
     * @notice Emitted when {decayRate} is updated with `newDecayRate`
     */
    event DecayRateUpdate(uint256 newDecayRate);

    /**
     * @notice Emitted when {maxAlpha} is updated with `newMaxAlpha`
     */
    event MaxAlphaUpdate(uint256 newMaxAlpha);

    /**
     * @notice Emitted when {rewardRate} is updated with `newRewardRate`
     */
    event RewardRateUpdate(uint256 newRewardRate);

    // COMPTROLLER

    /**
     * @notice Rate of decay for the EMA algorithm
     * @return Decay rate
     */
    function decayRate() public view returns (Decimal.D256 memory) {
        return _state.oracle.decayRate;
    }

    /**
     * @notice Sets the decay rate to `newDecayRate`
     * @dev Owner only - governance hook
     * @param newDecayRate New decay rate
     */
    function setDecayRate(uint256 newDecayRate) external onlyOwner {
        require(newDecayRate <= DECAY_RATE_CAP, "StabilizerAdmin: too large");

        _state.oracle.decayRate = Decimal.D256({value: newDecayRate});

        emit DecayRateUpdate(newDecayRate);
    }

    /**
     * @notice Maximum ratio that the EMA is allowed to be updated in a single settlement
     * @return Max alpha
     */
    function maxAlpha() public view returns (Decimal.D256 memory) {
        return _state.oracle.maxAlpha;
    }

    /**
     * @notice Sets the maximum alpha to `newMaxAlpha`
     * @dev Owner only - governance hook
     * @param newMaxAlpha New max alpha
     */
    function setMaxAlpha(uint256 newMaxAlpha) external onlyOwner {
        require(newMaxAlpha <= MAX_ALPHA_CAP, "StabilizerAdmin: too large");

        _state.oracle.maxAlpha = Decimal.D256({value: newMaxAlpha});

        emit MaxAlphaUpdate(newMaxAlpha);
    }

    /**
     * @notice Parameter determining the rate at which rewards accrue
     * @dev    Denoted as a % of totalUnderlying per day, assuming 100% off-peg (0.00 price)
     * @return Reward rate
     */
    function rewardRate() public view returns (Decimal.D256 memory) {
        return _state.rewardRate;
    }

    /**
     * @notice Sets the reward rate to `newRewardRate`
     * @dev Owner only - governance hook
     * @param newRewardRate New reward rate
     */
    function setRewardRate(uint256 newRewardRate) external onlyOwner {
        require(newRewardRate <= REWARD_RATE_CAP, "StabilizerAdmin: too large");

        _state.rewardRate = Decimal.D256({value: newRewardRate});

        emit RewardRateUpdate(newRewardRate);
    }
}

/**
 * @title StabilizerAccessors
 * @notice Reserve state accessor helpers
 */
contract StabilizerAccessors is IImplementation, StabilizerAdmin {
    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    // TOKEN

    /**
     * @notice Total supply of sESD tokens
     * @return sESD total supply
     */
    function totalSupply() public view returns (uint256) {
        return _state.token.totalSupply;
    }

    /**
     * @notice The sESD balance for `account`
     * @param account Account to retrieve balance for
     * @return sESD balance
     */
    function balanceOf(address account) public view returns (uint256) {
        return _state.token.balances[account];
    }

    /**
     * @notice The sESD allowance from `owner` for `spender`
     * @param owner Account that is allowing
     * @param spender Account that is being allowed
     * @return sESD allowance
     */
    function allowance(address owner, address spender) public view returns (uint256) {
        return _state.token.allowances[owner][spender];
    }

    /**
     * @notice Transfers `amount` from `sender` to `recipient`
     * @dev Internal only - helper
     *      Reverts with `reason` when insufficient funds
     * @param sender Account that is sending sESD
     * @param recipient Account this is receiving sESD
     * @param amount Amount of sESD that is being transferred
     * @param reason Revert reason
     */
    function _transferBalance(address sender, address recipient, uint256 amount, string memory reason) internal {
        _state.token.balances[sender] = _state.token.balances[sender].sub(amount, reason);
        _state.token.balances[recipient] = _state.token.balances[recipient].add(amount);
    }

    /**
     * @notice Increments the sESD balance of `account` by `amount`
     * @dev Internal only - helper
     * @param account Account that will receive the minted sESD
     * @param amount Amount of sESD that is being minted
     */
    function _incrementBalance(address account, uint256 amount) internal {
        _state.token.totalSupply = _state.token.totalSupply.add(amount);
        _state.token.balances[account] = _state.token.balances[account].add(amount);
    }

    /**
     * @notice Decrements the sESD balance of `account` by `amount`
     * @dev Internal only - helper
     *      Reverts with `reason` when insufficient funds
     * @param account Account that will lose the burned sESD
     * @param amount Amount of sESD that is being burned
     * @param reason Revert reason
     */
    function _decrementBalance(address account, uint256 amount, string memory reason) internal {
        _state.token.balances[account] = _state.token.balances[account].sub(amount, reason);
        _state.token.totalSupply = _state.token.totalSupply.sub(amount);
    }

    /**
     * @notice Updates the allowance from `owner` for `spender` to `amount`
     * @dev Internal only - helper
     * @param owner Account that is allowing
     * @param spender Account that is being allowed
     * @param amount Amount of sESD that is being allowed
     */
    function _updateAllowance(address owner, address spender, uint256 amount) internal {
        _state.token.allowances[owner][spender] = amount;
    }

    // COMPTROLLER

    /**
     * @notice Current EMA oracle price
     * @return EMA price
     */
    function ema() public view returns (Decimal.D256 memory) {
        return _state.oracle.ema;
    }

    /**
     * @notice Updates the EMA price
     * @dev Internal only - helper
     * @param newEma New EMA value
     */
    function _updateEma(Decimal.D256 memory newEma) internal {
        _state.oracle.ema = newEma;
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

    /**
     * @notice The entered status of the current call
     * @return entered status
     */
    function notEntered() internal view returns (bool) {
        return _state.implementation.notEntered;
    }

    /**
     * @notice Updates the entered status of the current call
     * @dev Internal only
     * @param newNotEntered New entered status
     */
    function _setNotEntered(bool newNotEntered) internal {
        _state.implementation.notEntered = newNotEntered;
    }
}
