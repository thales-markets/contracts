const { deploymentFixture, getReward, getRoot } = require('./ongoingAirdropFixture');
const { assert } = require('../../utils/common');
const { currentTime, fastForward } = require('../../utils')();
const YEAR = 31556926;

// OngoindAirdrop tests
describe('Contract: OndoingAirdrop', async () => {
	let admin, acc1, acc2, ongoingAirdrop, merkleTree, snapshot, snapshotHashes;

	beforeEach(async () => {
		({
			admin,
			acc1,
			acc2,
			ongoingAirdrop,
			escrowThales,
			token,
			merkleTree,
			snapshot,
			snapshotHashes,
		} = await deploymentFixture());
	});

	describe('Ongoing Airdrop rewards', async () => {
		it('snapshot user should be able to retrieve reward', async () => {
			await getReward(1, merkleTree, snapshot, snapshotHashes, ongoingAirdrop, acc1);
		}),
			it("snapshot user shouldn't be able to retrieve reward twice", async () => {
				await getReward(1, merkleTree, snapshot, snapshotHashes, ongoingAirdrop, acc1);
				await assert.revert(
					getReward(1, merkleTree, snapshot, snapshotHashes, ongoingAirdrop, acc1),
					'Tokens have already been claimed'
				);
			}),
			it("account different from airdrop recipient shouldn't be able to retrieve reward", async () => {
				await assert.revert(
					getReward(1, merkleTree, snapshot, snapshotHashes, ongoingAirdrop, acc2),
					'Proof is not valid'
				);
			}),
			it("account shouldn't be able to retrieve reward with invalid merkle proof", async () => {
				// Assign the wrong hash to 1st index in order to generate invalid merkle proof
				snapshotHashes[1] = snapshotHashes[0];

				await assert.revert(
					getReward(1, merkleTree, snapshot, snapshotHashes, ongoingAirdrop, acc1),
					'Proof is not valid'
				);
			});
		it('should change merkle tree root and update period', async () => {
			const root = await getRoot();
			const period = await ongoingAirdrop.period();

			await escrowThales.connect(admin).updateCurrentPeriod();
			await ongoingAirdrop.setRoot(root);

			assert.equal(await ongoingAirdrop.root(), root);
			assert.equal((await ongoingAirdrop.period()).toString(), parseInt(period.toString()) + 1);
		}),
			it('snapshot user should be able to retrieve reward in new staking period', async () => {
				const root = await getRoot();

				await escrowThales.connect(admin).updateCurrentPeriod();
				await ongoingAirdrop.setRoot(root);
				await getReward(1, merkleTree, snapshot, snapshotHashes, ongoingAirdrop, acc1);
			}),
			it("snapshot user shouldn't be able to retrieve reward twice in new staking period", async () => {
				const root = await getRoot();

				await escrowThales.connect(admin).updateCurrentPeriod();
				await ongoingAirdrop.setRoot(root);
				await getReward(1, merkleTree, snapshot, snapshotHashes, ongoingAirdrop, acc1);
				await assert.revert(
					getReward(1, merkleTree, snapshot, snapshotHashes, ongoingAirdrop, acc1),
					'Tokens have already been claimed'
				);
			}),
			it('self destruct', async () => {
				await fastForward(YEAR);
				await ongoingAirdrop._selfDestruct(acc1.address);
				let balance = await token.balanceOf(ongoingAirdrop.address);
				assert.equal(balance, 0);
			});
	});
});
