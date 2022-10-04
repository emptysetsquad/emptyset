const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockToken = contract.fromArtifact('MockToken');
const Registry = contract.fromArtifact('Registry');
const MockGovToken = contract.fromArtifact('MockGovToken');
const MockReserveVault = contract.fromArtifact('MockReserveVault');
const MockCErc20 = contract.fromArtifact('MockCErc20');
const MockCComptroller = contract.fromArtifact('MockCComptroller');

const ONE_USDC = new BN(1000000);
const ONE_BIP = new BN(10).pow(new BN(14));
const ONE_UNIT = ONE_BIP.mul(new BN(10000));

describe('ReserveVault', function () {
  const [ ownerAddress, userAddress, delegateAddress, pauserAddress ] = accounts;

  beforeEach(async function () {
    this.registry = await Registry.new({from: ownerAddress});
    this.collateral = await MockToken.new("USD//C", "USDC", 6, {from: ownerAddress});
    this.comp = await MockGovToken.new("Compound Token", "COMP", 18, {from: ownerAddress});
    this.comptroller = await MockCComptroller.new({from: ownerAddress});
    await this.comptroller.set(this.comp.address);
    this.cUsdc = await MockCErc20.new({from: ownerAddress});
    await this.cUsdc.set(this.collateral.address, this.comptroller.address);
    await this.cUsdc.setExchangeRate(ONE_USDC);
    this.vault = await MockReserveVault.new({from: ownerAddress});
    await this.vault.takeOwnership({from: ownerAddress});
    await this.vault.setup({from: ownerAddress});
    await this.vault.setRegistry(this.registry.address, {from: ownerAddress});
    await this.registry.setUsdc(this.collateral.address, {from: ownerAddress});
    await this.registry.setCUsdc(this.cUsdc.address, {from: ownerAddress});
  });

  describe('supplyVault', function () {
    describe('basic', function () {
      beforeEach(async function () {
        await this.collateral.mint(this.vault.address, ONE_USDC.mul(new BN(100000)));
        this.result = await this.vault.supplyVaultE(ONE_USDC.mul(new BN(100000)));
        this.txHash = this.result.tx;
      });

      it('supplies', async function () {
        expect(await this.vault.balanceOfVaultE()).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
        expect(await this.cUsdc.balanceOf(this.vault.address)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
      });

      it('doesnt over approve', async function () {
        expect(await this.collateral.allowance(this.cUsdc.address, this.vault.address)).to.be.bignumber.equal(new BN(0));
      });

      it('emits Supply event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveVault, 'SupplyVault', {
        });

        expect(event.args.amount).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
      });
    });

    describe('exchange rate change', function () {
      beforeEach(async function () {
        await this.collateral.mint(this.vault.address, ONE_USDC.mul(new BN(200000)));
        await this.vault.supplyVaultE(ONE_USDC.mul(new BN(100000)));

        // Accrue 100000 USDC rewards
        await this.cUsdc.setExchangeRate(ONE_USDC.mul(new BN(2)));
        await this.collateral.mint(this.cUsdc.address, ONE_USDC.mul(new BN(100000)));

        this.result = await this.vault.supplyVaultE(ONE_USDC.mul(new BN(100000)));
        this.txHash = this.result.tx;
      });

      it('supplies', async function () {
        expect(await this.vault.balanceOfVaultE()).to.be.bignumber.equal(ONE_USDC.mul(new BN(300000)));
        expect(await this.cUsdc.balanceOf(this.vault.address)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(150000)));
      });

      it('doesnt over approve', async function () {
        expect(await this.collateral.allowance(this.cUsdc.address, this.vault.address)).to.be.bignumber.equal(new BN(0));
      });

      it('emits Supply event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveVault, 'SupplyVault', {
        });

        expect(event.args.amount).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
      });
    });

    describe('invalid status code', function () {
      beforeEach(async function () {
        await this.cUsdc.setStatusCode(1);
        await this.collateral.mint(this.vault.address, ONE_USDC.mul(new BN(100000)));
      });

      it('reverts', async function () {
        await expectRevert(this.vault.supplyVaultE(ONE_USDC.mul(new BN(100000))), "ReserveVault: supply failed");
      });
    });
  });

  describe('redeemVault', function () {
    beforeEach(async function () {
      await this.collateral.mint(this.vault.address, ONE_USDC.mul(new BN(100000)));
      await this.vault.supplyVaultE(ONE_USDC.mul(new BN(100000)));
    });

    describe('basic', function () {
      beforeEach(async function () {
        this.result = await this.vault.redeemVaultE(ONE_USDC.mul(new BN(100000)));
        this.txHash = this.result.tx;
      });

      it('redeems', async function () {
        expect(await this.vault.balanceOfVaultE()).to.be.bignumber.equal(ONE_USDC.mul(new BN(0)));
        expect(await this.cUsdc.balanceOf(this.vault.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.collateral.balanceOf(this.vault.address)).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
      });

      it('emits RedeemVault event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveVault, 'RedeemVault', {
        });

        expect(event.args.amount).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
      });
    });

    describe('exchange rate change', function () {
      beforeEach(async function () {

        // Accrue 100000 USDC rewards
        await this.cUsdc.setExchangeRate(ONE_USDC.mul(new BN(2)));
        await this.collateral.mint(this.cUsdc.address, ONE_USDC.mul(new BN(100000)));

        this.result = await this.vault.redeemVaultE(ONE_USDC.mul(new BN(200000)));
        this.txHash = this.result.tx;
      });

      it('supplies', async function () {
        expect(await this.vault.balanceOfVaultE()).to.be.bignumber.equal(ONE_USDC.mul(new BN(0)));
        expect(await this.cUsdc.balanceOf(this.vault.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.collateral.balanceOf(this.vault.address)).to.be.bignumber.equal(ONE_USDC.mul(new BN(200000)));
      });

      it('emits RedeemVault event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveVault, 'RedeemVault', {
        });

        expect(event.args.amount).to.be.bignumber.equal(ONE_USDC.mul(new BN(200000)));
      });
    });

    describe('invalid status code', function () {
      beforeEach(async function () {
        await this.cUsdc.setStatusCode(1);
      });

      it('reverts', async function () {
        await expectRevert(this.vault.redeemVaultE(ONE_USDC.mul(new BN(100000))), "ReserveVault: redeem failed");
      });
    });
  });

  describe('claimVault', function () {
    beforeEach(async function () {
      await this.comp.mint(this.comptroller.address, ONE_UNIT);
    });

    describe('basic', function () {
      beforeEach(async function () {
        this.result = await this.vault.claimVault({from: ownerAddress});
        this.txHash = this.result.tx;
      });

      it('claims', async function () {
        expect(await this.comp.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.comp.balanceOf(this.vault.address)).to.be.bignumber.equal(ONE_UNIT);
      });
    });

    describe('not owner', function () {
      it('reverts', async function () {
        await expectRevert(this.vault.claimVault({from: userAddress}), "Implementation: not owner");
      });
    });

    describe('when paused', function () {
      beforeEach(async function () {
        await this.vault.setPauser(pauserAddress, {from: ownerAddress});
        await this.vault.setPaused(true, {from: pauserAddress});
      });

      it('reverts', async function () {
        await expectRevert(
            this.vault.claimVault({from: ownerAddress}),
            "Implementation: paused");
      });
    });
  });

  describe('delegateVault', function () {
    beforeEach(async function () {
      await this.comp.mint(this.comptroller.address, ONE_UNIT);
    });

    describe('basic', function () {
      beforeEach(async function () {
        this.result = await this.vault.delegateVault(this.comp.address, delegateAddress, {from: ownerAddress});
        this.txHash = this.result.tx;
      });

      it('delegates', async function () {
        expect(await this.comp.delegatee()).to.be.equal(delegateAddress);
      });
    });

    describe('not owner', function () {
      it('reverts', async function () {
        await expectRevert(this.vault.delegateVault(this.comp.address, delegateAddress, {from: userAddress}), "Implementation: not owner");
      });
    });

    describe('when paused', function () {
      beforeEach(async function () {
        await this.vault.setPauser(pauserAddress, {from: ownerAddress});
        await this.vault.setPaused(true, {from: pauserAddress});
      });

      it('reverts', async function () {
        await expectRevert(
            this.vault.delegateVault(this.comp.address, delegateAddress, {from: ownerAddress}),
            "Implementation: paused");
      });
    });
  });
});