const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const Registry = contract.fromArtifact('Registry');
const MockContract = contract.fromArtifact('MockContract');

describe('Registry', function () {
  const [ ownerAddress, userAddress, testAddress] = accounts;

  beforeEach(async function () {
    this.testContract = await MockContract.new({from: ownerAddress});
    this.registry = await Registry.new({from: ownerAddress});
  });

  describe('setUsdc', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setUsdc(this.testContract.address, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.usdc()).to.be.equal(this.testContract.address);
      });
    });

    describe('when not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setUsdc(this.testContract.address, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when not contract', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setUsdc(testAddress, {from: ownerAddress}),
          "Registry: not contract");
      });
    });
  });

  describe('setCUsdc', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setCUsdc(this.testContract.address, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.cUsdc()).to.be.equal(this.testContract.address);
      });
    });

    describe('when not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setCUsdc(this.testContract.address, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when not contract', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setCUsdc(testAddress, {from: ownerAddress}),
          "Registry: not contract");
      });
    });
  });

  describe('setDollar', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setDollar(this.testContract.address, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.dollar()).to.be.equal(this.testContract.address);
      });
    });

    describe('when not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setDollar(this.testContract.address, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when not contract', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setDollar(testAddress, {from: ownerAddress}),
          "Registry: not contract");
      });
    });
  });

  describe('setStake', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setStake(this.testContract.address, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.stake()).to.be.equal(this.testContract.address);
      });
    });

    describe('when not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setStake(this.testContract.address, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when not contract', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setStake(testAddress, {from: ownerAddress}),
          "Registry: not contract");
      });
    });
  });

  describe('setReserve', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setReserve(this.testContract.address, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.reserve()).to.be.equal(this.testContract.address);
      });
    });

    describe('when not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setReserve(this.testContract.address, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when not contract', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setReserve(testAddress, {from: ownerAddress}),
          "Registry: not contract");
      });
    });
  });

  describe('setStabilizer', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setStabilizer(this.testContract.address, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.stabilizer()).to.be.equal(this.testContract.address);
      });
    });

    describe('when not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setStabilizer(this.testContract.address, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when not contract', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setStabilizer(testAddress, {from: ownerAddress}),
          "Registry: not contract");
      });
    });
  });

  describe('setOracle', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setOracle(this.testContract.address, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.oracle()).to.be.equal(this.testContract.address);
      });
    });

    describe('when not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setOracle(this.testContract.address, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when not contract', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setOracle(testAddress, {from: ownerAddress}),
          "Registry: not contract");
      });
    });
  });

  describe('setGovernor', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setGovernor(this.testContract.address, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.governor()).to.be.equal(this.testContract.address);
      });
    });

    describe('when not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setGovernor(this.testContract.address, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when not contract', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setGovernor(testAddress, {from: ownerAddress}),
          "Registry: not contract");
      });
    });
  });

  describe('setTimelock', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setTimelock(this.testContract.address, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.timelock()).to.be.equal(this.testContract.address);
      });
    });

    describe('when not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setTimelock(this.testContract.address, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when not contract', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setTimelock(testAddress, {from: ownerAddress}),
          "Registry: not contract");
      });
    });
  });

  describe('setMigrator', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.registry.setMigrator(this.testContract.address, {from: ownerAddress});
      });

      it('sets new value', async function () {
        expect(await this.registry.migrator()).to.be.equal(this.testContract.address);
      });
    });

    describe('when not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setMigrator(this.testContract.address, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when not contract', function () {
      it('reverts', async function () {
        await expectRevert(
          this.registry.setMigrator(testAddress, {from: ownerAddress}),
          "Registry: not contract");
      });
    });
  });
});