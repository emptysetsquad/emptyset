const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockStabilizerToken = contract.fromArtifact('MockStabilizerToken');

describe('StabilizerToken', function () {
  const [ ownerAddress, userAddress] = accounts;

  beforeEach(async function () {
    this.token = await MockStabilizerToken.new({from: ownerAddress});
  });

  /**
   * Token
   */

  describe('name', function () {
    it('returns name', async function () {
      expect(await this.token.name()).to.be.equal("Saved Empty Set Dollar");
    });
  });

  describe('symbol', function () {
    it('returns symbol', async function () {
      expect(await this.token.symbol()).to.be.equal("sESD");
    });
  });

  describe('decimals', function () {
    it('returns decimals', async function () {
      expect(await this.token.decimals()).to.be.bignumber.equal(new BN(18));
    });
  });

  describe('approve', function () {
    describe('when called', function () {
      beforeEach(async function () {
        this.result = await this.token.approve(ownerAddress, 100, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('updates state', async function () {
        expect(await this.token.allowance(userAddress, ownerAddress)).to.be.bignumber.equal(new BN(100));
      });

      it('emits Approval event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockStabilizerToken, 'Approval', {
          owner: userAddress,
          spender: ownerAddress,
        });

        expect(event.args.value).to.be.bignumber.equal(new BN(100));
      });
    });
  });

  describe('transfer', function () {
    describe('when called', function () {
      beforeEach(async function () {
        await this.token.incrementBalanceE(userAddress, 100);
        this.result = await this.token.transfer(ownerAddress, 100, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('updates state', async function () {
        expect(await this.token.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.token.balanceOf(ownerAddress)).to.be.bignumber.equal(new BN(100));
      });

      it('emits Transfer event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockStabilizerToken, 'Transfer', {
          from: userAddress,
          to: ownerAddress,
        });

        expect(event.args.value).to.be.bignumber.equal(new BN(100));
      });
    });

    describe('when called erroneously', function () {
      beforeEach('call', async function () {
        await this.token.incrementBalanceE(userAddress, 100);
      });

      it('reverts', async function () {
        await expectRevert(
          this.token.transfer(ownerAddress, 200, {from: userAddress}),
          "StabilizerToken: transfer amount exceeds balance");
      });
    });
  });

  describe('transferFrom', function () {
    describe('when called', function () {
      beforeEach(async function () {
        await this.token.incrementBalanceE(userAddress, 100);
        await this.token.approve(ownerAddress, 100, {from: userAddress});
        this.result = await this.token.transferFrom(userAddress, ownerAddress, 100, {from: ownerAddress});
        this.txHash = this.result.tx;
      });

      it('updates state', async function () {
        expect(await this.token.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.token.balanceOf(ownerAddress)).to.be.bignumber.equal(new BN(100));
        expect(await this.token.allowance(userAddress, ownerAddress)).to.be.bignumber.equal(new BN(0));
      });

      it('emits Transfer event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockStabilizerToken, 'Transfer', {
          from: userAddress,
          to: ownerAddress,
        });

        expect(event.args.value).to.be.bignumber.equal(new BN(100));
      });
    });

    describe('insufficient balance', function () {
      beforeEach('call', async function () {
        await this.token.incrementBalanceE(userAddress, 100);
        await this.token.approve(ownerAddress, 200, {from: userAddress});
      });

      it('reverts', async function () {
        await expectRevert(
          this.token.transferFrom(userAddress, ownerAddress, 200, {from: ownerAddress}),
          "StabilizerToken: transfer amount exceeds balance");
      });
    });

    describe('insufficient approve', function () {
      beforeEach('call', async function () {
        await this.token.incrementBalanceE(userAddress, 200);
        await this.token.approve(ownerAddress, 100, {from: userAddress});
      });

      it('reverts', async function () {
        await expectRevert(
          this.token.transferFrom(userAddress, ownerAddress, 200, {from: ownerAddress}),
          "StabilizerToken: transfer amount exceeds allowance");
      });
    });

    describe('need to approve self', function () {
      beforeEach('call', async function () {
        await this.token.incrementBalanceE(userAddress, 100);
      });

      it('reverts', async function () {
        await expectRevert(
          this.token.transferFrom(userAddress, ownerAddress, 100, {from: userAddress}),
          "StabilizerToken: transfer amount exceeds allowance");
      });
    });
  });
});