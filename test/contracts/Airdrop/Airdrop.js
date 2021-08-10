const { deploymentFixture, getReward } = require('./fixture');
const { assert } = require('../../utils/common');

// Airdrop tests
describe('Contract: Airdrop', async () => {
	let acc1, acc2, airdrop, merkleTree, snapshot, snapshotHashes;

	beforeEach(async () => {
		({
			acc1,
			acc2,
			airdrop,
			token,
			merkleTree,
			snapshot,
			snapshotHashes,
		} = await deploymentFixture());
	});

	describe('Airdrop rewards', async () => {
		it('snapshot user should be able to retrieve reward', async () => {
			await getReward(1, merkleTree, snapshot, snapshotHashes, airdrop, acc1);
		}),
			it("snapshot user shouldn't be able to retrieve reward twice", async () => {
				await getReward(1, merkleTree, snapshot, snapshotHashes, airdrop, acc1);
				await assert.revert(
					getReward(1, merkleTree, snapshot, snapshotHashes, airdrop, acc1),
					'Tokens have already been claimed'
				);
			}),
			it("account different from airdrop recipient shouldn't be able to retrieve reward", async () => {
				await assert.revert(
					getReward(1, merkleTree, snapshot, snapshotHashes, airdrop, acc2),
					'The reward recipient should be the transaction sender'
				);
			}),
			it("account shouldn't be able to retrieve reward with invalid merkle proof", async () => {
				// Assign the wrong hash to 1st index in order to generate invalid merkle proof
				snapshotHashes[1] = snapshotHashes[0];

				await assert.revert(
					getReward(1, merkleTree, snapshot, snapshotHashes, airdrop, acc1),
					'Proof is not valid'
				);
			});

		it('should be able to recover token', async () => {
			await airdrop.recoverToken();
			let balance = await token.balanceOf(airdrop.address);
			assert.equal(balance, 0);
		});
	});
});
