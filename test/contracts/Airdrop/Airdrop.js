const { deploymentFixture, getReward } = require('./airdropFixture');
const { assert } = require('../../utils/common');
const { fastForward } = require('../../utils')();
const YEAR = 31556926;
// Airdrop tests
describe('Contract: Airdrop', async () => {
	let acc1, airdrop, merkleTree, snapshot, snapshotHashes;

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
			it("account shouldn't be able to retrieve reward with invalid merkle proof", async () => {
				// Assign the wrong hash to 1st index in order to generate invalid merkle proof
				snapshotHashes[1] = snapshotHashes[0];

				await assert.revert(
					getReward(1, merkleTree, snapshot, snapshotHashes, airdrop, acc1),
					'Proof is not valid'
				);
			});

		it('self destruct', async () => {
			fastForward(YEAR);
			await airdrop._selfDestruct(acc1.address);
			let balance = await token.balanceOf(airdrop.address);
			assert.equal(balance, 0);
		});
	});
});
