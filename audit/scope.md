## [4/1/21] OZ Audit Scope

### Contracts In Scope (New)
- `common/*`
- `incentivizer/*`
- `lib/`
    - `lib/Decimal.sol`
    - `lib/TimeUtils.sol`
- `migrator/*`
- `oracle/*`
- `registry/*`
- `reserve/*`
- `stabilizer/*`
- `token/`
    - `token/Dollar.sol`
- `vester/`
    - `vester/Vester.sol`

### Contracts In Scope (Forked)
These contracts are forked from previously OZ-audited contracts with minimal, but material changes.

- `governance/`
    - `governance/GovernorAlpha.sol`
    - `governance/Stake.sol`

### Contracts Out Of Scope (Forked)
These contracts are forked from previously OZ-audited contracts with zero, or trivial changes.

- `governance/`
    - `governance/Timelock.sol`
- `lib/`
    - `lib/LibEIP712.sol`
    - `lib/UniswapV2Library.sol`
    - `lib/UniswapV2OracleLibrary.sol`
- `token/`
    - `token/Permittable.sol`
- `vester/`
    - `vester/TokenVesting.sol`