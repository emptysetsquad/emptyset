const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const Registry = contract.fromArtifact('Registry');

describe('Registry', function () {
  const [ ownerAddress, userAddress, testAddress] = accounts;

  beforeEach(async function () {
    this.registry = await Registry.new({from: ownerAddress});
  });

  describe('setUsdc', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setUsdc(testAddress, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.usdc()).to.be.equal(testAddress);
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setUsdc(testAddress, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });
  });

  describe('setCUsdc', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setCUsdc(testAddress, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.cUsdc()).to.be.equal(testAddress);
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setCUsdc(testAddress, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });
  });

  describe('setDollar', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setDollar(testAddress, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.dollar()).to.be.equal(testAddress);
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setDollar(testAddress, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });
  });

  describe('setStake', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setStake(testAddress, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.stake()).to.be.equal(testAddress);
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setStake(testAddress, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });
  });

  describe('setReserve', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setReserve(testAddress, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.reserve()).to.be.equal(testAddress);
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setReserve(testAddress, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });
  });

  describe('setStabilizer', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setStabilizer(testAddress, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.stabilizer()).to.be.equal(testAddress);
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setStabilizer(testAddress, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });
  });

  describe('setOracle', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setOracle(testAddress, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.oracle()).to.be.equal(testAddress);
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setOracle(testAddress, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });
  });

  describe('setGovernor', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setGovernor(testAddress, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.governor()).to.be.equal(testAddress);
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setGovernor(testAddress, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });
  });

  describe('setTimelock', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setTimelock(testAddress, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.timelock()).to.be.equal(testAddress);
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setTimelock(testAddress, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });
  });

  describe('setMigrator', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setMigrator(testAddress, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.migrator()).to.be.equal(testAddress);
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setMigrator(testAddress, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });
  });
});