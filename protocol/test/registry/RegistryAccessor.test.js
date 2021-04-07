const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const RegistryAccessor = contract.fromArtifact('RegistryAccessor');
const Registry = contract.fromArtifact('Registry');
const Timelock = contract.fromArtifact('Timelock');

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe('RegistryAccessor', function () {
  const [ ownerAddress, userAddress] = accounts;

  beforeEach(async function () {
    this.timelockA = await Timelock.new(ownerAddress, 86400 * 2, {from: ownerAddress});
    this.timelockB = await Timelock.new(ownerAddress, 86400 * 2, {from: ownerAddress});

    this.accessor = await RegistryAccessor.new({from: ownerAddress});
    
    this.registryA = await Registry.new({from: ownerAddress});
    await this.registryA.setTimelock(this.timelockA.address, {from: ownerAddress});
    this.registryB = await Registry.new({from: ownerAddress});
    await this.registryB.setTimelock(this.timelockA.address, {from: ownerAddress});
    this.registryC = await Registry.new({from: ownerAddress});
    await this.registryC.setTimelock(this.timelockB.address, {from: ownerAddress});
  });

  describe('setRegistry', function () {
    describe('before set', function () {
      it('is zero address', async function () {
        expect(await this.accessor.registry()).to.be.equal(ZERO_ADDRESS);
      });

      describe('when called', function () {
        beforeEach('call', async function () {
          this.result = await this.accessor.setRegistry(this.registryA.address, {from: ownerAddress});
          this.txHash = this.result.tx
        });

        it('sets new value', async function () {
          expect(await this.accessor.registry()).to.be.equal(this.registryA.address);
        });

        it('emits RegistryUpdate event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, RegistryAccessor, 'RegistryUpdate', {
            newRegistry: this.registryA.address,
          });
        });
      });
    });

    describe('after set', function () {
      beforeEach('call', async function () {
        await this.accessor.setRegistry(this.registryA.address, {from: ownerAddress});
      });

      describe('same timelock', function () {
        beforeEach('call', async function () {
          this.result = await this.accessor.setRegistry(this.registryB.address, {from: ownerAddress});
          this.txHash = this.result.tx;
        });

        it('sets new value', async function () {
          expect(await this.accessor.registry()).to.be.equal(this.registryB.address);
        });

        it('emits RegistryUpdate event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, RegistryAccessor, 'RegistryUpdate', {
            newRegistry: this.registryB.address,
          });
        });
      });

      describe('different timelock', function () {
        it('reverts', async function () {
          await expectRevert(
            this.accessor.setRegistry(this.registryC.address, {from: ownerAddress}),
            "RegistryAccessor: timelocks must match");
        });
      });
    });

    describe('not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.accessor.setRegistry(this.registryA.address, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('zero address', function () {
      it('reverts', async function () {
        await expectRevert(
          this.accessor.setRegistry(ZERO_ADDRESS, {from: ownerAddress}),
          "RegistryAccessor: zero address");
      });
    });
  });
});