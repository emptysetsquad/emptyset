const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockStabilizerState = contract.fromArtifact('MockStabilizerState');

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe('StabilizerState', function () {
  const [ ownerAddress, userAddress, userAddress2, registry, newOwner] = accounts;

  beforeEach(async function () {
    this.accessors = await MockStabilizerState.new({from: ownerAddress});
    await this.accessors.takeOwnership({from: ownerAddress});
  });

  /**
   * Admin
   */

  describe('setDecayRate', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.setDecayRate(1234, {from: ownerAddress});
      });

      it('sets new value', async function () {
        const decayRate = await this.accessors.decayRate();
        expect(decayRate.value).to.be.bignumber.equal(new BN(1234));
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.accessors.setDecayRate(100, {from: userAddress}),
          "Implementation: not owner");
      });
    });
  });

  describe('maxAlpha', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.setMaxAlpha(1234, {from: ownerAddress});
      });

      it('sets new value', async function () {
        const maxAlpha = await this.accessors.maxAlpha();
        expect(maxAlpha.value).to.be.bignumber.equal(new BN(1234));
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.accessors.setMaxAlpha(100, {from: userAddress}),
          "Implementation: not owner");
      });
    });
  });

  describe('rewardRate', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.setRewardRate(1234, {from: ownerAddress});
      });

      it('sets new value', async function () {
        const rewardRate = await this.accessors.rewardRate();
        expect(rewardRate.value).to.be.bignumber.equal(new BN(1234));
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.accessors.setRewardRate(100, {from: userAddress}),
          "Implementation: not owner");
      });
    });
  });

  /**
   * Token
   */

  describe('transferBalance', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.incrementBalanceE(userAddress, 100);
        await this.accessors.transferBalanceE(userAddress, userAddress2, 100, "transferBalanceE - 1");
      });

      it('updates balances', async function () {
        expect(await this.accessors.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.accessors.balanceOf(userAddress2)).to.be.bignumber.equal(new BN(100));
        expect(await this.accessors.totalSupply()).to.be.bignumber.equal(new BN(100));
      });
    });
  });

  describe('incrementBalance', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.incrementBalanceE(userAddress, 100);
        await this.accessors.incrementBalanceE(userAddress, 100);
      });

      it('increments balance', async function () {
        expect(await this.accessors.balanceOf(userAddress)).to.be.bignumber.equal(new BN(200));
        expect(await this.accessors.totalSupply()).to.be.bignumber.equal(new BN(200));
      });
    });
  });

  describe('decrementBalance', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.incrementBalanceE(userAddress, 500);
        await this.accessors.decrementBalanceE(userAddress, 100, "decrementBalanceE - 1");
        await this.accessors.decrementBalanceE(userAddress, 100, "decrementBalanceE - 2");
      });

      it('decrements balance', async function () {
        expect(await this.accessors.balanceOf(userAddress)).to.be.bignumber.equal(new BN(300));
        expect(await this.accessors.totalSupply()).to.be.bignumber.equal(new BN(300));
      });
    });

    describe('when called erroneously', function () {
      beforeEach('call', async function () {
        await this.accessors.incrementBalanceE(userAddress, 100);
      });

      it('reverts', async function () {
        await expectRevert(
          this.accessors.decrementBalanceE(200, "decrementBalanceE"),
          "decrementBalanceE");
      });
    });
  });

  describe('updateAllowance', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.updateAllowanceE(userAddress, userAddress2, 100);
      });

      it('updates allowance', async function () {
        expect(await this.accessors.allowance(userAddress, userAddress2)).to.be.bignumber.equal(new BN(100));
        expect(await this.accessors.allowance(userAddress2, userAddress)).to.be.bignumber.equal(new BN(0));
      });
    });
  });

  /**
   * Comptroller
   */

  describe('updateEma', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.updateEmaE(1234);
      });

      it('sets new value', async function () {
        const ema = await this.accessors.ema();
        expect(ema.value).to.be.bignumber.equal(new BN(1234));
      });
    });
  });

  /**
   * Implementation
   */

  describe('setRegistry', function () {
    describe('before called', function () {
      it('is not initialized', async function () {
        expect(await this.accessors.registry()).to.be.equal(ZERO_ADDRESS);
      });
    });

    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.setRegistryE(registry);
      });

      it('is initialized', async function () {
        expect(await this.accessors.registry()).to.be.equal(registry);
      });
    });
  });

  describe('setOwner', function () {
    describe('before called', function () {
      it('is not initialized', async function () {
        expect(await this.accessors.owner()).to.be.equal(ownerAddress);
      });
    });

    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.setOwnerE(newOwner);
      });

      it('is initialized', async function () {
        expect(await this.accessors.owner()).to.be.equal(newOwner);
      });
    });
  });
});