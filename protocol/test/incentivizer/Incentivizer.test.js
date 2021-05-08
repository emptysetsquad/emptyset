const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const Stake = contract.fromArtifact('Stake');
const MockToken = contract.fromArtifact('MockToken');
const Incentivizer = contract.fromArtifact('Incentivizer');

const ONE_BIP = new BN(10).pow(new BN(14));
const ONE_UNIT = ONE_BIP.mul(new BN(10000));

/**
 * audit-info: Due to Ganache's handling of timestamps, tests are very flaky. Multiple retries of failed tests
 *             are likely required in order for all tests to pass
 */
describe('Incentivizer', function () {
  this.retries(10);
  this.timeout(5000);

  const [ ownerAddress, userAddress, userAddress2, reserveAddress ] = accounts;

  beforeEach(async function () {
    this.underlying = await MockToken.new("Uniswap V2", "UNI-V2", 18, {from: ownerAddress});
    this.reward = await Stake.new({from: ownerAddress});
    this.incentivizer = await Incentivizer.new(this.underlying.address, this.reward.address, reserveAddress, {from: ownerAddress});
  });

  describe('rescue', function () {
    beforeEach(async function () {
      await this.reward.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
      await this.reward.transfer(this.incentivizer.address, ONE_UNIT.muln(1000), {from: ownerAddress});
    });

    describe('not owner', function () {
      it('reverts', async function () {
        await expectRevert(
          this.incentivizer.rescue(this.reward.address, ONE_UNIT.muln(1000), {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('underlying', function () {
      beforeEach(async function () {
        await this.underlying.mint(userAddress, ONE_UNIT.muln(1000));
        await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress});
        await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress});
      });

      it('reverts', async function () {
        await expectRevert(
          this.incentivizer.rescue(this.underlying.address, ONE_UNIT.muln(1000), {from: ownerAddress}),
          "Incentivizer: insufficient underlying");
      });

      describe('excess', function () {
        beforeEach(async function () {
          await this.underlying.mint(this.incentivizer.address, ONE_UNIT.muln(100));
          this.result = await this.incentivizer.rescue(this.underlying.address, ONE_UNIT.muln(100), {from: ownerAddress})
          this.txHash = this.result.tx;
        });

        it('transfers', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.underlying.balanceOf(reserveAddress)).to.be.bignumber.equal(ONE_UNIT.muln(100));
        });

        it('emits Rescue event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Rescue', {
            token: this.underlying.address
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100)));
        });
      });
    });

    describe('simple', function () {
      beforeEach(async function () {
        this.result = await this.incentivizer.rescue(this.reward.address, ONE_UNIT.muln(1000), {from: ownerAddress})
        this.txHash = this.result.tx;
      });

      it('transfers', async function () {
        expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.reward.balanceOf(reserveAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
      });

      it('emits Rescue event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Rescue', {
          token: this.reward.address
        });

        expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000)));
      });
    });

    describe('insufficient reward', function () {
      beforeEach(async function () {
        const now = await time.latest();
        await this.incentivizer.updateRewardProgram(ONE_UNIT, now.addn(1000), {from: ownerAddress})
      });

      it('reverts', async function () {
        await expectRevert(
          this.incentivizer.rescue(this.reward.address, ONE_UNIT.muln(1000), {from: ownerAddress}),
          "Incentivizer: insufficient rewards");
      });
    });
  });

  describe('updateRewardProgram', function () {
    beforeEach(async function () {
      await this.reward.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
      await this.reward.transfer(this.incentivizer.address, ONE_UNIT.muln(1000), {from: ownerAddress});
    });

    describe('not owner', function () {
      it('reverts', async function () {
        const now = await time.latest();
        await expectRevert(
          this.incentivizer.updateRewardProgram(ONE_UNIT, now.addn(1000), {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('insufficient reward', function () {
      it('reverts', async function () {
        const now = await time.latest();
        await expectRevert(
          this.incentivizer.updateRewardProgram(ONE_UNIT, now.addn(2000), {from: ownerAddress}),
          "Incentivizer: insufficient rewards");
      });
    });

    describe('simple', function () {
      beforeEach(async function () {
        this.now = await time.latest();
        this.completed = this.now.addn(1000);
        this.result = await this.incentivizer.updateRewardProgram(ONE_UNIT, this.completed, {from: ownerAddress});
        this.txHash = this.result.tx;
      });

      it('updates', async function () {
        expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
        expect(await this.reward.balanceOf(ownerAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.incentivizer.rewardRate()).to.be.bignumber.equal(ONE_UNIT);
        expect(await this.incentivizer.rewardComplete()).to.be.bignumber.equal(this.completed);
        expect(await this.incentivizer.rewardUpdated()).to.be.bignumber.equal(this.now);
        expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(new BN(0));
        expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(1000));
      });

      it('emits RewardProgramUpdate event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'RewardProgramUpdate', {
        });

        expect(event.args.rate).to.be.bignumber.equal(ONE_UNIT);
        expect(event.args.complete).to.be.bignumber.equal(this.completed);
      });
    });

    describe('excess', function () {
      beforeEach(async function () {
        this.now = await time.latest();
        this.completed = this.now.addn(500);
        this.result = await this.incentivizer.updateRewardProgram(ONE_UNIT, this.completed, {from: ownerAddress});
        this.txHash = this.result.tx;
      });

      it('updates', async function () {
        expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(500));
        expect(await this.reward.balanceOf(reserveAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
        expect(await this.incentivizer.rewardRate()).to.be.bignumber.equal(ONE_UNIT);
        expect(await this.incentivizer.rewardComplete()).to.be.bignumber.equal(this.completed);
        expect(await this.incentivizer.rewardUpdated()).to.be.bignumber.equal(this.now);
        expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(new BN(0));
        expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(500));
      });

      it('emits RewardProgramUpdate event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'RewardProgramUpdate', {
        });

        expect(event.args.rate).to.be.bignumber.equal(ONE_UNIT);
        expect(event.args.complete).to.be.bignumber.equal(this.completed);
      });
    });

    describe('while ongoing', function () {
      describe('zero balance', function () {
        beforeEach(async function () {
          this.now = await time.latest();
          this.completed = this.now.addn(900);

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});
          await time.increase(100);

          this.result = await this.incentivizer.updateRewardProgram(ONE_UNIT, this.completed, {from: ownerAddress});
          this.txHash = this.result.tx;
        });

        it('updates', async function () {
          expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(800));
          expect(await this.reward.balanceOf(reserveAddress)).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(await this.incentivizer.rewardRate()).to.be.bignumber.equal(ONE_UNIT);
          expect(await this.incentivizer.rewardComplete()).to.be.bignumber.equal(this.completed);
          expect(await this.incentivizer.rewardUpdated()).to.be.bignumber.equal(this.now.addn(100));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(800));
        });

        it('emits RewardProgramUpdate event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'RewardProgramUpdate', {
          });

          expect(event.args.rate).to.be.bignumber.equal(ONE_UNIT);
          expect(event.args.complete).to.be.bignumber.equal(this.completed);
        });
      });

      describe('with balance', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress, ONE_UNIT);
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT, {from: userAddress});
          await this.incentivizer.stake(ONE_UNIT, {from: userAddress});

          this.now = await time.latest();
          this.completed = this.now.addn(900);

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});
          await time.increase(100);

          this.result = await this.incentivizer.updateRewardProgram(ONE_UNIT, this.completed, {from: ownerAddress});
          this.txHash = this.result.tx;
        });

        it('updates', async function () {
          expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.reward.balanceOf(ownerAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.rewardRate()).to.be.bignumber.equal(ONE_UNIT);
          expect(await this.incentivizer.rewardComplete()).to.be.bignumber.equal(this.completed);
          expect(await this.incentivizer.rewardUpdated()).to.be.bignumber.equal(this.now.addn(100));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(800));
        });

        it('emits RewardProgramUpdate event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'RewardProgramUpdate', {
          });

          expect(event.args.rate).to.be.bignumber.equal(ONE_UNIT);
          expect(event.args.complete).to.be.bignumber.equal(this.completed);
        });
      });
    });

    describe('after complete', function () {
      describe('zero balance', function () {
        beforeEach(async function () {
          this.now = await time.latest();
          this.completed = this.now.addn(2000);

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});
          await time.increase(1000);

          await this.reward.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
          await this.reward.transfer(this.incentivizer.address, ONE_UNIT.muln(1000), {from: ownerAddress});

          this.result = await this.incentivizer.updateRewardProgram(ONE_UNIT, this.completed, {from: ownerAddress});
          this.txHash = this.result.tx;
        });

        it('updates', async function () {
          expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.reward.balanceOf(reserveAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.rewardRate()).to.be.bignumber.equal(ONE_UNIT);
          expect(await this.incentivizer.rewardComplete()).to.be.bignumber.equal(this.completed);
          expect(await this.incentivizer.rewardUpdated()).to.be.bignumber.equal(this.now.addn(1000));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(1000));
        });

        it('emits RewardProgramUpdate event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'RewardProgramUpdate', {
          });

          expect(event.args.rate).to.be.bignumber.equal(ONE_UNIT);
          expect(event.args.complete).to.be.bignumber.equal(this.completed);
        });
      });

      describe('with balance', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress, ONE_UNIT);
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT, {from: userAddress});
          await this.incentivizer.stake(ONE_UNIT, {from: userAddress});

          this.now = await time.latest();
          this.completed = this.now.addn(2000);

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});
          await time.increase(1000);

          await this.reward.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
          await this.reward.transfer(this.incentivizer.address, ONE_UNIT.muln(1000), {from: ownerAddress});

          this.result = await this.incentivizer.updateRewardProgram(ONE_UNIT, this.completed, {from: ownerAddress});
          this.txHash = this.result.tx;
        });

        it('updates', async function () {
          expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(2000));
          expect(await this.reward.balanceOf(ownerAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.rewardRate()).to.be.bignumber.equal(ONE_UNIT);
          expect(await this.incentivizer.rewardComplete()).to.be.bignumber.equal(this.completed);
          expect(await this.incentivizer.rewardUpdated()).to.be.bignumber.equal(this.now.addn(1000));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(1000));
        });

        it('emits RewardProgramUpdate event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'RewardProgramUpdate', {
          });

          expect(event.args.rate).to.be.bignumber.equal(ONE_UNIT);
          expect(event.args.complete).to.be.bignumber.equal(this.completed);
        });
      });
    });
  });

  describe('separate tokens', function () {
    describe('stake', function () {
      beforeEach(async function () {
        await this.underlying.mint(userAddress, ONE_UNIT.muln(1000));
        await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress});
      });

      describe('simple', function () {
        beforeEach(async function () {
          this.result = await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('stakes', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(new BN(0));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(new BN(0));
          expect(event.args.newReward).to.be.bignumber.equal(new BN(0));
          expect(event.args.updated).to.be.bignumber.equal(new BN(0));
        });

        it('emits Stake event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Stake', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(1000));
        });
      });

      describe('advanced', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
          await this.reward.transfer(this.incentivizer.address, ONE_UNIT.muln(1000), {from: ownerAddress});

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          this.result = await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});
          this.txHash = this.result.tx;

          await time.increase(150);
        });

        it('stakes', async function () {
          expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1500));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(100));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(ONE_UNIT.muln(1500));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(800));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(2000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(100));
        });

        it('emits Stake event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Stake', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(500));
        });
      });

      describe('complete', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
          await this.reward.transfer(this.incentivizer.address, ONE_UNIT.muln(1000), {from: ownerAddress});

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(200);

          this.result = await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});
          this.txHash = this.result.tx;

          await time.increase(500);
        });

        it('stakes', async function () {
          expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1500));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(800));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(ONE_UNIT.muln(1500));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(600));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(4000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(200));
        });

        it('emits Stake event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Stake', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(500));
        });
      });
    });

    describe('withdraw', function () {
      beforeEach(async function () {
        await this.underlying.mint(userAddress, ONE_UNIT.muln(1000));
        await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress});
      });

      describe('simple', function () {
        beforeEach(async function () {
          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress});

          this.result = await this.incentivizer.withdraw(ONE_UNIT.muln(1000), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('withdraws', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(new BN(0));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(new BN(0));
          expect(event.args.newReward).to.be.bignumber.equal(new BN(0));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now));
        });

        it('emits Withdrawal event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Withdrawal', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(1000));
        });
      });

      describe('advanced', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
          await this.reward.transfer(this.incentivizer.address, ONE_UNIT.muln(1000), {from: ownerAddress});

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});

          await time.increase(150);

          await this.incentivizer.withdraw(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          this.result = await this.incentivizer.withdraw(ONE_UNIT.muln(500), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('withdraws', async function () {
          expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(300));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(700));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(300));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(8000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(350));
        });

        it('emits Withdrawal event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Withdrawal', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(500));
        });
      });

      describe('complete', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
          await this.reward.transfer(this.incentivizer.address, ONE_UNIT.muln(1000), {from: ownerAddress});

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});

          await time.increase(150);

          await this.incentivizer.withdraw(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          this.result = await this.incentivizer.withdraw(ONE_UNIT.muln(500), {from: userAddress});
          this.txHash = this.result.tx;

          await time.increase(500);
        });

        it('withdraws', async function () {
          expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(300));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(700));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(300));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(8000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(350));
        });

        it('emits Withdrawal event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Withdrawal', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(500));
        });
      });
    });

    describe('claim', function () {
      beforeEach(async function () {
        await this.underlying.mint(userAddress, ONE_UNIT.muln(1000));
        await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress});
      });

      describe('simple', function () {
        beforeEach(async function () {
          await this.reward.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
          await this.reward.transfer(this.incentivizer.address, ONE_UNIT.muln(1000), {from: ownerAddress});

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress});

          await time.increase(100);

          this.result = await this.incentivizer.claim({from: userAddress});
          this.txHash = this.result.tx;
        });

        it('claims', async function () {
          expect(await this.reward.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(800));
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(800));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(2000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(100));
        });

        it('emits Claim event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Claim', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(200));
        });
      });

      describe('advanced', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
          await this.reward.transfer(this.incentivizer.address, ONE_UNIT.muln(1000), {from: ownerAddress});

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});

          await time.increase(150);

          await this.incentivizer.withdraw(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          this.result = await this.incentivizer.claim({from: userAddress});
          this.txHash = this.result.tx;
        });

        it('claims', async function () {
          expect(await this.reward.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(300));
          expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(700));
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(300));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(8000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(350));
        });

        it('emits Claim event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Claim', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(300));
        });
      });

      describe('complete', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
          await this.reward.transfer(this.incentivizer.address, ONE_UNIT.muln(1000), {from: ownerAddress});

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});

          await time.increase(150);

          await this.incentivizer.withdraw(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(500);

          this.result = await this.incentivizer.claim({from: userAddress});
          this.txHash = this.result.tx;
        });

        it('claims', async function () {
          expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(new BN(0));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(14000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(500));
        });

        it('emits Claim event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Claim', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(600));
        });
      });
    });

    describe('exit', function () {
      beforeEach(async function () {
        await this.underlying.mint(userAddress, ONE_UNIT.muln(1000));
        await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress});
      });

      describe('simple', function () {
        beforeEach(async function () {
          await this.reward.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
          await this.reward.transfer(this.incentivizer.address, ONE_UNIT.muln(1000), {from: ownerAddress});

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress});

          await time.increase(100);

          this.result = await this.incentivizer.exit({from: userAddress});
          this.txHash = this.result.tx;
        });

        it('exits', async function () {
          expect(await this.reward.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(800));
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(800));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(2000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(100));
        });

        it('emits Withdrawal event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Withdrawal', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(1000));
        });

        it('emits Claim event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Claim', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(200));
        });
      });

      describe('advanced', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
          await this.reward.transfer(this.incentivizer.address, ONE_UNIT.muln(1000), {from: ownerAddress});

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});

          await time.increase(150);

          await this.incentivizer.withdraw(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          this.result = await this.incentivizer.exit({from: userAddress});
          this.txHash = this.result.tx;
        });

        it('claims', async function () {
          expect(await this.reward.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(300));
          expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(700));
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(300));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(8000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(350));
        });

        it('emits Withdrawal event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Withdrawal', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(500));
        });

        it('emits Claim event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Claim', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(300));
        });
      });

      describe('complete', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(ONE_UNIT.muln(1000), {from: ownerAddress});
          await this.reward.transfer(this.incentivizer.address, ONE_UNIT.muln(1000), {from: ownerAddress});

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});

          await time.increase(150);

          await this.incentivizer.withdraw(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(500);

          this.result = await this.incentivizer.exit({from: userAddress});
          this.txHash = this.result.tx;
        });

        it('claims', async function () {
          expect(await this.reward.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(new BN(0));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(14000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(500));
        });

        it('emits Withdrawal event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Withdrawal', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(500));
        });

        it('emits Claim event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Claim', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(600));
        });
      });
    });
  });

  describe('same tokens', function () {
    beforeEach(async function () {
      this.underlying = await MockToken.new("Empty Set Dollar", "ESD", 18, {from: ownerAddress});
      this.reward = this.underlying;
      this.incentivizer = await Incentivizer.new(this.underlying.address, this.reward.address, reserveAddress, {from: ownerAddress});
    });

    describe('stake', function () {
      beforeEach(async function () {
        await this.underlying.mint(userAddress, ONE_UNIT.muln(1000));
        await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress});
      });

      describe('simple', function () {
        beforeEach(async function () {
          this.result = await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('stakes', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(new BN(0));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(new BN(0));
          expect(event.args.newReward).to.be.bignumber.equal(new BN(0));
          expect(event.args.updated).to.be.bignumber.equal(new BN(0));
        });

        it('emits Stake event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Stake', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(1000));
        });
      });

      describe('advanced', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(this.incentivizer.address, ONE_UNIT.muln(1000));

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          this.result = await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});
          this.txHash = this.result.tx;

          await time.increase(150);
        });

        it('stakes', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000 + 1500));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(100));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(ONE_UNIT.muln(1500));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(800));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(2000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(100));
        });

        it('emits Stake event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Stake', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(500));
        });
      });

      describe('complete', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(this.incentivizer.address, ONE_UNIT.muln(1000));

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(200);

          this.result = await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});
          this.txHash = this.result.tx;

          await time.increase(500);
        });

        it('stakes', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000 + 1500));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(800));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(ONE_UNIT.muln(1500));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(600));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(4000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(200));
        });

        it('emits Stake event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Stake', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(500));
        });
      });
    });

    describe('withdraw', function () {
      beforeEach(async function () {
        await this.underlying.mint(userAddress, ONE_UNIT.muln(1000));
        await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress});
      });

      describe('simple', function () {
        beforeEach(async function () {
          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress});

          this.result = await this.incentivizer.withdraw(ONE_UNIT.muln(1000), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('withdraws', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(new BN(0));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(new BN(0));
          expect(event.args.newReward).to.be.bignumber.equal(new BN(0));
          expect(event.args.updated).to.be.bignumber.equal(new BN(0));
        });

        it('emits Withdrawal event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Withdrawal', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(1000));
        });
      });

      describe('advanced', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(this.incentivizer.address, ONE_UNIT.muln(1000));

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});

          await time.increase(150);

          await this.incentivizer.withdraw(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          this.result = await this.incentivizer.withdraw(ONE_UNIT.muln(500), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('withdraws', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000 + 0));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(300));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(700));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(300));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(8000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(350));
        });

        it('emits Withdrawal event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Withdrawal', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(500));
        });
      });

      describe('complete', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(this.incentivizer.address, ONE_UNIT.muln(1000));

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});

          await time.increase(150);

          await this.incentivizer.withdraw(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          this.result = await this.incentivizer.withdraw(ONE_UNIT.muln(500), {from: userAddress});
          this.txHash = this.result.tx;

          await time.increase(500);
        });

        it('withdraws', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(1000 + 0));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(300));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(700));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(300));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(8000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(350));
        });

        it('emits Withdrawal event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Withdrawal', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(500));
        });
      });
    });

    describe('claim', function () {
      beforeEach(async function () {
        await this.underlying.mint(userAddress, ONE_UNIT.muln(1000));
        await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress});
      });

      describe('simple', function () {
        beforeEach(async function () {
          await this.reward.mint(this.incentivizer.address, ONE_UNIT.muln(1000));

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress});

          await time.increase(100);

          this.result = await this.incentivizer.claim({from: userAddress});
          this.txHash = this.result.tx;
        });

        it('claims', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(800 + 1000));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(800));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(2000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(100));
        });

        it('emits Claim event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Claim', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(200));
        });
      });

      describe('advanced', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(this.incentivizer.address, ONE_UNIT.muln(1000));

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});

          await time.increase(150);

          await this.incentivizer.withdraw(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          this.result = await this.incentivizer.claim({from: userAddress});
          this.txHash = this.result.tx;
        });

        it('claims', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(700 + 500));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(300 + 500));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(300));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(8000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(350));
        });

        it('emits Claim event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Claim', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(300));
        });
      });

      describe('complete', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(this.incentivizer.address, ONE_UNIT.muln(1000));

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});

          await time.increase(150);

          await this.incentivizer.withdraw(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(500);

          this.result = await this.incentivizer.claim({from: userAddress});
          this.txHash = this.result.tx;
        });

        it('claims', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(400 + 500));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(600 + 500));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(new BN(0));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(14000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(500));
        });

        it('emits Claim event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Claim', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(600));
        });
      });
    });

    describe('exit', function () {
      beforeEach(async function () {
        await this.underlying.mint(userAddress, ONE_UNIT.muln(1000));
        await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress});
      });

      describe('simple', function () {
        beforeEach(async function () {
          await this.reward.mint(this.incentivizer.address, ONE_UNIT.muln(1000));

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress});

          await time.increase(100);

          this.result = await this.incentivizer.exit({from: userAddress});
          this.txHash = this.result.tx;
        });

        it('exits', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(800 + 0));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(200 + 1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(800));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(2000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(100));
        });

        it('emits Withdrawal event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Withdrawal', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(1000));
        });

        it('emits Claim event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Claim', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(200));
        });
      });

      describe('advanced', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(this.incentivizer.address, ONE_UNIT.muln(1000));

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});

          await time.increase(150);

          await this.incentivizer.withdraw(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          this.result = await this.incentivizer.exit({from: userAddress});
          this.txHash = this.result.tx;
        });

        it('claims', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(700 + 0));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(300 + 1000));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(ONE_UNIT.muln(300));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(8000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(200));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(350));
        });

        it('emits Withdrawal event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Withdrawal', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(500));
        });

        it('emits Claim event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Claim', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(300));
        });
      });

      describe('complete', function () {
        beforeEach(async function () {
          await this.underlying.mint(userAddress2, ONE_UNIT.muln(1000));
          await this.underlying.approve(this.incentivizer.address, ONE_UNIT.muln(1000), {from: userAddress2});

          await this.reward.mint(this.incentivizer.address, ONE_UNIT.muln(1000));

          this.now = await time.latest();

          await this.incentivizer.updateRewardProgram(ONE_UNIT.muln(2), this.now.addn(500), {from: ownerAddress});

          await this.incentivizer.stake(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(100);

          await this.incentivizer.stake(ONE_UNIT.muln(500), {from: userAddress});

          await time.increase(150);

          await this.incentivizer.withdraw(ONE_UNIT.muln(1000), {from: userAddress2});

          await time.increase(500);

          this.result = await this.incentivizer.exit({from: userAddress});
          this.txHash = this.result.tx;
        });

        it('claims', async function () {
          expect(await this.underlying.balanceOf(this.incentivizer.address)).to.be.bignumber.equal(ONE_UNIT.muln(400 + 0));
          expect(await this.underlying.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(600 + 1000));
          expect(await this.underlying.balanceOf(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(1000));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfUnderlying(userAddress2)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.balanceOfReward(userAddress2)).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalUnderlying()).to.be.bignumber.equal(new BN(0));
          expect(await this.incentivizer.totalReward()).to.be.bignumber.equal(ONE_UNIT.muln(400));
          expect(await this.incentivizer.totalProvisionedReward()).to.be.bignumber.equal(new BN(0));
        });

        it('emits Settle event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Settle', {
          });

          expect(event.args.rewardPerUnit).to.be.bignumber.equal(ONE_BIP.muln(14000));
          expect(event.args.newReward).to.be.bignumber.equal(ONE_UNIT.muln(500));
          expect(event.args.updated).to.be.bignumber.equal(new BN(this.now).addn(500));
        });

        it('emits Withdrawal event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Withdrawal', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(500));
        });

        it('emits Claim event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, Incentivizer, 'Claim', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(600));
        });
      });
    });
  });
});