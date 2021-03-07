const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockReserveState = contract.fromArtifact('MockReserveState');

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe('ReserveState', function () {
  const [ ownerAddress, userAddress, registry, newOwner, token1, token2] = accounts;

  beforeEach(async function () {
    this.accessors = await MockReserveState.new({from: ownerAddress});
    await this.accessors.takeOwnership({from: ownerAddress});
  });

  /**
   * Admin
   */

  describe('setRedemptionTax', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.setRedemptionTax(1234, {from: ownerAddress});
      });

      it('sets new value', async function () {
        const redemptionTax = await this.accessors.redemptionTax();
        expect(redemptionTax.value).to.be.bignumber.equal(new BN(1234));
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.accessors.setRedemptionTax(100, {from: userAddress}),
          "Implementation: not owner");
      });
    });
  });

  /**
   * Comptroller
   */

  describe('incrementDebt', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.incrementDebtE(100);
      });

      it('sets new value', async function () {
        expect(await this.accessors.debt()).to.be.bignumber.equal(new BN(100));
      });
    });
  });

  describe('decrementDebt', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.incrementDebtE(200);
        await this.accessors.decrementDebtE(100, "decrementDebt - 1");
      });

      it('sets new value', async function () {
        expect(await this.accessors.debt()).to.be.bignumber.equal(new BN(100));
      });
    });

    describe('when called erroneously', function () {
      beforeEach('call', async function () {
        await this.accessors.incrementDebtE(100);
      });

      it('reverts', async function () {
        await expectRevert(
          this.accessors.decrementDebtE(200, "decrementDebt - 1"),
          "decrementDebt - 1");
      });
    });
  });

  describe('updateBorrowController', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.updateBorrowControllerE(1234, 5678);
      });

      it('sets new value', async function () {
        const borrowController = await this.accessors.borrowControllerE();
        expect(borrowController.borrowed).to.be.bignumber.equal(new BN(1234));
        expect(borrowController.last).to.be.bignumber.equal(new BN(5678));
      });
    });
  });

  /**
   * Swapper
   */

  describe('updateOrder', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.updateOrderE(token1, token2, 100, 200);
      });

      it('sets new value', async function () {
        const order = await this.accessors.order(token1, token2);
        expect(order.price.value).to.be.bignumber.equal(new BN(100));
        expect(order.amount).to.be.bignumber.equal(new BN(200));
      });
    });
  });

  describe('decrementOrderAmount', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.accessors.updateOrderE(token1, token2, 100, 200);
        await this.accessors.decrementOrderAmountE(token1, token2, 100, "decrementOrderAmount - 1");
      });

      it('sets new value', async function () {
        const order = await this.accessors.order(token1, token2);
        expect(order.price.value).to.be.bignumber.equal(new BN(100));
        expect(order.amount).to.be.bignumber.equal(new BN(100));
      });
    });

    describe('when called erroneously', function () {
      beforeEach('call', async function () {
        await this.accessors.updateOrderE(token1, token2, 100, 200);
      });

      it('reverts', async function () {
        await expectRevert(
          this.accessors.decrementOrderAmountE(token1, token2, 300, "decrementOrderAmount - 1"),
          "decrementOrderAmount - 1");
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