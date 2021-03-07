const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockImplementation = contract.fromArtifact('MockImplementation');
const Registry = contract.fromArtifact('Registry');

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe('Implementation', function () {
  const [ ownerAddress, userAddress, newOwnerAddress, timelockA, timelockB] = accounts;

  beforeEach(async function () {
    this.implementation = await MockImplementation.new({from: ownerAddress});
    this.implementation.takeOwnership({from: ownerAddress});
    this.registryA = await Registry.new({from: ownerAddress});
    await this.registryA.setTimelock(timelockA, {from: ownerAddress});
    this.registryB = await Registry.new({from: ownerAddress});
    await this.registryB.setTimelock(timelockA, {from: ownerAddress});
    this.registryC = await Registry.new({from: ownerAddress});
    await this.registryC.setTimelock(timelockB, {from: ownerAddress});
  });

  describe('setRegistry', function () {
    describe('before set', function () {
      it('is zero address', async function () {
        expect(await this.implementation.registry()).to.be.equal(ZERO_ADDRESS);
      });

      describe('when called', function () {
        beforeEach('call', async function () {
          this.result = await this.implementation.setRegistry(this.registryA.address, {from: ownerAddress});
          this.txHash = this.result.tx
        });

        it('sets new value', async function () {
          expect(await this.implementation.registry()).to.be.equal(this.registryA.address);
        });

        it('emits RegistryUpdate event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockImplementation, 'RegistryUpdate', {
            newRegistry: this.registryA.address,
          });
        });
      });
    });

    describe('after set', function () {
      beforeEach('call', async function () {
        await this.implementation.setRegistry(this.registryA.address, {from: ownerAddress});
      });

      describe('same timelock', function () {
        beforeEach('call', async function () {
          this.result = await this.implementation.setRegistry(this.registryB.address, {from: ownerAddress});
          this.txHash = this.result.tx;
        });

        it('sets new value', async function () {
          expect(await this.implementation.registry()).to.be.equal(this.registryB.address);
        });

        it('emits RegistryUpdate event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockImplementation, 'RegistryUpdate', {
            newRegistry: this.registryB.address,
          });
        });
      });

      describe('different timelock', function () {
        it('reverts', async function () {
          await expectRevert(
            this.implementation.setRegistry(this.registryC.address, {from: ownerAddress}),
            "Implementation: timelocks must match");
        });
      });
    });

    describe('not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.implementation.setRegistry(this.registryA.address, {from: userAddress}),
          "Implementation: not owner");
      });
    });

    describe('zero address', function () {
      it('reverts', async function () {
        await expectRevert(
          this.implementation.setRegistry(ZERO_ADDRESS, {from: ownerAddress}),
          "Implementation: zero address");
      });
    });
  });

  describe('takeOwnership', function () {
    beforeEach('call', async function () {
      this.implementationFresh = await MockImplementation.new({from: ownerAddress});
    });

    describe('before initialization', function () {
      beforeEach('call', async function () {
        this.result = await this.implementationFresh.takeOwnership({from: ownerAddress});
        this.txHash = this.result.tx
      });

      it('sets new value', async function () {
        expect(await this.implementationFresh.owner()).to.be.equal(ownerAddress);
      });

      it('emits OwnerUpdate event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockImplementation, 'OwnerUpdate', {
          newOwner: ownerAddress,
        });
      });
    });

    describe('after initialization', function () {
      beforeEach('call', async function () {
        await this.implementationFresh.takeOwnership({from: ownerAddress});
      });

      it('reverts', async function () {
        await expectRevert(
          this.implementationFresh.takeOwnership({from: userAddress}),
          "Implementation: already initialized");
      });
    });
  });

  describe('setOwner', function () {
    describe('before set', function () {
      it('is zero address', async function () {
        expect(await this.implementation.owner()).to.be.equal(ownerAddress);
      });

      describe('when called', function () {
        beforeEach('call', async function () {
          this.result = await this.implementation.setOwner(newOwnerAddress, {from: ownerAddress});
          this.txHash = this.result.tx
        });

        it('sets new value', async function () {
          expect(await this.implementation.owner()).to.be.equal(newOwnerAddress);
        });

        it('emits OwnerUpdate event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockImplementation, 'OwnerUpdate', {
            newOwner: newOwnerAddress,
          });
        });
      });
    });

    describe('not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.implementation.setOwner(this.registryA.address, {from: userAddress}),
          "Implementation: not owner");
      });
    });

    describe('zero address', function () {
      it('reverts', async function () {
        await expectRevert(
          this.implementation.setOwner(ZERO_ADDRESS, {from: ownerAddress}),
          "Implementation: zero address");
      });
    });
  });
});