const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockV1Dollar = contract.fromArtifact('MockV1Dollar');
const Stake = contract.fromArtifact('Stake');
const MockV1DAO = contract.fromArtifact('MockV1DAO');
const Migrator = contract.fromArtifact('Migrator');
const Registry = contract.fromArtifact('Registry');
const MockContract = contract.fromArtifact('MockContract');

const ONE_BIP = new BN(10).pow(new BN(14));
const ONE_UNIT = ONE_BIP.mul(new BN(10000));

describe('Migrator', function () {
  this.timeout(5000);

  const [ ownerAddress, userAddress1, userAddress2, userAddress3 ] = accounts;

  beforeEach(async function () {
    this.ratio = new BN(10).pow(new BN(19)) // 10:1 ESDS:ESD
    this.dollar = await MockV1Dollar.new({from: ownerAddress});
    this.stake = await Stake.new({from: ownerAddress});
    this.dao = await MockV1DAO.new({from: ownerAddress});
    this.registry = await Registry.new({from: ownerAddress});
    this.reserve = await MockContract.new({from: ownerAddress});
    this.migrator = await Migrator.new(this.ratio, this.dao.address, this.dollar.address, this.registry.address, {from: ownerAddress});
    await this.registry.setStake(this.stake.address, {from: ownerAddress});
    await this.registry.setReserve(this.reserve.address, {from: ownerAddress});
  });

  describe('initialize', function () {
    describe('before call', function () {
      it('is paused', async function () {
        expect(await this.migrator.paused()).to.be.equal(true);
      });
    });

    describe('when called', function () {
      beforeEach(async function () {
        await this.dollar.mint(userAddress3, ONE_UNIT.muln(100000), {from: ownerAddress});
        await this.dao.set(ONE_UNIT.muln(50000));
        await this.dao.addUserBalance(userAddress1, ONE_UNIT.muln(1000000));
        await this.dao.addUserBalance(userAddress2, ONE_UNIT.muln(2500000));
      });

      it('has outstanding stake', async function () {
        expect(await this.migrator.outstandingStake()).to.be.bignumber.equal(ONE_UNIT.muln(5000000));
      });

      describe('insufficient stake', function () {
        it('reverts', async function () {
          await expectRevert(
            this.migrator.initialize({from: ownerAddress}),
            "Migrator: insufficient funds");
        });
      });

      describe('stake', function () {
        beforeEach(async function () {
          await this.stake.mint(ONE_UNIT.muln(5000000), {from: ownerAddress});
          await this.stake.transfer(this.migrator.address, ONE_UNIT.muln(5000000), {from: ownerAddress});
        });

        describe('not owner', function () {
          it('reverts', async function () {
            await expectRevert(
              this.migrator.initialize({from: userAddress1}),
              "Ownable: caller is not the owner");
          });
        });

        describe('owner', function () {
          beforeEach(async function () {
            this.result = await this.migrator.initialize({from: ownerAddress});
            this.txHash = this.result.tx;
          });

          it('unpauses', async function () {
            expect(await this.migrator.paused()).to.be.equal(false);
          });

          it('emits Initialized event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, Migrator, 'Initialized', {
              owner: ownerAddress
            });

            expect(event.args.outstandingStake).to.be.bignumber.equal(ONE_UNIT.mul(new BN(5000000)));
          });
        });
      });
    });
  });

  describe('withdraw', function () {
    beforeEach(async function () {
      await this.dollar.mint(userAddress3, ONE_UNIT.muln(100000), {from: ownerAddress});
      await this.dao.set(ONE_UNIT.muln(50000));
      await this.dao.addUserBalance(userAddress1, ONE_UNIT.muln(1000000));
      await this.dao.addUserBalance(userAddress2, ONE_UNIT.muln(2500000));

      await this.stake.mint(ONE_UNIT.muln(5000000), {from: ownerAddress});
      await this.stake.transfer(this.migrator.address, ONE_UNIT.muln(5000000), {from: ownerAddress});
    });

    it('has outstanding stake', async function () {
      expect(await this.migrator.outstandingStake()).to.be.bignumber.equal(ONE_UNIT.muln(5000000));
    });

    describe('insufficient stake', function () {
      it('reverts', async function () {
        await expectRevert(
          this.migrator.withdraw( ONE_UNIT.muln(1000), {from: ownerAddress}),
          "Migrator: insufficient funds");
      });
    });

    describe('stake', function () {
      beforeEach(async function () {
        await this.stake.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
        await this.stake.transfer(this.migrator.address, ONE_UNIT.muln(1000), {from: ownerAddress});
      });

      describe('not owner', function () {
        it('reverts', async function () {
          await expectRevert(
            this.migrator.withdraw(ONE_UNIT.muln(1000), {from: userAddress1}),
            "Ownable: caller is not the owner");
        });
      });

      describe('owner', function () {
        beforeEach(async function () {
          this.result = await this.migrator.withdraw(ONE_UNIT.muln(1000), {from: ownerAddress})
          this.txHash = this.result.tx;
        });

        it('transfers', async function () {
          expect(await this.stake.balanceOf(this.migrator.address)).to.be.bignumber.equal(ONE_UNIT.muln(5000000));
          expect(await this.stake.balanceOf(this.reserve.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
        });

        it('emits Withdrawal event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Migrator, 'Withdrawal', {
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000)));
        });
      });
    });
  });

  describe('migrate', function () {
    beforeEach(async function () {
      await this.dollar.mint(userAddress1, ONE_UNIT.muln(25000), {from: ownerAddress});
      await this.dollar.mint(userAddress2, ONE_UNIT.muln(75000), {from: ownerAddress});
      await this.dao.set(ONE_UNIT.muln(50000));
      await this.dao.addUserBalance(userAddress1, ONE_UNIT.muln(1000000));
      await this.dao.addUserBalance(userAddress2, ONE_UNIT.muln(2500000));

      await this.stake.mint(ONE_UNIT.muln(5000000), {from: ownerAddress});
      await this.stake.transfer(this.migrator.address, ONE_UNIT.muln(5000000), {from: ownerAddress});
      await this.migrator.initialize({from: ownerAddress});

      this.stakeTotalSupply = await this.stake.totalSupply();
    });

    describe('single', function () {
      beforeEach(async function () {
        this.dollar.approve(this.migrator.address, ONE_UNIT.muln(25000), {from: userAddress1});
        this.result = await this.migrator.migrate(ONE_UNIT.muln(25000), ONE_UNIT.muln(1000000), {from: userAddress1});
        this.txHash = this.result.tx;
      });

      it('migrates', async function () {
        expect(await this.dollar.balanceOf(userAddress1)).to.be.bignumber.equal(new BN(0));
        expect(await this.dollar.balanceOf(this.migrator.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.dollar.totalSupply()).to.be.bignumber.equal(ONE_UNIT.muln(75000));
        expect(await this.dao.balanceOf(userAddress1)).to.be.bignumber.equal(new BN(0));
        expect(await this.dao.totalSupply()).to.be.bignumber.equal(ONE_UNIT.muln(2500000));
        expect(await this.stake.balanceOf(userAddress1)).to.be.bignumber.equal(ONE_UNIT.muln(1250000));
        expect(await this.stake.balanceOf(this.migrator.address)).to.be.bignumber.equal(ONE_UNIT.muln(3750000));
        expect(await this.stake.totalSupply()).to.be.bignumber.equal(this.stakeTotalSupply);
      });

      it('emits Migration event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, Migrator, 'Migration', {
          account: userAddress1
        });

        expect(event.args.dollarAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(25000)));
        expect(event.args.stakeAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000000)));
      });
    });

    describe('partial', function () {
      beforeEach(async function () {
        this.dollar.approve(this.migrator.address, ONE_UNIT.muln(10000), {from: userAddress1});
        this.result = await this.migrator.migrate(ONE_UNIT.muln(10000), ONE_UNIT.muln(500000), {from: userAddress1});
        this.txHash = this.result.tx;
      });

      it('migrates', async function () {
        expect(await this.dollar.balanceOf(userAddress1)).to.be.bignumber.equal(ONE_UNIT.muln(15000));
        expect(await this.dollar.balanceOf(this.migrator.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.dollar.totalSupply()).to.be.bignumber.equal(ONE_UNIT.muln(90000));
        expect(await this.dao.balanceOf(userAddress1)).to.be.bignumber.equal(ONE_UNIT.muln(500000));
        expect(await this.dao.totalSupply()).to.be.bignumber.equal(ONE_UNIT.muln(3000000));
        expect(await this.stake.balanceOf(userAddress1)).to.be.bignumber.equal(ONE_UNIT.muln(600000));
        expect(await this.stake.balanceOf(this.migrator.address)).to.be.bignumber.equal(ONE_UNIT.muln(4400000));
        expect(await this.stake.totalSupply()).to.be.bignumber.equal(this.stakeTotalSupply);
      });

      it('emits Migration event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, Migrator, 'Migration', {
          account: userAddress1
        });

        expect(event.args.dollarAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(10000)));
        expect(event.args.stakeAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(500000)));
      });
    });

    describe('complete', function () {
      beforeEach(async function () {
        await this.dao.set(new BN(0));
        await this.migrator.withdraw(ONE_UNIT.muln(500000), {from: ownerAddress});

        await this.dollar.approve(this.migrator.address, ONE_UNIT.muln(75000), {from: userAddress2});
        await this.migrator.migrate(ONE_UNIT.muln(75000), ONE_UNIT.muln(2500000), {from: userAddress2});

        await this.dollar.approve(this.migrator.address, ONE_UNIT.muln(25000), {from: userAddress1});
        this.result = await this.migrator.migrate(ONE_UNIT.muln(25000), ONE_UNIT.muln(1000000), {from: userAddress1});
        this.txHash = this.result.tx;
      });

      it('migrates', async function () {
        expect(await this.dollar.balanceOf(userAddress1)).to.be.bignumber.equal(new BN(0));
        expect(await this.dollar.balanceOf(userAddress2)).to.be.bignumber.equal(new BN(0));
        expect(await this.dollar.balanceOf(this.migrator.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(0));
        expect(await this.dao.balanceOf(userAddress1)).to.be.bignumber.equal(new BN(0));
        expect(await this.dao.balanceOf(userAddress2)).to.be.bignumber.equal(new BN(0));
        expect(await this.dao.totalSupply()).to.be.bignumber.equal(new BN(0));
        expect(await this.stake.balanceOf(userAddress1)).to.be.bignumber.equal(ONE_UNIT.muln(1250000));
        expect(await this.stake.balanceOf(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(3250000));
        expect(await this.stake.balanceOf(this.migrator.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.stake.totalSupply()).to.be.bignumber.equal(this.stakeTotalSupply);
      });

      it('emits Migration event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, Migrator, 'Migration', {
          account: userAddress1
        });

        expect(event.args.dollarAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(25000)));
        expect(event.args.stakeAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000000)));
      });
    });
  });
});