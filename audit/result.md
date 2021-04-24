## [4/1/21] OZ Audit Result

#### [H01] Governance can be tricked into performing external calls to a malicious contract

Updated docs with a guide on acceptable ERC20 properties for [governance](https://app.gitbook.com/@emptysetsquad/s/continuous-esd/governance).

#### [H02] Rescue of ERC20 tokens can fail

Fixed as a side-effect of [#14](https://github.com/emptysetsquad/dollar-continuous/pull/14).

#### [H03] Test are not following contracts logic

Fixed in [#16](https://github.com/emptysetsquad/dollar-continuous/pull/16).

#### [M01] Documentation issues

Fixed in [#15](https://github.com/emptysetsquad/dollar-continuous/pull/15).

#### [M02] High value transfers may revert

Won't fix - don't want to modify widely-used forked code unnecessarily.

#### [M03] Missing test coverage report

Won't currently fix - Solidity coverage tool currently incompatible with our setup.

#### [M04] Orders registration can be frontrun

Won't fix - generally speaking, this module is meant to be holdover until we can create a more robust DAO treasury management system as part of a larger effort.

Included note in [governance](https://app.gitbook.com/@emptysetsquad/s/continuous-esd/governance) on how to properly account for these limitations.

#### [M05] Same transaction on different proposal could revert

Won't fix - safe to assume two proposals will never need to be committed in the same block, and we don't want to modify widely-used forked code unnecessarily.

#### [M06] Underlying tokens could get stuck

Fixed in [#14](https://github.com/emptysetsquad/dollar-continuous/pull/14).

#### [M07] Deprecated TokenVesting draft contract is used

TBD

#### [M08] Unnecessary ABIEncoderV2

Fixed in [#13](https://github.com/emptysetsquad/dollar-continuous/pull/13).

#### [M09] Untested custom SafeMath library in use

Won't fix - widely-used forked code already tested externally.

#### [M10] Updating storage variables could soft-brick the protocol

Fixed in [#12](https://github.com/emptysetsquad/dollar-continuous/pull/12).

#### [M11] Possible compromised storage due to hierarchy composition

Fixed in [#11](https://github.com/emptysetsquad/dollar-continuous/pull/11).

#### [M12] Wrong arithmetic operation when normalizing prices

Fixed in [#10](https://github.com/emptysetsquad/dollar-continuous/pull/10).

#### [L01] Lack of guardian-role transfer

Won't fix - don't want to modify widely-used forked code unnecessarily.

#### [L02] ESD price defaults to one

Expected behavior since a stablecoin's *neutral* price is $1.00.

#### [L03] ERC20 compliant assets may not be used

Updated docs with a guide on acceptable ERC20 properties for [governance](https://app.gitbook.com/@emptysetsquad/s/continuous-esd/governance).

#### [L04] Implementation functions sparsed into different contracts

Fixed in [#20](https://github.com/emptysetsquad/dollar-continuous/pull/20).

#### [L05] Hardcoded parameters in Governance

Won't fix - don't want to modify widely-used forked code unnecessarily.

#### [L06] Implicit casting

Won't fix - don't want to modify widely-used forked code unnecessarily.

#### [L07] Lack of event emission after sensitive actions

Won't fix - don't want to modify widely-used forked code unnecessarily.

#### [L08] Lack of input validation

Fixed for `Incentivizer` in [#9](https://github.com/emptysetsquad/dollar-continuous/pull/9).

Won't fix for `GovernorAlpha` and `Stake` - don't want to modify widely-used forked code unnecessarily.

#### [L09] Missing tests

Won't fix - widely-used forked code already tested externally.

#### [L10] View function creates a pointer to storage

Won't fix - don't want to modify widely-used forked code unnecessarily.

#### [L11] Order of arithmetic operations reduces the outcome’s precision

Won't fix - effect on oracle is negligible, so we'd prefer to leave as is to increase readability by separating the numeric computation from the base conversion. 

#### [L12] Centralized registry is not adopted in the whole code base

Fixed in [#8](https://github.com/emptysetsquad/dollar-continuous/pull/8).

#### [L13] Re-implementing ECDSA signature recovery

Won't fix - don't want to modify widely-used forked code unnecessarily.

#### [L14] New Oracle instance has to be deployed after a new StabilizerImpl deployment

Won't fix - this behavior is ok

#### [L15] Uncommon ERC20 are not managed

Updated docs with a guide on acceptable ERC20 properties for [governance](https://app.gitbook.com/@emptysetsquad/s/continuous-esd/governance).

#### [L16] Unhandled return value

Won't fix - don't want to modify widely-used forked code unnecessarily.

#### [L17] An account can trigger an approval event on behalf of another account

Won't fix - will stick with current behavior to conform to OZs implementation of ERC20.

#### [N01] Not following the Checks-Effects-Interactions pattern

Won't fix - preserve for code clarity.

#### [N02] Gas optimization

Fixed in [#7](https://github.com/emptysetsquad/dollar-continuous/pull/8).

#### [N03] Modifier could replace repeated requirements

Won't fix - don't want to modify widely-used forked code unnecessarily.

#### [N04] Implicit and default values

Won't fix - don't want to modify widely-used forked code unnecessarily.

#### [N05] Inconsistent coding style

Fixed in [#18](https://github.com/emptysetsquad/dollar-continuous/pull/18).

#### [N06] Lack of indexed parameters in events

Fixed in [#6](https://github.com/emptysetsquad/dollar-continuous/pull/6).

#### [N07] Misleading or erroneous docstrings

Fixed in [#5](https://github.com/emptysetsquad/dollar-continuous/pull/5).

#### [N08] Several contracts developed per file

Won't fix directly - significantly cleaned up via [#19](https://github.com/emptysetsquad/dollar-continuous/pull/19) and [#20](https://github.com/emptysetsquad/dollar-continuous/pull/20).

#### [N09] Naming issues

Fixed partially in [#4](https://github.com/emptysetsquad/dollar-continuous/pull/4).

#### [N10] Declare uint as uint256

Won't fix - don't want to modify widely-used forked code unnecessarily.

## Other Identified Issues

#### Move Reentrancy Protection to Implementation

Fixed in [#1](https://github.com/emptysetsquad/dollar-continuous/pull/1).

#### Rounding error on mint()

Fixed in [#3](https://github.com/emptysetsquad/dollar-continuous/pull/3).

#### Remove Stabilizer Module

Fixed in [#19](https://github.com/emptysetsquad/dollar-continuous/pull/19).