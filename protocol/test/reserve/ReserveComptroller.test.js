const { accounts, contract, web3 } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockToken = contract.fromArtifact('MockToken');
const Dollar = contract.fromArtifact('Dollar');
const Registry = contract.fromArtifact('Registry');
const MockCErc20 = contract.fromArtifact('MockCErc20');
const MockReserveComptroller = contract.fromArtifact('MockReserveComptroller');

const ONE_USDC = new BN(1000000);
const ONE_BIP = new BN(10).pow(new BN(14));
const ONE_UNIT = ONE_BIP.mul(new BN(10000));
const BATCHER_ADDRESS = "0x0000000000000000000000000000000000000001"; // TODO: fill in address after deployment

describe('ReserveComptroller', function () {
  this.retries(10)
  this.timeout(20000)

  const [ ownerAddress, userAddress, comptroller, burnAddress ] = accounts;

  beforeEach(async function () {
    this.registry = await Registry.new({from: ownerAddress});
    this.dollar = await Dollar.new({from: ownerAddress});
    this.collateral = await MockToken.new("USD//C", "USDC", 6, {from: ownerAddress});
    this.cUsdc = await MockCErc20.new({from: ownerAddress});
    await this.cUsdc.set(this.collateral.address, comptroller);
    await this.cUsdc.setExchangeRate(ONE_USDC);
    this.comptroller = await MockReserveComptroller.new({from: ownerAddress});
    await this.comptroller.takeOwnership({from: ownerAddress});
    await this.comptroller.setup({from: ownerAddress});
    await this.comptroller.setRegistry(this.registry.address, {from: ownerAddress});
    await this.dollar.transferOwnership(this.comptroller.address, {from: ownerAddress});
    await this.registry.setUsdc(this.collateral.address, {from: ownerAddress});
    await this.registry.setCUsdc(this.cUsdc.address, {from: ownerAddress});
    await this.registry.setDollar(this.dollar.address, {from: ownerAddress});
  });

  describe('mint', function () {
    describe('basic', function () {
      beforeEach(async function () {
        await this.collateral.mint(userAddress, ONE_USDC.mul(new BN(100000)));
        await this.collateral.approve(this.comptroller.address, ONE_USDC.mul(new BN(100000)), {from: userAddress});
        this.result = await this.comptroller.mint(ONE_UNIT.mul(new BN(100000)), {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('mints', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
        expect(await this.collateral.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.collateral.balanceOf(this.cUsdc.address)).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
        expect(await this.comptroller.reserveBalance()).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
        expect((await this.comptroller.reserveRatio()).value).to.be.bignumber.equal(ONE_UNIT);
        expect((await this.comptroller.redeemPrice()).value).to.be.bignumber.equal(ONE_UNIT);
      });

      it('emits Mint event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveComptroller, 'Mint', {
          account: userAddress
        });

        expect(event.args.mintAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
        expect(event.args.costAmount).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
      });
    });

    describe('decimal amount', function () {
      beforeEach(async function () {
        await this.collateral.mint(userAddress, ONE_USDC.mul(new BN(100000)).addn(1));
        await this.collateral.approve(this.comptroller.address, ONE_USDC.mul(new BN(100000)).addn(1), {from: userAddress});
        this.result = await this.comptroller.mint(ONE_UNIT.muln(100000).addn(1), {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('mints', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)).addn(1));
        expect(await this.collateral.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.collateral.balanceOf(this.cUsdc.address)).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)).addn(1));
        expect(await this.comptroller.reserveBalance()).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)).addn(1));
        expect((await this.comptroller.reserveRatio()).value).to.be.bignumber.equal("1000000000009999999");
        expect((await this.comptroller.redeemPrice()).value).to.be.bignumber.equal(ONE_UNIT);
      });

      it('emits Mint event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveComptroller, 'Mint', {
          account: userAddress
        });

        expect(event.args.mintAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)).addn(1));
        expect(event.args.costAmount).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)).addn(1));
      });
    });

    describe('rewards accrue', function () {
      beforeEach(async function () {
        await this.collateral.mint(userAddress, ONE_USDC.mul(new BN(200000)));
        await this.collateral.approve(this.comptroller.address, ONE_USDC.mul(new BN(200000)), {from: userAddress});
        await this.comptroller.mint(ONE_UNIT.mul(new BN(100000)), {from: userAddress});

        // Accrue 100000 USDC rewards
        await this.cUsdc.setExchangeRate(ONE_USDC.mul(new BN(2)));
        await this.collateral.mint(this.cUsdc.address, ONE_USDC.mul(new BN(100000)));

        this.result = await this.comptroller.mint(ONE_UNIT.mul(new BN(100000)), {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('mints', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(200000)));
        expect(await this.collateral.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.collateral.balanceOf(this.cUsdc.address)).to.be.bignumber.equal(ONE_USDC.mul(new BN(300000)));
        expect(await this.comptroller.reserveBalance()).to.be.bignumber.equal(ONE_USDC.mul(new BN(300000)));
        expect((await this.comptroller.reserveRatio()).value).to.be.bignumber.equal(ONE_UNIT.muln(3).divn(2));
        expect((await this.comptroller.redeemPrice()).value).to.be.bignumber.equal(ONE_UNIT);
      });

      it('emits Mint event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveComptroller, 'Mint', {
          account: userAddress
        });

        expect(event.args.mintAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
        expect(event.args.costAmount).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
      });
    });
  });

  describe('redeem', function () {
    beforeEach(async function () {
      await this.collateral.mint(userAddress, ONE_USDC.mul(new BN(100000)));
      await this.collateral.approve(this.comptroller.address, ONE_USDC.mul(new BN(100000)), {from: userAddress});
      await this.comptroller.mint(ONE_UNIT.mul(new BN(100000)), {from: userAddress});
    });

    describe('basic', function () {
      beforeEach(async function () {
        await this.dollar.approve(this.comptroller.address, ONE_UNIT.mul(new BN(100000)), {from: userAddress});
        this.result = await this.comptroller.redeem(ONE_UNIT.mul(new BN(100000)), {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('redeems', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.collateral.balanceOf(userAddress)).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
        expect(await this.collateral.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.collateral.balanceOf(this.cUsdc.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.comptroller.reserveBalance()).to.be.bignumber.equal(new BN(0));
        expect((await this.comptroller.reserveRatio()).value).to.be.bignumber.equal(ONE_UNIT);
        expect((await this.comptroller.redeemPrice()).value).to.be.bignumber.equal(ONE_UNIT);
      });

      it('emits Redeem event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveComptroller, 'Redeem', {
          account: userAddress
        });

        expect(event.args.redeemAmount).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
        expect(event.args.costAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
      });
    });

    describe('partial collateral', function () {
      beforeEach(async function () {
        await this.comptroller.mintToE(burnAddress, ONE_UNIT.mul(new BN(25000)));
        await this.dollar.approve(this.comptroller.address, ONE_UNIT.mul(new BN(100000)), {from: userAddress});
        this.result = await this.comptroller.redeem(ONE_UNIT.mul(new BN(100000)), {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('redeems', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.collateral.balanceOf(userAddress)).to.be.bignumber.equal(ONE_USDC.mul(new BN(80000)));
        expect(await this.collateral.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.collateral.balanceOf(this.cUsdc.address)).to.be.bignumber.equal(ONE_USDC.mul(new BN(20000)));
        expect(await this.comptroller.reserveBalance()).to.be.bignumber.equal(ONE_USDC.mul(new BN(20000)));
        expect((await this.comptroller.reserveRatio()).value).to.be.bignumber.equal(ONE_UNIT.muln(4).divn(5));
        expect((await this.comptroller.redeemPrice()).value).to.be.bignumber.equal(ONE_UNIT.muln(4).divn(5));
      });

      it('emits Redeem event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveComptroller, 'Redeem', {
          account: userAddress
        });

        expect(event.args.redeemAmount).to.be.bignumber.equal(ONE_USDC.mul(new BN(80000)));
        expect(event.args.costAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
      });
    });

    describe('rewards accrue', function () {
      beforeEach(async function () {
        await this.comptroller.mintToE(burnAddress, ONE_UNIT.mul(new BN(40000)));
        await this.dollar.approve(this.comptroller.address, ONE_UNIT.mul(new BN(100000)), {from: userAddress});

        // Accrue 100000 USDC rewards
        await this.cUsdc.setExchangeRate(ONE_USDC.mul(new BN(2)));
        await this.collateral.mint(this.cUsdc.address, ONE_USDC.mul(new BN(100000)));

        this.result = await this.comptroller.redeem(ONE_UNIT.mul(new BN(100000)), {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('redeems', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.collateral.balanceOf(userAddress)).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
        expect(await this.collateral.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.collateral.balanceOf(this.cUsdc.address)).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
        expect(await this.comptroller.reserveBalance()).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
        expect((await this.comptroller.reserveRatio()).value).to.be.bignumber.equal(ONE_UNIT.muln(5).divn(2));
        expect((await this.comptroller.redeemPrice()).value).to.be.bignumber.equal(ONE_UNIT);
      });

      it('emits Redeem event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveComptroller, 'Redeem', {
          account: userAddress
        });

        expect(event.args.redeemAmount).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
        expect(event.args.costAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
      });
    });

    describe('non-zero debt', function () {
      beforeEach(async function () {
        await this.dollar.approve(this.comptroller.address, ONE_UNIT.mul(new BN(100000)), {from: userAddress});
        await this.comptroller.borrow(BATCHER_ADDRESS, ONE_UNIT.mul(new BN(100000)), {from: ownerAddress});

        this.result = await this.comptroller.redeem(ONE_UNIT.mul(new BN(100000)), {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('redeems', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.collateral.balanceOf(userAddress)).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
        expect(await this.collateral.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.collateral.balanceOf(this.cUsdc.address)).to.be.bignumber.equal(ONE_USDC.mul(new BN(0)));
        expect(await this.comptroller.reserveBalance()).to.be.bignumber.equal(new BN(0));
        expect((await this.comptroller.reserveRatio()).value).to.be.bignumber.equal(ONE_UNIT);
        expect((await this.comptroller.redeemPrice()).value).to.be.bignumber.equal(ONE_UNIT);
      });

      it('emits Redeem event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveComptroller, 'Redeem', {
          account: userAddress
        });

        expect(event.args.redeemAmount).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
        expect(event.args.costAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
      });
    });
  });

  describe('borrow', function () {
    describe('no issuance', function () {
      beforeEach(async function () {
        this.result = await this.comptroller.borrow(BATCHER_ADDRESS, ONE_UNIT.mul(new BN(100000)), {from: ownerAddress});
        this.txHash = this.result.tx;
      });

      it('borrows', async function () {
        expect(await this.dollar.balanceOf(BATCHER_ADDRESS)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
        expect(await this.comptroller.debt(BATCHER_ADDRESS)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
        expect(await this.comptroller.reserveBalance()).to.be.bignumber.equal(new BN(0));
        expect((await this.comptroller.reserveRatio()).value).to.be.bignumber.equal(ONE_UNIT);
        expect((await this.comptroller.redeemPrice()).value).to.be.bignumber.equal(ONE_UNIT);
      });

      it('emits Borrow event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveComptroller, 'Borrow', {
          account: BATCHER_ADDRESS
        });

        expect(event.args.borrowAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
      });
    });

    describe('issuance', function () {
      beforeEach(async function () {
        await this.collateral.mint(userAddress, ONE_USDC.mul(new BN(100000)));
        await this.collateral.approve(this.comptroller.address, ONE_USDC.mul(new BN(100000)), {from: userAddress});
        await this.comptroller.mint(ONE_UNIT.mul(new BN(100000)), {from: userAddress});

        this.result = await this.comptroller.borrow(BATCHER_ADDRESS, ONE_UNIT.mul(new BN(100000)), {from: ownerAddress});
        this.txHash = this.result.tx;
      });

      it('borrows', async function () {
        expect(await this.dollar.balanceOf(BATCHER_ADDRESS)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
        expect(await this.comptroller.debt(BATCHER_ADDRESS)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
        expect(await this.comptroller.reserveBalance()).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
        expect((await this.comptroller.reserveRatio()).value).to.be.bignumber.equal(ONE_UNIT);
        expect((await this.comptroller.redeemPrice()).value).to.be.bignumber.equal(ONE_UNIT);
      });

      it('emits Borrow event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveComptroller, 'Borrow', {
          account: BATCHER_ADDRESS
        });

        expect(event.args.borrowAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
      });
    });

    describe('not allowed to borrow', function () {
      it('reverts', async function () {
        await expectRevert(
            this.comptroller.borrow(userAddress, ONE_UNIT.mul(new BN(100000)), {from: ownerAddress}),
            "ReserveComptroller: cant borrow");
      });
    });

    describe('not allowed to borrow amount', function () {
      it('reverts', async function () {
        await expectRevert(
            this.comptroller.borrow(BATCHER_ADDRESS, ONE_UNIT.mul(new BN(1000001)), {from: ownerAddress}),
            "ReserveComptroller: cant borrow");
      });

      it('reverts', async function () {
        await this.comptroller.borrow(BATCHER_ADDRESS, ONE_UNIT.mul(new BN(500000)), {from: ownerAddress})
        await expectRevert(
            this.comptroller.borrow(BATCHER_ADDRESS, ONE_UNIT.mul(new BN(500001)), {from: ownerAddress}),
            "ReserveComptroller: cant borrow");
      });
    });

    describe('not owner', function () {
      it('reverts', async function () {
        await expectRevert(
            this.comptroller.borrow(BATCHER_ADDRESS, ONE_UNIT.mul(new BN(100000)), {from: userAddress}),
            "Implementation: not owner");
      });
    });
  });

  describe('repay', function () {
    beforeEach(async function () {
      await web3.eth.sendTransaction({from: userAddress, to: BATCHER_ADDRESS, value: web3.utils.toWei('10') });
      await this.comptroller.borrow(BATCHER_ADDRESS, ONE_UNIT.mul(new BN(100000)), {from: ownerAddress});

      await this.dollar.approve(this.comptroller.address, ONE_UNIT.mul(new BN(100000)), {from: BATCHER_ADDRESS});
    });

    describe('no issuance', function () {
      beforeEach(async function () {
        this.result = await this.comptroller.repay(BATCHER_ADDRESS, ONE_UNIT.mul(new BN(100000)), {from: BATCHER_ADDRESS});
        this.txHash = this.result.tx;
      });

      it('repays', async function () {
        expect(await this.dollar.balanceOf(BATCHER_ADDRESS)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(0)));
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(ONE_UNIT.mul(new BN(0)));
        expect(await this.comptroller.debt(BATCHER_ADDRESS)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(0)));
        expect(await this.comptroller.reserveBalance()).to.be.bignumber.equal(new BN(0));
        expect((await this.comptroller.reserveRatio()).value).to.be.bignumber.equal(ONE_UNIT);
        expect((await this.comptroller.redeemPrice()).value).to.be.bignumber.equal(ONE_UNIT);
      });

      it('emits Repay event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveComptroller, 'Repay', {
          account: BATCHER_ADDRESS
        });

        expect(event.args.repayAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
      });
    });

    describe('issuance', function () {
      beforeEach(async function () {
        await this.collateral.mint(userAddress, ONE_USDC.mul(new BN(100000)));
        await this.collateral.approve(this.comptroller.address, ONE_USDC.mul(new BN(100000)), {from: userAddress});
        await this.comptroller.mint(ONE_UNIT.mul(new BN(100000)), {from: userAddress});

        this.result = await this.comptroller.repay(BATCHER_ADDRESS, ONE_UNIT.mul(new BN(100000)), {from: BATCHER_ADDRESS});
        this.txHash = this.result.tx;
      });

      it('repays', async function () {
        expect(await this.dollar.balanceOf(BATCHER_ADDRESS)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(0)));
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(ONE_UNIT.mul(new BN(0)));
        expect(await this.comptroller.debt(BATCHER_ADDRESS)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(0)));
        expect(await this.comptroller.reserveBalance()).to.be.bignumber.equal(ONE_USDC.mul(new BN(100000)));
        expect((await this.comptroller.reserveRatio()).value).to.be.bignumber.equal(ONE_UNIT);
        expect((await this.comptroller.redeemPrice()).value).to.be.bignumber.equal(ONE_UNIT);
      });

      it('emits Repay event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveComptroller, 'Repay', {
          account: BATCHER_ADDRESS
        });

        expect(event.args.repayAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(100000)));
      });
    });
  });
});
