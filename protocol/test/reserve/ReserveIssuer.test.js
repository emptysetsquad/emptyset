const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const Stake = contract.fromArtifact('Stake');
const Registry = contract.fromArtifact('Registry');
const MockReserveIssuer = contract.fromArtifact('MockReserveIssuer');

const ONE_BIP = new BN(10).pow(new BN(14));
const ONE_UNIT = ONE_BIP.mul(new BN(10000));

describe('ReserveIssuer', function () {
  const [ ownerAddress, userAddress, pauserAddress ] = accounts;

  beforeEach(async function () {
    this.registry = await Registry.new({from: ownerAddress});
    this.stake = await Stake.new({from: ownerAddress});
    this.issuer = await MockReserveIssuer.new({from: ownerAddress});
    await this.issuer.takeOwnership({from: ownerAddress});
    await this.issuer.setup({from: ownerAddress});
    await this.issuer.setRegistry(this.registry.address, {from: ownerAddress});
    await this.registry.setStake(this.stake.address, {from: ownerAddress});
    await this.stake.transferOwnership(this.issuer.address, {from: ownerAddress});
  });

  describe('mintStake', function () {
    describe('owner', function () {
      beforeEach(async function () {
        this.result = await this.issuer.mintStake(userAddress, ONE_UNIT.mul(new BN(100000)), {from: ownerAddress});
        this.txHash = this.result.tx;
      });

      it('mints', async function () {
        expect(await this.stake.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
      });

      it('emits MintStake event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveIssuer, 'MintStake', {
          account: userAddress
        });

        expect(event.args.mintAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
      });
    });

    describe('not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.issuer.mintStake(userAddress, ONE_UNIT.mul(new BN(100000)), {from: userAddress}),
          "Implementation: not owner");
      });
    });

    describe('when paused', function () {
      beforeEach(async function () {
        await this.issuer.setPauser(pauserAddress, {from: ownerAddress});
        await this.issuer.setPaused(true, {from: pauserAddress});
      });

      it('reverts', async function () {
        await expectRevert(
            this.issuer.mintStake(userAddress, ONE_UNIT.mul(new BN(100000)), {from: ownerAddress}),
            "Implementation: paused");
      });
    });
  });

  describe('burnStake', function () {
    beforeEach(async function () {
      await this.issuer.mintStake(userAddress, ONE_UNIT.mul(new BN(100000)), {from: ownerAddress});
      await this.stake.transfer(this.issuer.address, ONE_UNIT.mul(new BN(100000)), {from: userAddress})
    });

    describe('owner', function () {
      beforeEach(async function () {
        this.result = await this.issuer.burnStake({from: ownerAddress});
        this.txHash = this.result.tx;
      });

      it('burns', async function () {
        expect(await this.stake.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.stake.balanceOf(this.issuer.address)).to.be.bignumber.equal(new BN(0));
      });

      it('emits BurnStake event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveIssuer, 'BurnStake', {
        });

        expect(event.args.burnAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
      });
    });

    describe('not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.issuer.burnStake({from: userAddress}),
          "Implementation: not owner");
      });
    });

    describe('when paused', function () {
      beforeEach(async function () {
        await this.issuer.setPauser(pauserAddress, {from: ownerAddress});
        await this.issuer.setPaused(true, {from: pauserAddress});
      });

      it('reverts', async function () {
        await expectRevert(
            this.issuer.burnStake({from: ownerAddress}),
            "Implementation: paused");
      });
    });
  });
});