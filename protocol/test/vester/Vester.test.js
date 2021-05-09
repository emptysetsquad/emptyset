const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const Stake = contract.fromArtifact('Stake');
const Vester = contract.fromArtifact('Vester');
const MockGovToken = contract.fromArtifact('MockGovToken');

const ONE_BIP = new BN(10).pow(new BN(14));
const ONE_UNIT = ONE_BIP.mul(new BN(10000));
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe('Vester', function () {
  this.retries(10);
  this.timeout(5000);

  const [ reserveAddress, userAddress, userAddressNew, delegateAddress ] = accounts;

  beforeEach(async function () {
    this.start = await time.latest();
    this.duration = new BN(86400 * 30);

    this.stake = await Stake.new({from: reserveAddress});
    this.vester = await Vester.new(userAddress, this.start, 0, this.duration, false, {from: userAddress});
    await this.stake.mint(ONE_UNIT.muln(1000000), {from: reserveAddress});
    await this.stake.transfer(this.vester.address, ONE_UNIT.muln(1000000), {from: reserveAddress});

    this.ess = await MockGovToken.new("Empty Set Share", "ESS", 18, {from: reserveAddress});
  });

  describe('transferBeneficiary', function () {
    describe('not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.vester.transferBeneficiary(userAddressNew, {from: reserveAddress}),
          "Vester: not beneficiary");
      });
    });

    describe('zero address', function () {
      it('reverts', async function () {
        await expectRevert(
          this.vester.transferBeneficiary(ZERO_ADDRESS, {from: userAddress}),
          "Vester: zero address");
      });
    });

    describe('simple', function () {
      beforeEach(async function () {
        this.result = await this.vester.transferBeneficiary(userAddressNew, {from: userAddress})
        this.txHash = this.result.tx;
      });

      it('transfers', async function () {
        expect(await this.vester.beneficiary()).to.be.equal(userAddressNew);
      });

      it('emits BeneficiaryTransfer event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, Vester, 'BeneficiaryTransfer', {
          newBeneficiary: userAddressNew
        });
      });

      describe('can withdraw to new beneficiary', function () {
        beforeEach(async function () {
          await time.increase(86400 * 3);
          this.result = await this.vester.release(this.stake.address, {from: userAddress})
          this.txHash = this.result.tx;
        });

        it('withdraws', async function () {
          expect(await this.stake.balanceOf(this.vester.address)).to.be.bignumber.equal(ONE_UNIT.muln(900000));
          expect(await this.stake.balanceOf(userAddressNew)).to.be.bignumber.equal(ONE_UNIT.muln(100000));
        });
      });

      describe('cannot withdraw to new beneficiary', function () {
        it('reverts', async function () {
          await expectRevert(
            this.vester.transferBeneficiary(userAddressNew, {from: userAddress}),
            "Vester: not beneficiary");
        });
      });
    });
  });

  describe('delegate', function () {
    beforeEach(async function () {
      this.result = await this.vester.delegate(this.ess.address, delegateAddress, {from: userAddress});
      this.txHash = this.result.tx;
    });

    it('delegates', async function () {
      expect(await this.ess.delegatee()).to.be.equal(delegateAddress);
    });

    describe('not owner', function () {
      it('reverts', async function () {
        await expectRevert(this.vester.delegate(this.ess.address, delegateAddress, {from: reserveAddress}), "Vester: not beneficiary");
      });
    });
  });
});