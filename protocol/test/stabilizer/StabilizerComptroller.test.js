const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const Dollar = contract.fromArtifact('Dollar');
const Registry = contract.fromArtifact('Registry');
const MockStabilizerComptroller = contract.fromArtifact('MockStabilizerComptroller');
const MockSettableOracle = contract.fromArtifact('MockSettableOracle');
const MockSettableReserve = contract.fromArtifact('MockSettableReserve');

const ONE_MICRO = new BN(10).pow(new BN(12));
const ONE_BIP = new BN(10).pow(new BN(14));
const ONE_UNIT = ONE_BIP.mul(new BN(10000));
const ONE_DAY = new BN(60 * 60 * 24);

describe('StabilizerComptroller', function () {
  this.timeout(5000);

  const [ ownerAddress, userAddress] = accounts;

  beforeEach(async function () {
    this.registry = await Registry.new({from: ownerAddress});
    this.dollar = await Dollar.new({from: ownerAddress});
    this.comptroller = await MockStabilizerComptroller.new({from: ownerAddress});
    await this.comptroller.takeOwnership({from: ownerAddress});
    await this.comptroller.setRegistry(this.registry.address, {from: ownerAddress});
    this.oracle = await MockSettableOracle.new({from: ownerAddress});
    this.reserve = await MockSettableReserve.new({from: ownerAddress});

    await this.dollar.transferOwnership(this.reserve.address, {from: ownerAddress});

    await this.registry.setDollar(this.dollar.address, {from: ownerAddress});
    await this.registry.setOracle(this.oracle.address, {from: ownerAddress});
    await this.registry.setReserve(this.reserve.address, {from: ownerAddress});
    await this.comptroller.setDecayRate(ONE_BIP.muln(1000), {from: ownerAddress});
    await this.comptroller.setMaxAlpha(ONE_BIP.muln(1000), {from: ownerAddress});
    await this.comptroller.setRewardRate(ONE_BIP.muln(100), {from: ownerAddress});

    await this.oracle.set(ONE_UNIT, ONE_DAY, true);

    await this.reserve.setDollar(this.dollar.address);
    await this.reserve.setBorrowable(true);
    await this.reserve.setRedeemPrice(ONE_BIP.muln(9000));
  });

  describe('before setup', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.comptroller.setup({from: ownerAddress});
      });

      it('initializes ema', async function () {
        const ema = await this.comptroller.ema();
        expect(ema.value).to.be.bignumber.equal(ONE_UNIT);
      });
    });

    describe('when called erroneously', function () {
      it('reverts', async function () {
        await expectRevert(
          this.comptroller.setup({from: userAddress}),
          "Implementation: not owner");
      });
    });
  });

  describe('after setup', function () {
    beforeEach('call', async function () {
      await this.comptroller.setup({from: ownerAddress});
    });

    describe('supply', function () {
      describe('basic', function () {
        beforeEach(async function () {
          await this.reserve.mintToE(userAddress, ONE_UNIT.muln(100000));
          await this.dollar.approve(this.comptroller.address, ONE_UNIT.muln(100000), {from: userAddress});
          this.result = await this.comptroller.supply(ONE_UNIT.muln(100000), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('supplies', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(ONE_UNIT.muln(100000));
          expect(await this.comptroller.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(100000));
          expect(await this.comptroller.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(100000));
        });

        it('emits Supply event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockStabilizerComptroller, 'Supply', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(100000));
          expect(event.args.mintAmount).to.be.bignumber.equal(ONE_UNIT.muln(100000));
        });
      });

      describe('with rewards', function () {
        beforeEach(async function () {
          await this.reserve.mintToE(userAddress, ONE_UNIT.muln(200000));
          await this.dollar.approve(this.comptroller.address, ONE_UNIT.muln(200000), {from: userAddress});

          await this.comptroller.supply(ONE_UNIT.muln(100000), {from: userAddress});

          await this.reserve.mintToE(this.comptroller.address, ONE_UNIT.muln(100000));

          this.result = await this.comptroller.supply(ONE_UNIT.muln(100000), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('supplies', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(ONE_UNIT.muln(300000));
          expect(await this.comptroller.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(150000));
          expect(await this.comptroller.balanceOfUnderlying(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(300000));
        });

        it('emits Supply event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockStabilizerComptroller, 'Supply', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(100000));
          expect(event.args.mintAmount).to.be.bignumber.equal(ONE_UNIT.muln(50000));
        });
      });
    });

    describe('redeem', function () {
      beforeEach(async function () {
        await this.reserve.mintToE(userAddress, ONE_UNIT.muln(100000));
        await this.dollar.approve(this.comptroller.address, ONE_UNIT.muln(100000), {from: userAddress});
        await this.comptroller.supply(ONE_UNIT.muln(100000), {from: userAddress});
      });

      describe('basic', function () {
        beforeEach(async function () {
          this.result = await this.comptroller.redeem(ONE_UNIT.muln(100000), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('redeems', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(100000));
          expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.comptroller.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        });

        it('emits Redeem event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockStabilizerComptroller, 'Redeem', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(100000));
          expect(event.args.burnAmount).to.be.bignumber.equal(ONE_UNIT.muln(100000));
        });
      });

      describe('with rewards', function () {
        beforeEach(async function () {
          await this.comptroller.redeem(ONE_UNIT.muln(50000), {from: userAddress});

          await this.reserve.mintToE(this.comptroller.address, ONE_UNIT.muln(50000));

          this.result = await this.comptroller.redeem(ONE_UNIT.muln(50000), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('redeems', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(150000));
          expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.comptroller.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        });

        it('emits Redeem event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockStabilizerComptroller, 'Redeem', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(100000));
          expect(event.args.burnAmount).to.be.bignumber.equal(ONE_UNIT.muln(50000));
        });
      });
    });

    describe('redeemUnderlying', function () {
      beforeEach(async function () {
        await this.reserve.mintToE(userAddress, ONE_UNIT.muln(100000));
        await this.dollar.approve(this.comptroller.address, ONE_UNIT.muln(100000), {from: userAddress});
        await this.comptroller.supply(ONE_UNIT.muln(100000), {from: userAddress});
      });

      describe('basic', function () {
        beforeEach(async function () {
          this.result = await this.comptroller.redeemUnderlying(ONE_UNIT.muln(100000), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('supplies', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(100000));
          expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.comptroller.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        });

        it('emits Redeem event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockStabilizerComptroller, 'Redeem', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(100000));
          expect(event.args.burnAmount).to.be.bignumber.equal(ONE_UNIT.muln(100000));
        });
      });

      describe('with rewards', function () {
        beforeEach(async function () {
          await this.comptroller.redeemUnderlying(ONE_UNIT.muln(50000), {from: userAddress});

          await this.reserve.mintToE(this.comptroller.address, ONE_UNIT.muln(50000));

          this.result = await this.comptroller.redeemUnderlying(ONE_UNIT.muln(100000), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('redeems', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.muln(150000));
          expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.comptroller.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        });

        it('emits Redeem event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockStabilizerComptroller, 'Redeem', {
            account: userAddress
          });

          expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.muln(100000));
          expect(event.args.burnAmount).to.be.bignumber.equal(ONE_UNIT.muln(50000));
        });
      });
    });

    describe('settle', function () {
      beforeEach(async function () {
        await this.reserve.mintToE(userAddress, ONE_UNIT.muln(100000));
        await this.dollar.approve(this.comptroller.address, ONE_UNIT.muln(100000), {from: userAddress});
        await this.comptroller.supply(ONE_UNIT.muln(100000), {from: userAddress});
      });

      describe('before call', function () {
        it('ema', async function () {
          expect((await this.comptroller.ema()).value).to.be.bignumber.equal(ONE_UNIT);
        });

        it('balance', async function () {
          expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(ONE_UNIT.muln(100000));
        });
      });

      describe('when called', function () {
        describe('neutral', function () {
          beforeEach(async function () {
            this.result = await this.comptroller.settleE();
            this.txHash = this.result.tx;
          });

          it('updates ema', async function () {
            expect((await this.comptroller.ema()).value).to.be.bignumber.equal(ONE_UNIT);
          });

          it('borrows', async function () {
            expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(ONE_UNIT.muln(100000));
          });

          it('emits Settle event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockStabilizerComptroller, 'Settle', {});

            expect(event.args.amount).to.be.bignumber.equal(new BN(0));
          });
        });


        describe('above', function () {
          describe('simple', function () {
            beforeEach(async function () {
              // price:       0.90
              // elapsed:     0.5 days
              // maxAlpha:    0.10
              // decayRate:   0.10
              // rewardRate:  0.01
              await this.oracle.set(ONE_BIP.muln(9000), ONE_DAY.divn(2), true);

              this.result = await this.comptroller.settleE();
              this.txHash = this.result.tx;
            });

            it('updates ema', async function () {
              expect((await this.comptroller.rate()).value).to.be.bignumber.equal(ONE_MICRO.muln(50));
              expect((await this.comptroller.ema()).value).to.be.bignumber.equal(ONE_BIP.muln(9950));
            });

            it('borrows', async function () {
              expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(ONE_UNIT.muln(100000));
            });

            it('emits Settle event', async function () {
              const event = await expectEvent.inTransaction(this.txHash, MockStabilizerComptroller, 'Settle', {});

              expect(event.args.amount).to.be.bignumber.equal(new BN(0));
            });
          });

          describe('alpha over max', function () {
            beforeEach(async function () {
              // price:       0.90
              // elapsed:     2 days
              // maxAlpha:    0.10
              // decayRate:   0.10
              // rewardRate:  0.01
              await this.oracle.set(ONE_BIP.muln(9000), ONE_DAY.muln(2), true);

              this.result = await this.comptroller.settleE();
              this.txHash = this.result.tx;
            });

            it('updates ema', async function () {
              expect((await this.comptroller.rate()).value).to.be.bignumber.equal(ONE_MICRO.muln(100));
              expect((await this.comptroller.ema()).value).to.be.bignumber.equal(ONE_BIP.muln(9900));
            });

            it('borrows', async function () {
              expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(ONE_UNIT.muln(100000));
            });

            it('emits Settle event', async function () {
              const event = await expectEvent.inTransaction(this.txHash, MockStabilizerComptroller, 'Settle', {});

              expect(event.args.amount).to.be.bignumber.equal(new BN(0));
            });
          });

          describe('below redeem price', function () {
            beforeEach(async function () {
              // price:       0.80
              // elapsed:     0.5 days
              // maxAlpha:    0.50
              // decayRate:   0.50
              // rewardRate:  0.01
              // redeemPrice: 0.90
              await this.oracle.set(ONE_BIP.muln(8000), ONE_DAY, true);
              await this.comptroller.setDecayRate(ONE_BIP.muln(5000), {from: ownerAddress});
              await this.comptroller.setMaxAlpha(ONE_BIP.muln(5000), {from: ownerAddress});

              await this.comptroller.settleE(); // EMA = 0.90

              this.result = await this.comptroller.settleE(); // EMA = 0.85
              this.txHash = this.result.tx;
            });

            it('updates ema', async function () {
              expect((await this.comptroller.rate()).value).to.be.bignumber.equal(ONE_MICRO.muln(1000));
              expect((await this.comptroller.ema()).value).to.be.bignumber.equal(ONE_BIP.muln(8500));
            });

            it('borrows', async function () {
              const balance = ONE_UNIT.muln(100000) // Initial deposit
                .add(ONE_BIP.muln(1000000))         // Second settle()
              expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(balance);
            });

            it('emits Settle event', async function () {
              const event = await expectEvent.inTransaction(this.txHash, MockStabilizerComptroller, 'Settle', {});

              expect(event.args.amount).to.be.bignumber.equal(ONE_BIP.muln(1000000));
            });
          });
        });

        describe('below', function () {
          beforeEach(async function () {
            await this.oracle.set(ONE_BIP.muln(0), ONE_DAY, true); // EMA = 0.90

            this.result = await this.comptroller.settleE();
            this.txHash = this.result.tx;
          });

          describe('simple', function () {
            beforeEach(async function () {
              // price:       0.90
              // elapsed:     0.5 days
              // maxAlpha:    0.10
              // decayRate:   0.10
              // rewardRate:  0.01
              await this.oracle.set(ONE_BIP.muln(11000), ONE_DAY.divn(2), true);

              this.result = await this.comptroller.settleE();
              this.txHash = this.result.tx;
            });

            it('updates ema', async function () {
              expect((await this.comptroller.rate()).value).to.be.bignumber.equal(ONE_MICRO.muln(900));
              expect((await this.comptroller.ema()).value).to.be.bignumber.equal(ONE_BIP.muln(9100));
            });

            it('borrows', async function () {
              const balance = ONE_UNIT.muln(100000) // Initial deposit
                .add(ONE_BIP.muln(500000))         // Second settle()
              expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(balance);
            });

            it('emits Settle event', async function () {
              const event = await expectEvent.inTransaction(this.txHash, MockStabilizerComptroller, 'Settle', {});

              expect(event.args.amount).to.be.bignumber.equal(ONE_BIP.muln(500000));
            });
          });

          describe('alpha over max', function () {
            beforeEach(async function () {
              // price:       0.90
              // elapsed:     0.5 days
              // maxAlpha:    0.10
              // decayRate:   0.10
              // rewardRate:  0.01
              await this.oracle.set(ONE_BIP.muln(11000), ONE_DAY.muln(2), true);

              this.result = await this.comptroller.settleE();
              this.txHash = this.result.tx;
            });

            it('updates ema', async function () {
              expect((await this.comptroller.rate()).value).to.be.bignumber.equal(ONE_MICRO.muln(800));
              expect((await this.comptroller.ema()).value).to.be.bignumber.equal(ONE_BIP.muln(9200));
            });

            it('borrows', async function () {
              const balance = ONE_UNIT.muln(100000) // Initial deposit
                .add(ONE_BIP.muln(2000000))         // Second settle()
              expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(balance);
            });

            it('emits Settle event', async function () {
              const event = await expectEvent.inTransaction(this.txHash, MockStabilizerComptroller, 'Settle', {});

              expect(event.args.amount).to.be.bignumber.equal(ONE_BIP.muln(2000000));
            });
          });

          describe('when above neutral', function () {
            beforeEach(async function () {
              // price:       0.80
              // elapsed:     0.5 days
              // maxAlpha:    0.50
              // decayRate:   0.50
              // rewardRate:  0.01
              // redeemPrice: 0.90
              await this.oracle.set(ONE_BIP.muln(11000), ONE_DAY, true);
              await this.comptroller.setDecayRate(ONE_BIP.muln(5000), {from: ownerAddress});
              await this.comptroller.setMaxAlpha(ONE_BIP.muln(5000), {from: ownerAddress});

              await this.comptroller.settleE(); // EMA = 1.00

              this.result = await this.comptroller.settleE(); // EMA = 1.05
              this.txHash = this.result.tx;
            });

            it('updates ema', async function () {
              expect((await this.comptroller.rate()).value).to.be.bignumber.equal(new BN(0));
              expect((await this.comptroller.ema()).value).to.be.bignumber.equal(ONE_BIP.muln(10500));
            });

            it('borrows', async function () {
              const balance = ONE_UNIT.muln(100000) // Initial deposit
                .add(ONE_BIP.muln(1000000))       // Second settle()
                .add(ONE_BIP.muln(0))             // Third settle()
              expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(balance);
            });

            it('emits Settle event', async function () {
              const event = await expectEvent.inTransaction(this.txHash, MockStabilizerComptroller, 'Settle', {});

              expect(event.args.amount).to.be.bignumber.equal(new BN(0));
            });
          });
        });
      });
    });
  });
});