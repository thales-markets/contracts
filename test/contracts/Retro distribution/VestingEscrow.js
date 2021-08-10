'use strict';

const { contract, web3 } = require('hardhat');
const Big = require('big.js');
const { toBN } = web3.utils;
const { currentTime, fastForward } = require('../../utils')();

const { time } = require("@openzeppelin/test-helpers");
const { assert } = require('../../utils/common');

const VESTING_PERIOD = 86400 * 365;
const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const TOTAL_AMOUNT = web3.utils.toWei("15000000");

const { testAccounts } = require('../Token/test-accounts');

contract('VestingEscrow', accounts => {
	const WEEK = 604800;
	const YEAR = 31556926;
	let admin, beneficiary, revoker;
    let Thales, VestingEscrow;

    describe('Getters', () => {
        let amounts;
        beforeEach(async () => {
            [admin, beneficiary, revoker] = await ethers.getSigners();
            let now = await currentTime();
    
            Thales = await deployContract("Thales");
            VestingEscrow = await deployContract("VestingEscrow", [
                Thales.address,
                (now + 1000).toString(),
                (now + YEAR).toString(),
                false,
                [accounts[2], accounts[3], accounts[4], accounts[5]]
            ]);

            const recipients = [beneficiary.address, ...testAccounts];
            amounts = new Array(100).fill(web3.utils.toWei("150000")); 

            await VestingEscrow.addTokens(TOTAL_AMOUNT);
            await VestingEscrow.fund(recipients, amounts);
        });

        it('should get total vested supply', async() => {
            const vestedSupplyBeforeStart = await VestingEscrow.vestedSupply();
            assert.equal(vestedSupplyBeforeStart, 0);

            fastForward(YEAR + WEEK);

            const vestedSupplyAfterStart = await VestingEscrow.vestedSupply();

            let sum = Big(0);
            for (let i = 0; i < 100; i++) {
                sum = sum.add(Big(amounts[i]));
            }

            assert.equal(vestedSupplyAfterStart.toString(), sum.toNumber().toLocaleString('fullwide', {useGrouping: false}));
        });

        it('should get total locked supply', async() => {
            const lockedSupplyStart = await VestingEscrow.lockedSupply();
            assert.equal(lockedSupplyStart, TOTAL_AMOUNT);

            fastForward(YEAR + WEEK);

            const lockedSupplyEnd = await VestingEscrow.lockedSupply();
            assert.equal(lockedSupplyEnd, 0);
        });

        it('should get vested amount of address', async() => {
            const vestedOfStart = await VestingEscrow.vestedOf(beneficiary.address);
            assert.equal(vestedOfStart, 0);

            fastForward(YEAR + WEEK);

            const vestedOfEnd = await VestingEscrow.vestedOf(beneficiary.address);
            assert.equal(vestedOfEnd, amounts[0]);
        });

        it('should get locked amount of address', async() => {
            const lockedOfStart = await VestingEscrow.lockedOf(beneficiary.address);
            assert.equal(lockedOfStart, amounts[0]);

            fastForward(YEAR + WEEK);

            const lockedOfEnd = await VestingEscrow.lockedOf(beneficiary.address);
            assert.equal(lockedOfEnd, 0);
        });

        it('should get balance of address', async() => {
            const balanceOfStart = await VestingEscrow.balanceOf(beneficiary.address);
            assert.equal(balanceOfStart, 0);

            fastForward(YEAR + WEEK);
            
            const balanceOfEnd = await VestingEscrow.balanceOf(beneficiary.address);
            assert.equal(balanceOfEnd, amounts[0]);

            await VestingEscrow.connect(beneficiary).claim(beneficiary.address);
            assert.equal(await VestingEscrow.balanceOf(beneficiary.address), 0);
        });
    });


    describe('Fund', () => {
        let amounts, recipients, fundAdmin2, fundAdmin3, fundAdmin4, notAdmin;
        beforeEach(async () => {
            [admin, beneficiary, revoker, fundAdmin2, fundAdmin3, fundAdmin4, notAdmin ] = await ethers.getSigners();
            let now = await currentTime();

            Thales = await deployContract("Thales");
            VestingEscrow = await deployContract("VestingEscrow", [
                Thales.address,
                (now + 100).toString(),
                (now + YEAR).toString(),
                false,
                [accounts[2], accounts[3], accounts[4], accounts[5]]
            ]);

            recipients = [beneficiary.address, ... testAccounts];
            amounts = new Array(100);
            for (let i = 1; i < 101; i++) {
                amounts[i-1] = (i * 10**17).toString();
            }
            await VestingEscrow.addTokens(TOTAL_AMOUNT);
        });

        it('should get token balance', async() => {
            assert.equal(await Thales.balanceOf(VestingEscrow.address), TOTAL_AMOUNT);
        });

        it('should get initial locked supply', async() => {
            await VestingEscrow.fund(recipients, amounts, {from: admin.address});
            let amountsSum = 0;
            for (let i = 0; i < amounts.length; i++) {
                amountsSum += parseInt(amounts[i]);
            }
            assert.equal(await VestingEscrow.initialLockedSupply(), toBN(amountsSum).toString());
        })

        it('should get unallocated supply', async() => {
            await VestingEscrow.fund(recipients, amounts, {from: admin.address});
            let amountsSum = 0;
            for (let i = 0; i < amounts.length; i++) {
                amountsSum += parseInt(amounts[i]);
            }
            assert.equal(await VestingEscrow.unallocatedSupply(), toBN(TOTAL_AMOUNT).sub(toBN(amountsSum)).toString());
        });

        it('should get inital locked for each account', async() => {
            await VestingEscrow.fund(recipients, amounts, {from: admin.address});
            const data = amounts.reduce(function (data, field, index) {
                data[recipients[index]] = field;
                return data;
            }, {});

            for(let[account, expectedAmount] of Object.entries(data)) {
                assert.equal(await VestingEscrow.initialLocked(account), expectedAmount);
            }
        });

        it('should fund partial recipients', async() => {
            recipients = [ ...recipients.slice(0, 5), ...new Array(95).fill(ZERO_ADDRESS)];
            await VestingEscrow.fund(recipients, amounts, {from: admin.address});
            let amountsSum = 0;
            for (let i = 0; i < 5; i++) {
                amountsSum += parseInt(amounts[i]);
            }
            assert.equal(await VestingEscrow.initialLockedSupply(), toBN(amountsSum).toString());
        });

        it('should fund one recipient', async() => {
            recipients = [accounts[5], ...new Array(99).fill(ZERO_ADDRESS)];
            await VestingEscrow.fund(recipients, [(10**20).toString(), ...new Array(99).fill('0')], {from: admin.address});

            assert.equal(await VestingEscrow.initialLockedSupply(), toBN(10**20).toString());
        });

        it('should fund multiple times with different recipients', async() => {
            recipients = [accounts[5], ...new Array(99).fill(ZERO_ADDRESS)];
            amounts = [(10**20).toString(), (10**20*2).toString(), ...new Array(98).fill('0')];
            await VestingEscrow.fund(recipients, amounts, {from: admin.address});

            recipients[0] = accounts[4];
            recipients[1] = accounts[6];
            await VestingEscrow.fund(recipients, amounts, {from: admin.address});

            assert.equal(await VestingEscrow.initialLockedSupply(), toBN(10**20*4).toString());
            assert.equal(await VestingEscrow.unallocatedSupply(), toBN(TOTAL_AMOUNT).sub(toBN(10**20*4)).toString());
            assert.equal(await VestingEscrow.initialLocked(accounts[4]),toBN(10**20).toString());
            assert.equal(await VestingEscrow.initialLocked(accounts[5]),toBN(10**20).toString());
            assert.equal(await VestingEscrow.initialLocked(accounts[6]),toBN(10**20*2).toString());
        });

        it('should fund multiple times with same recipients', async() => {
            recipients = [accounts[5], ...new Array(99).fill(ZERO_ADDRESS)];
            amounts = [(10**20*2).toString(), ...new Array(99).fill('0')];

            await VestingEscrow.fund(recipients, amounts, {from: admin.address});

            amounts[0] = (10**20).toString();
            await VestingEscrow.fund(recipients, amounts, {from: admin.address});

            assert.equal(await VestingEscrow.initialLockedSupply(), toBN(10**20*3).toString());
            assert.equal(await VestingEscrow.unallocatedSupply(), toBN(TOTAL_AMOUNT).sub(toBN(10**20*3)).toString());
            assert.equal(await VestingEscrow.initialLocked(accounts[5]),toBN(10**20*3).toString());
        });

        it('should fund from admin\'s account only', async() => {
            const REVERT = "VM Exception while processing transaction: revert Admin only";
            await assert.revert(VestingEscrow.connect(notAdmin).fund(recipients, amounts), REVERT);
           
        });

        // it('should revert on over allocation', async() => {
        //     const REVERT = 'VM Exception while processing transaction: revert SafeMath: subtraction overflow';
        //     await assert.revert(VestingEscrow.fund(recipients, [100 + TOTAL_AMOUNT + '', ...new Array(99).fill('0')], {from: admin.address}), REVERT);
        // });

        it('should fund from funding admin account', async() => {
            recipients = [accounts[5], ...new Array(99).fill(ZERO_ADDRESS)];
            amounts = [(10**20).toString(), (10**20*2).toString(), ...new Array(98).fill('0')];

            await VestingEscrow.connect(revoker).fund(recipients, amounts);

            assert.equal(await VestingEscrow.initialLockedSupply(), toBN(10**20).toString());
            assert.equal(await VestingEscrow.unallocatedSupply(), toBN(TOTAL_AMOUNT).sub(toBN(10**20)).toString());
            assert.equal(await VestingEscrow.initialLocked(accounts[5]),toBN(10**20).toString());
        });

        it('should disable fund admins', async() => {
            const REVERT = 'VM Exception while processing transaction: revert Fund admins disabled';
            await VestingEscrow.disableFundAdmins({from: admin.address});

            recipients = [accounts[5], ...new Array(99).fill(ZERO_ADDRESS)];
            amounts = [(10**20).toString(), (10**20*2).toString(), ...new Array(98).fill('0')];

            await assert.revert(VestingEscrow.connect(revoker).fund(recipients, amounts), REVERT);
        });
    });

	describe('Claim', () => {
        let startTime, endTime;
        beforeEach(async () => {
            [admin, beneficiary, revoker] = await ethers.getSigners();

            startTime = await currentTime() + 100;
            endTime = startTime + YEAR;
    
            Thales = await deployContract("Thales");
            VestingEscrow = await deployContract("VestingEscrow", [
                Thales.address,
                startTime.toString(),
                endTime.toString(),
                false,
                [accounts[2], accounts[3], accounts[4], accounts[5]]
            ]);

            const recipients = [beneficiary.address, ... new Array(99).fill(ZERO_ADDRESS)];

            await VestingEscrow.addTokens(TOTAL_AMOUNT);
            await VestingEscrow.fund(recipients, [TOTAL_AMOUNT, ... new Array(99).fill(0)]);
        });

		it('should set initial funding', async () => {
            const initialLockedSupply = await VestingEscrow.initialLockedSupply();
            const unallocatedSupply = await VestingEscrow.unallocatedSupply();
            assert.equal(initialLockedSupply, TOTAL_AMOUNT);
            assert.equal(unallocatedSupply, 0);
		});

        it('should claim full amount', async () => {
            fastForward(53*WEEK);
            await VestingEscrow.connect(beneficiary).claim(beneficiary.address);

            const balanceOfAccount = await Thales.balanceOf(beneficiary.address);

            assert.equal(balanceOfAccount, TOTAL_AMOUNT);
        });

        it('should claim for another account', async() => {
            fastForward(53*WEEK);
            await VestingEscrow.connect(revoker).claim(beneficiary.address);

            const balanceOfAccount = await Thales.balanceOf(beneficiary.address);

            assert.equal(balanceOfAccount, TOTAL_AMOUNT);
        });

        it('should show zero balance if claimed before start', async() => {
            await time.increaseTo((await currentTime()).toString());
            await VestingEscrow.connect(beneficiary).claim(beneficiary.address);

            const balanceOfAccount = await Thales.balanceOf(beneficiary.address);
            assert.equal(balanceOfAccount, 0);
        });

        it('should be able to claim partial', async() => {
            fastForward(10*WEEK);
            await VestingEscrow.connect(beneficiary).claim(beneficiary.address);
            const expectedAmount = TOTAL_AMOUNT * ((await currentTime() - startTime) / (endTime - startTime));

            const balanceOfAccount = await Thales.balanceOf(beneficiary.address);
            assert.equal(balanceOfAccount, expectedAmount);
        });

        it('should be able to claim multiple times', async() => {
            let balance = 0;
            for (let i = 0; i < 53; i++) {
                fastForward(WEEK);
                await VestingEscrow.connect(beneficiary).claim(beneficiary.address);
                let newBalance = await Thales.balanceOf(beneficiary.address);
                assert.bnGt(newBalance, balance);
                balance = newBalance; 
            }

            const balanceOfAccount = await Thales.balanceOf(beneficiary.address);
            assert.equal(balanceOfAccount, TOTAL_AMOUNT);
        });
	});

    describe('Disable', () => {
        beforeEach(async () => {
            [admin, beneficiary, revoker] = await ethers.getSigners();
            const now = await currentTime();
    
            Thales = await deployContract("Thales");
            VestingEscrow = await deployContract("VestingEscrow", [
                Thales.address,
                (now + 100).toString(),
                (now + 100 + YEAR).toString(),
                true,
                [accounts[2], accounts[3], accounts[4], accounts[5]]
            ]);
        });

        it('should revert on toggle disable', async() => {
            const REVERT = 'VM Exception while processing transaction: revert Admin only';
            await assert.revert(VestingEscrow.connect(revoker).toggleDisable(accounts[1]), REVERT);
        });

        it('should revert on disable canDisable', async() => {
            const REVERT = 'VM Exception while processing transaction: revert Admin only';
            await assert.revert(VestingEscrow.connect(revoker).disableCanDisable(), REVERT);
        });

        it('should initially set disabledAt to zero', async() => {
            assert.equal(await VestingEscrow.disabledAt(accounts[1]), 0);
        })

        it('should disable account at block timestamp', async() => {
            const tx = await VestingEscrow.toggleDisable(accounts[1], {from: admin.address});
            const block = await web3.eth.getBlock(tx.blockNumber);

            assert.equal(await VestingEscrow.disabledAt(accounts[1]), block.timestamp);
        });

        it('should disable account and reenable', async()  => {
            await VestingEscrow.toggleDisable(accounts[1], {from: admin.address});
            await VestingEscrow.toggleDisable(accounts[1], {from: admin.address});

            assert.equal(await VestingEscrow.disabledAt(accounts[1]), 0);
        });

        it('should disable canDisable', async() => {
            await VestingEscrow.disableCanDisable({from: admin.address});
            assert.equal(await VestingEscrow.canDisable(), false);

            const REVERT = 'VM Exception while processing transaction: revert Cannot disable';
            await assert.revert(VestingEscrow.toggleDisable(accounts[1]), REVERT);
        }); 

        it('should disable canDisable and cannot reenable', async() => {
            await VestingEscrow.disableCanDisable({from: admin.address});
            await VestingEscrow.disableCanDisable({from: admin.address});

            assert.equal(await VestingEscrow.canDisable(), false);

        });
    });

    describe('Disable and claim', async() => {
        let startTime, endTime;
        beforeEach(async () => {
            [admin, beneficiary, revoker] = await ethers.getSigners();

            startTime = await currentTime() + 100;
            endTime = startTime + YEAR;
    
            Thales = await deployContract("Thales");
            VestingEscrow = await deployContract("VestingEscrow", [
                Thales.address,
                startTime.toString(),
                endTime.toString(),
                true,
                [accounts[2], accounts[3], accounts[4], accounts[5]]
            ]);

            const recipients = [beneficiary.address, ... new Array(99).fill(ZERO_ADDRESS)];

            await VestingEscrow.addTokens(TOTAL_AMOUNT);
            await VestingEscrow.fund(recipients, [(10**20).toString(), ... new Array(99).fill(0)]);
        });

        it('should disable before start time', async() => {
            await VestingEscrow.toggleDisable(beneficiary.address, {from: admin.address});

            fastForward(53*WEEK);

            await VestingEscrow.connect(beneficiary).claim(beneficiary.address);
            assert.equal(await Thales.balanceOf(beneficiary.address), 0);
        });

        it('should disable after end time', async() => {
            fastForward(53*WEEK);
            await VestingEscrow.toggleDisable(beneficiary.address, {from: admin.address});

            await VestingEscrow.connect(beneficiary).claim(beneficiary.address);
            assert.equal(await Thales.balanceOf(beneficiary.address), toBN(10**20).toString());
        });

        it('should disable before start time and reenable after end time', async() => {
            await VestingEscrow.toggleDisable(beneficiary.address, {from: admin.address});
            
            fastForward(53*WEEK);

            await VestingEscrow.toggleDisable(beneficiary.address, {from: admin.address});
            await VestingEscrow.connect(beneficiary).claim(beneficiary.address);
            assert.equal(await Thales.balanceOf(beneficiary.address), toBN(10**20).toString());            
        });

        it('should disable partially unvested', async() => {
            fastForward(10*WEEK);
            const tx = await VestingEscrow.toggleDisable(beneficiary.address, {from: admin.address});
            const block = await web3.eth.getBlock(tx.blockNumber);

            fastForward(43*WEEK);
            await VestingEscrow.connect(beneficiary).claim(beneficiary.address);

            const expectedAmount = toBN(10**20).mul(toBN(block.timestamp).sub(toBN(startTime))).div(toBN(endTime).sub(toBN(startTime)));
            assert.equal(await Thales.balanceOf(beneficiary.address), expectedAmount.toString());
            assert.equal(await VestingEscrow.totalClaimed(beneficiary.address), expectedAmount.toString());
        });

        it('should disable multiple partial', async() => {
            fastForward(10*WEEK);
            await VestingEscrow.toggleDisable(beneficiary.address, {from: admin.address});
            fastForward(10*WEEK);
            await VestingEscrow.connect(beneficiary).claim(beneficiary.address);
            await VestingEscrow.toggleDisable(beneficiary.address, {from: admin.address});
            const tx = await VestingEscrow.toggleDisable(beneficiary.address, {from: admin.address});
            const block = await web3.eth.getBlock(tx.blockNumber);

            fastForward(33*WEEK);
            await VestingEscrow.connect(beneficiary).claim(beneficiary.address);

            const expectedAmount = toBN(10**20).mul(toBN(block.timestamp).sub(toBN(startTime))).div(toBN(endTime).sub(toBN(startTime)));
            assert.equal(await Thales.balanceOf(beneficiary.address), expectedAmount.toString());
            assert.equal(await VestingEscrow.totalClaimed(beneficiary.address), expectedAmount.toString());

        });
    });

    describe('Vesting Escrow Admin', async() => {
        beforeEach(async () => {
            [admin, beneficiary, revoker] = await ethers.getSigners();
            const now = await currentTime();
    
            Thales = await deployContract("Thales");
            VestingEscrow = await deployContract("VestingEscrow", [
                Thales.address,
                (now + 100).toString(),
                (now + 100 + VESTING_PERIOD).toString(),
                true,
                [accounts[2], accounts[3], accounts[4], accounts[5]]
            ]);
        });

        it('should revert on commit transfer ownership', async() => {
            const REVERT = 'VM Exception while processing transaction: revert Admin only';
            await assert.revert(VestingEscrow.connect(beneficiary).commitTransferOwnership(beneficiary.address), REVERT);
        });

        it('should revert on apply transfer ownership', async() => {
            const REVERT = 'VM Exception while processing transaction: revert Admin only';
            await assert.revert(VestingEscrow.connect(beneficiary).applyTransferOwnership(), REVERT);
        });

        it('should commit transfer ownership', async() => {
            await VestingEscrow.commitTransferOwnership(beneficiary.address);

            assert.equal(await VestingEscrow.admin(), admin.address);
            assert.equal(await VestingEscrow.futureAdmin(), beneficiary.address);
        });

        it('should apply transfer ownership', async() => {
            await VestingEscrow.commitTransferOwnership(beneficiary.address);
            await VestingEscrow.applyTransferOwnership();

            assert.equal(await VestingEscrow.admin(), beneficiary.address);
        });

        it('should revert on apply transfer ownership without commit', async() => {
            const REVERT = 'VM Exception while processing transaction: revert Admin not set';
            await assert.revert(VestingEscrow.applyTransferOwnership(), REVERT);
        });
    });
});

const deployContract = async (name, args) => {
    const factory = await ethers.getContractFactory(name);
    const ctr = await factory.deploy(...(args || []));
    await ctr.deployed();
  
    return ctr;
}
