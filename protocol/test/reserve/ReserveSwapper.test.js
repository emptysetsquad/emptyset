const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockToken = contract.fromArtifact('MockToken');
const Registry = contract.fromArtifact('Registry');
const MockReserveSwapper = contract.fromArtifact('MockReserveSwapper');

const ONE_BIP = new BN(10).pow(new BN(14));
const ONE_UNIT = ONE_BIP.mul(new BN(10000));
const MAX_256 = new BN(2).pow(new BN(256)).sub(new BN(1));

describe('ReserveSwapper', function () {
  this.timeout(10000);

  const [ ownerAddress, userAddress ] = accounts;

  beforeEach(async function () {
    this.registry = await Registry.new({from: ownerAddress});
    this.tokenA = await MockToken.new("Dai Stablecoin", "DAI", 18, {from: ownerAddress});
    this.tokenB = await MockToken.new("USD//C", "USDC", 6, {from: ownerAddress});
    this.tokenESD = await MockToken.new("Empty Set Dollar", "ESD", 18, {from: ownerAddress});
    this.swapper = await MockReserveSwapper.new({from: ownerAddress});
    await this.swapper.takeOwnership({from: ownerAddress});
    await this.swapper.setup({from: ownerAddress});
    await this.swapper.setRegistry(this.registry.address, {from: ownerAddress});
    await this.registry.setDollar(this.tokenESD.address, {from: ownerAddress});
    await this.registry.setUsdc(this.tokenB.address, {from: ownerAddress});
  });

  describe('registerOrder', function () {
    describe('basic set', function () {
      beforeEach(async function () {
        this.result = await this.swapper.registerOrder(
          this.tokenA.address,
          this.tokenB.address,
          ONE_BIP.mul(new BN(10000)),
          ONE_BIP.mul(new BN(10000)).mul(new BN(1000)),
          {from: ownerAddress});
        this.txHash = this.result.tx;
      });

      it('lists order', async function () {
        const order = await this.swapper.order(this.tokenA.address, this.tokenB.address);
        expect(order.price.value).to.be.bignumber.equal(ONE_BIP.mul(new BN(10000)));
        expect(order.amount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000)));
      });

      it('emits OrderRegistered event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveSwapper, 'OrderRegistered', {
          makerToken: this.tokenA.address,
          takerToken: this.tokenB.address,
        });

        expect(event.args.price).to.be.bignumber.equal(ONE_BIP.mul(new BN(10000)));
        expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000)));
      });
    });

    describe('reset', function () {
      beforeEach(async function () {
        await this.swapper.registerOrder(
          this.tokenA.address,
          this.tokenB.address,
          ONE_BIP.mul(new BN(10000)),
          ONE_UNIT.mul(new BN(1000)),
          {from: ownerAddress});
        this.result = await this.swapper.registerOrder(
          this.tokenA.address,
          this.tokenB.address,
          ONE_BIP.mul(new BN(11000)),
          ONE_UNIT.mul(new BN(2000)),
          {from: ownerAddress});
        this.txHash = this.result.tx;
      });

      it('lists order', async function () {
        const order = await this.swapper.order(this.tokenA.address, this.tokenB.address);
        expect(order.price.value).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
        expect(order.amount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(2000)));
      });

      it('emits OrderRegistered event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveSwapper, 'OrderRegistered', {
          makerToken: this.tokenA.address,
          takerToken: this.tokenB.address,
        });

        expect(event.args.price).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
        expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(2000)));
      });
    });

    describe('not owner', function () {
      it('reverts', async function () {
        await expectRevert(this.swapper.registerOrder(
          this.tokenA.address,
          this.tokenB.address,
          ONE_BIP.mul(new BN(10000)),
          ONE_UNIT.mul(new BN(1000)),
          {from: userAddress}), "Implementation: not owner");
      });
    });
  });

  describe('swap', function () {
    beforeEach(async function () {
      await this.swapper.registerOrder(
        this.tokenB.address,
        this.tokenA.address,
        ONE_BIP.mul(new BN(11000)),
        ONE_UNIT.mul(new BN(1000)),
        {from: ownerAddress});
      await this.tokenA.mint(userAddress, ONE_UNIT.mul(new BN(100000)));
      await this.tokenA.approve(this.swapper.address, ONE_UNIT.mul(new BN(100000)), {from: userAddress});
      await this.tokenB.mint(this.swapper.address, ONE_UNIT.mul(new BN(100000)));
    });

    describe('simple swap', function () {
      beforeEach(async function () {
        this.result = await this.swapper.swap(
          this.tokenB.address,
          this.tokenA.address,
          ONE_UNIT.mul(new BN(1100)),
          {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('performs swap', async function () {
        expect(await this.tokenB.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000)));
        expect(await this.tokenB.balanceOf(this.swapper.address)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(99000)));
        expect(await this.tokenA.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(98900)));
        expect(await this.tokenA.balanceOf(this.swapper.address)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1100)));

        const order = await this.swapper.order(this.tokenB.address, this.tokenA.address);
        expect(order.price.value).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
        expect(order.amount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(0)));
      });

      it('emits Swap event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveSwapper, 'Swap', {
          makerToken: this.tokenB.address,
          takerToken: this.tokenA.address,
        });

        expect(event.args.takerAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1100)));
        expect(event.args.makerAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000)));
      });
    });

    describe('above amount limit', function () {
      it('reverts', async function () {
        await expectRevert(this.swapper.swap(
          this.tokenB.address,
          this.tokenA.address,
          ONE_UNIT.mul(new BN(1200)),
          {from: userAddress}), "ReserveSwapper: insufficient amount");
      });
    });

    describe('aggr above amount limit', function () {
      beforeEach(async function () {
        await this.swapper.swap(
          this.tokenB.address,
          this.tokenA.address,
          ONE_UNIT.mul(new BN(600)),
          {from: userAddress});
      });

      it('displays', async function () {
        const order = await this.swapper.order(this.tokenB.address, this.tokenA.address);
        expect(order.price.value).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
        expect(order.amount).to.be.bignumber.equal(new BN("454545454545454545455"));
      });

      it('reverts', async function () {
        await expectRevert(this.swapper.swap(
          this.tokenB.address,
          this.tokenA.address,
          ONE_UNIT.mul(new BN(600)),
          {from: userAddress}), "ReserveSwapper: insufficient amount");
      });
    });

    describe('infinite amount', function () {
      beforeEach(async function () {
        await this.swapper.registerOrder(
          this.tokenB.address,
          this.tokenA.address,
          ONE_BIP.mul(new BN(11000)),
          MAX_256,
          {from: ownerAddress});
        await this.swapper.swap(
          this.tokenB.address,
          this.tokenA.address,
          ONE_UNIT.mul(new BN(1100)),
          {from: userAddress});
      });

      it('displays', async function () {
        const order = await this.swapper.order(this.tokenB.address, this.tokenA.address);
        expect(order.price.value).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
        expect(order.amount).to.be.bignumber.equal(MAX_256);
      });
    });

    describe('makerToken is dollar', function () {
      it('reverts', async function () {
        await expectRevert(this.swapper.swap(
          this.tokenESD.address,
          this.tokenA.address,
          ONE_UNIT.mul(new BN(600)),
          {from: userAddress}), "ReserveSwapper: unsupported token");
      });
    });

    describe('takerToken is dollar', function () {
      it('reverts', async function () {
        await expectRevert(this.swapper.swap(
          this.tokenB.address,
          this.tokenESD.address,
          ONE_UNIT.mul(new BN(600)),
          {from: userAddress}), "ReserveSwapper: unsupported token");
      });
    });

    describe('makerToken and takerToken are equal', function () {
      it('reverts', async function () {
        await expectRevert(this.swapper.swap(
          this.tokenB.address,
          this.tokenB.address,
          ONE_UNIT.mul(new BN(600)),
          {from: userAddress}), "ReserveSwapper: tokens equal");
      });
    });
  });
});