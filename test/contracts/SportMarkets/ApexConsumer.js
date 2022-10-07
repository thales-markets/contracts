'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const w3utils = require('web3-utils');

const { assert } = require('../../utils/common');

const SECOND = 1000;
const HOUR = 3600;

const { fastForward, toUnit, currentTime } = require('../../utils')();

contract('ApexConsumer', (accounts) => {
	const [manager, first, owner, second, third, wrapper] = accounts;

	const ZERO_ADDRESS = '0x' + '0'.repeat(40);

	const SportPositionContract = artifacts.require('SportPosition');
	const SportPositionalMarketContract = artifacts.require('SportPositionalMarket');
	const SportPositionalMarketManagerContract = artifacts.require('SportPositionalMarketManager');
	const SportPositionalMarketFactoryContract = artifacts.require('SportPositionalMarketFactory');
	const SportsAMMContract = artifacts.require('SportsAMM');
	const ThalesContract = artifacts.require('contracts/Token/OpThales_L1.sol:OpThales');
	let Thales;

	let deployedMarket;
	let ApexConsumer;
	let ApexConsumerDeployed;
	let gameid1;

	let SportPositionalMarketManager,
		SportPositionalMarketFactory,
		SportPositionalMarketMastercopy,
		SportPositionMastercopy,
		SportsAMM;

	let reqIdCreateRace;
	let reqIdCreateGame;
	let reqIdResolveGame;

	const eventId = 'f1r_16_22';
	const betType = 'outright_head_to_head_1';
	const eventName = 'Formula 1 race';

	const game1qualifyingStartTime = 1663094759;
	const game1raceStartTime = 1663181159;
	const game1homeOddsPre = 5380;
	const game1awayOddsPre = 4620;
	const game1homeNormalizedOddsPre = 0.538;
	const game1awayNormalizedOddsPre = 0.462;
	const game1homeOddsPost = 5100;
	const game1awayOddsPost = 4900;
	const game1homeNormalizedOddsPost = 0.51;
	const game1awayNormalizedOddsPost = 0.49;
	const invalidOdds = 0;
	const game1homeTeam = 'lance stroll';
	const game1awayTeam = 'daniel ricciardo';
	const game1betType = 0;

	const homeWinResult = 'win/lose';
	const homeWinResultDetails = '4.0/6.0';

	const awayWinResult = 'lose/win';
	const awayWinResultDetails = '15.0/1.0';

	const cancelResult = 'null';
	const cancelResultDetails = 'DNF/DNF';

	const sportFormula1 = 'formula1';
	const sportMotoGP = 'motogp';
	const sportFootball = 'football';

	const tagFormula1 = 9100;

	const statusCancelled = 0;
	const statusResolved = 1;

	const outcomeHomeWin = 1;
	const outcomeAwayWin = 2;

	const cancelScore = 0;
	const loseScore = 0;
	const winScore = 1;

	beforeEach(async () => {
		SportPositionalMarketManager = await SportPositionalMarketManagerContract.new({
			from: manager,
		});
		SportPositionalMarketFactory = await SportPositionalMarketFactoryContract.new({
			from: manager,
		});
		SportPositionalMarketMastercopy = await SportPositionalMarketContract.new({ from: manager });
		SportPositionMastercopy = await SportPositionContract.new({ from: manager });
		SportsAMM = await SportsAMMContract.new({ from: manager });

		Thales = await ThalesContract.new({ from: owner });

		await SportPositionalMarketManager.initialize(manager, Thales.address, { from: manager });
		await SportPositionalMarketFactory.initialize(manager, { from: manager });

		await SportPositionalMarketFactory.setSportPositionalMarketManager(
			SportPositionalMarketManager.address,
			{ from: manager }
		);
		await SportPositionalMarketFactory.setSportPositionalMarketMastercopy(
			SportPositionalMarketMastercopy.address,
			{ from: manager }
		);
		await SportPositionalMarketFactory.setSportPositionMastercopy(SportPositionMastercopy.address, {
			from: manager,
		});
		await SportPositionalMarketFactory.setSportsAMM(SportsAMM.address, { from: manager });
		await SportPositionalMarketManager.setSportPositionalMarketFactory(
			SportPositionalMarketFactory.address,
			{ from: manager }
		);

		await Thales.transfer(first, toUnit('1000'), { from: owner });
		await Thales.transfer(second, toUnit('1000'), { from: owner });
		await Thales.transfer(third, toUnit('1000'), { from: owner });

		// ids
		gameid1 = '0x6631725f31365f32325f6832685f310000000000000000000000000000000000';

		// create race props
		reqIdCreateRace = '0x1b294afd4adcabc9aac0b0d430f25314b78fb81b8f9142fdab9c9bfa835ba10d';
		// create game props
		reqIdCreateGame = '0x2b7e6e95a1516d366d0e4b3504a2e399f7422556d5e03843be07e74e8de01db1';
		// resolve game props
		reqIdResolveGame = '0x386e5fbffec077b65c383c01bfb76072410848edf787dab58d0bfec003916df3';

		ApexConsumer = artifacts.require('ApexConsumer');
		ApexConsumerDeployed = await ApexConsumer.new();

		await ApexConsumerDeployed.initialize(
			owner,
			[sportFormula1, sportMotoGP],
			SportPositionalMarketManager.address,
			{ from: owner }
		);
		await Thales.transfer(ApexConsumerDeployed.address, toUnit('1000'), { from: owner });

		await ApexConsumerDeployed.setSportContracts(wrapper, SportPositionalMarketManager.address, {
			from: owner,
		});
		await ApexConsumerDeployed.addToWhitelist(third, true, { from: owner });
		await SportPositionalMarketManager.setApexConsumer(ApexConsumerDeployed.address, {
			from: manager,
		});
	});

	describe('Init', () => {
		it('Check init', async () => {
			assert.equal(true, await ApexConsumerDeployed.isSupportedSport('formula1'));
			assert.equal(true, await ApexConsumerDeployed.isSupportedSport('motogp'));
			assert.equal(false, await ApexConsumerDeployed.isSupportedSport('football'));
			assert.equal(false, await ApexConsumerDeployed.isSupportedSport('basketball'));
		});
	});

	describe('Fulfill Game Created', () => {
		it('Fulfill Game Created - Formula 1, create market, check results', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			await expect(
				ApexConsumerDeployed.fulfillMetaData(
					reqIdCreateRace,
					eventId,
					betType,
					eventName,
					game1qualifyingStartTime,
					game1raceStartTime,
					sportFormula1,
					{ from: first }
				)
			).to.be.revertedWith('Only wrapper can call this function');

			// req. create race
			const txCreateRace = await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);

			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));
			assert.equal(eventId, await ApexConsumerDeployed.latestRaceIdPerSport(sportFormula1));

			let race = await ApexConsumerDeployed.raceCreated(eventId);
			assert.bnEqual(game1qualifyingStartTime, race.qualifyingStartTime);
			assert.bnEqual(game1raceStartTime, race.startTime);
			assert.equal(eventName, race.eventName);

			const sportId = await ApexConsumerDeployed.supportedSportId(sportFormula1);

			// check if event is emited
			assert.eventEqual(txCreateRace.logs[0], 'RaceCreated', {
				_requestId: reqIdCreateRace,
				_sportId: sportId,
				_id: eventId,
				_race: race,
			});

			await expect(
				ApexConsumerDeployed.createMarketForGame(gameid1, {
					from: owner,
				})
			).to.be.revertedWith('No such game fulfilled, created');
			assert.equal(false, await ApexConsumerDeployed.isApexGame(gameid1));

			await expect(
				ApexConsumerDeployed.fulfillMatchup(
					reqIdCreateGame,
					game1homeTeam,
					game1awayTeam,
					game1homeOddsPre,
					game1awayOddsPre,
					gameid1,
					sportFormula1,
					eventId,
					false,
					game1betType,
					{ from: first }
				)
			).to.be.revertedWith('Only wrapper can call this function');

			// req. create game
			const txCreateGame = await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPre,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);

			assert.bnEqual(sportId, await ApexConsumerDeployed.sportsIdPerGame(gameid1));
			assert.equal(true, await ApexConsumerDeployed.isSupportedSport(sportFormula1));
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));
			assert.equal(true, await ApexConsumerDeployed.isApexGame(gameid1));

			let odds = await ApexConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(game1homeOddsPre, odds[0]);
			assert.bnEqual(game1awayOddsPre, odds[1]);
			assert.bnEqual(0, odds[2]);

			let game = await ApexConsumerDeployed.gameCreated(gameid1);
			assert.bnEqual(game1raceStartTime, game.startTime);
			assert.equal(game1homeTeam, game.homeTeam);
			assert.equal(game1awayTeam, game.awayTeam);
			assert.equal(game1betType, game.betType);

			// check if event is emited
			assert.eventEqual(txCreateGame.logs[0], 'GameCreated', {
				_requestId: reqIdCreateGame,
				_sportId: sportId,
				_id: gameid1,
				_game: game,
			});

			await expect(
				ApexConsumerDeployed.createMarketForGame(gameid1, {
					from: first,
				})
			).to.be.revertedWith('Invalid caller');

			// create market
			const txCreateMarket = await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});

			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));
			assert.equal(gameid1, await ApexConsumerDeployed.gameIdPerMarket(marketAddress));

			// check if event is emited
			assert.eventEqual(txCreateMarket.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
				_game: game,
			});

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(tagFormula1, await deployedMarket.tags(0));

			await expect(
				ApexConsumerDeployed.createMarketForGame(gameid1, {
					from: owner,
				})
			).to.be.revertedWith('Market for game already exists');

			assert.equal(
				false,
				await ApexConsumerDeployed.isGamePausedByNonExistingPostQualifyingOdds(gameid1)
			);

			await fastForward(game1qualifyingStartTime - (await currentTime()) + SECOND);

			assert.equal(
				true,
				await ApexConsumerDeployed.isGamePausedByNonExistingPostQualifyingOdds(gameid1)
			);
			odds = await ApexConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(0, odds[0]);
			assert.bnEqual(0, odds[1]);
			assert.bnEqual(0, odds[2]);
			let gameOdds = await ApexConsumerDeployed.gameOdds(gameid1);
			assert.equal(false, gameOdds.arePostQualifyingOddsFetched);

			// send again "pre" as qualifying status
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPost,
				game1awayOddsPost,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(
				true,
				await ApexConsumerDeployed.isGamePausedByNonExistingPostQualifyingOdds(gameid1)
			);
			odds = await ApexConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(0, odds[0]);
			assert.bnEqual(0, odds[1]);
			assert.bnEqual(0, odds[2]);
			gameOdds = await ApexConsumerDeployed.gameOdds(gameid1);
			assert.equal(false, gameOdds.arePostQualifyingOddsFetched);

			// send "post" as qualifying status
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPost,
				game1awayOddsPost,
				gameid1,
				sportFormula1,
				eventId,
				true,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(
				false,
				await ApexConsumerDeployed.isGamePausedByNonExistingPostQualifyingOdds(gameid1)
			);
			odds = await ApexConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(game1homeOddsPost, odds[0]);
			assert.bnEqual(game1awayOddsPost, odds[1]);
			assert.bnEqual(0, odds[2]);
			gameOdds = await ApexConsumerDeployed.gameOdds(gameid1);
			assert.equal(true, gameOdds.arePostQualifyingOddsFetched);
		});

		it('Fulfill Game Created - game not created', async () => {
			// no race created
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPre,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(false, await ApexConsumerDeployed.raceFulfilledCreated(eventId));
			assert.equal(false, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// race in the past
			await fastForward(game1raceStartTime - (await currentTime()) + SECOND);
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPre,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(false, await ApexConsumerDeployed.raceFulfilledCreated(eventId));
			assert.equal(false, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// invalid odds
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				invalidOdds,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));
			assert.equal(false, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));
		});
	});

	describe('Fulfill Game Resolved', () => {
		it('Fulfill Game Resolved - Formula 1, resolve market (HOME WIN), check results', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPre,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());

			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPost,
				game1awayOddsPost,
				gameid1,
				sportFormula1,
				eventId,
				true,
				game1betType,
				{ from: wrapper }
			);

			await fastForward(game1raceStartTime - (await currentTime()) + SECOND);

			assert.equal(true, await deployedMarket.canResolve());
			assert.equal(false, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			await expect(
				ApexConsumerDeployed.fulfillResults(
					reqIdResolveGame,
					homeWinResult,
					homeWinResultDetails,
					gameid1,
					sportFormula1,
					{ from: first }
				)
			).to.be.revertedWith('Only wrapper can call this function');

			const txResolveGame = await ApexConsumerDeployed.fulfillResults(
				reqIdResolveGame,
				homeWinResult,
				homeWinResultDetails,
				gameid1,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledResolved(gameid1));
			assert.equal(true, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			let gameResolved = await ApexConsumerDeployed.gameResolved(gameid1);
			assert.equal(winScore, gameResolved.homeScore);
			assert.equal(loseScore, gameResolved.awayScore);
			assert.equal(statusResolved, gameResolved.statusId);

			const sportId = await ApexConsumerDeployed.supportedSportId(sportFormula1);

			assert.eventEqual(txResolveGame.logs[0], 'GameResolved', {
				_requestId: reqIdResolveGame,
				_sportId: sportId,
				_id: gameid1,
				_game: gameResolved,
			});

			await expect(
				ApexConsumerDeployed.resolveMarketForGame(gameid1, {
					from: first,
				})
			).to.be.revertedWith('Invalid caller');

			// resolve markets
			const txResolveMarket = await ApexConsumerDeployed.resolveMarketForGame(gameid1, {
				from: owner,
			});
			assert.equal(true, await ApexConsumerDeployed.marketResolved(marketAddress));

			// check if event is emited
			assert.eventEqual(txResolveMarket.logs[0], 'ResolveSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
				_outcome: outcomeHomeWin,
			});
		});

		it('Fulfill Game Resolved - Formula 1, resolve market (AWAY WIN), check results', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPre,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());

			await fastForward(game1raceStartTime - (await currentTime()) + SECOND);

			assert.equal(true, await deployedMarket.canResolve());
			assert.equal(false, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			await expect(
				ApexConsumerDeployed.resolveMarketForGame(gameid1, {
					from: owner,
				})
			).to.be.revertedWith('No such game fulfilled, resolved');

			const txResolveGame = await ApexConsumerDeployed.fulfillResults(
				reqIdResolveGame,
				awayWinResult,
				awayWinResultDetails,
				gameid1,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledResolved(gameid1));
			assert.equal(true, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			let gameResolved = await ApexConsumerDeployed.gameResolved(gameid1);
			assert.equal(loseScore, gameResolved.homeScore);
			assert.equal(winScore, gameResolved.awayScore);
			assert.equal(statusResolved, gameResolved.statusId);

			const sportId = await ApexConsumerDeployed.supportedSportId(sportFormula1);

			assert.eventEqual(txResolveGame.logs[0], 'GameResolved', {
				_requestId: reqIdResolveGame,
				_sportId: sportId,
				_id: gameid1,
				_game: gameResolved,
			});

			// resolve markets
			const txResolveMarket = await ApexConsumerDeployed.resolveMarketForGame(gameid1, {
				from: owner,
			});
			assert.equal(true, await ApexConsumerDeployed.marketResolved(marketAddress));

			// check if event is emited
			assert.eventEqual(txResolveMarket.logs[0], 'ResolveSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
				_outcome: outcomeAwayWin,
			});

			await expect(
				ApexConsumerDeployed.resolveMarketForGame(gameid1, {
					from: owner,
				})
			).to.be.revertedWith('Market resolved or canceled');
		});

		it('Fulfill Game Resolved - Formula 1, resolve market (CANCEL), game time has passed, cancel market, automatically', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPre,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());

			await fastForward(game1raceStartTime - (await currentTime()) + SECOND);

			assert.equal(true, await deployedMarket.canResolve());
			assert.equal(false, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			const txResolveGame = await ApexConsumerDeployed.fulfillResults(
				reqIdResolveGame,
				cancelResult,
				cancelResultDetails,
				gameid1,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledResolved(gameid1));
			assert.equal(false, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			let gameResolved = await ApexConsumerDeployed.gameResolved(gameid1);
			assert.equal(cancelScore, gameResolved.homeScore);
			assert.equal(cancelScore, gameResolved.awayScore);
			assert.equal(statusCancelled, gameResolved.statusId);

			const sportId = await ApexConsumerDeployed.supportedSportId(sportFormula1);

			assert.eventEqual(txResolveGame.logs[0], 'GameResolved', {
				_requestId: reqIdResolveGame,
				_sportId: sportId,
				_id: gameid1,
				_game: gameResolved,
			});

			// resolve markets
			const txCancelMarket = await ApexConsumerDeployed.resolveMarketForGame(gameid1, {
				from: owner,
			});
			assert.equal(false, await ApexConsumerDeployed.marketResolved(marketAddress));
			assert.equal(true, await ApexConsumerDeployed.marketCanceled(marketAddress));

			// check if event is emited
			assert.eventEqual(txCancelMarket.logs[0], 'CancelSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
			});

			await expect(
				ApexConsumerDeployed.resolveMarketForGame(gameid1, {
					from: owner,
				})
			).to.be.revertedWith('Market resolved or canceled');
		});

		it('Fulfill Game Resolved - Formula 1, resolve market (CANCEL), game time has not passed, first pause, then cancel automatically after it is passed', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPre,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(false, await deployedMarket.paused());
			assert.equal(false, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			const txResolveGame = await ApexConsumerDeployed.fulfillResults(
				reqIdResolveGame,
				cancelResult,
				cancelResultDetails,
				gameid1,
				sportFormula1,
				{ from: wrapper }
			);
			// not canceled part only paused
			assert.equal(false, await ApexConsumerDeployed.gameFulfilledResolved(gameid1));
			assert.equal(false, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));
			assert.equal(true, await ApexConsumerDeployed.isPausedByCanceledStatus(marketAddress));
			assert.equal(true, await deployedMarket.paused());

			// there is no result yet
			let gameResolved = await ApexConsumerDeployed.gameResolved(gameid1);
			assert.equal(0, gameResolved.homeScore);
			assert.equal(0, gameResolved.awayScore);
			assert.equal(0, gameResolved.statusId);

			// check if event is emited
			assert.eventEqual(txResolveGame.logs[0], 'PauseSportsMarket', {
				_marketAddress: marketAddress,
				_pause: true,
			});

			// canceling part when time has arrived
			await fastForward(game1raceStartTime - (await currentTime()) + SECOND);

			// paused
			assert.equal(true, await deployedMarket.paused());
			// paused can not be resolved
			assert.equal(false, await deployedMarket.canResolve());
			// stil not canceled
			assert.equal(false, await deployedMarket.cancelled());

			const txSecondResolveGame = await ApexConsumerDeployed.fulfillResults(
				reqIdResolveGame,
				cancelResult,
				cancelResultDetails,
				gameid1,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledResolved(gameid1));

			gameResolved = await ApexConsumerDeployed.gameResolved(gameid1);
			assert.equal(cancelScore, gameResolved.homeScore);
			assert.equal(cancelScore, gameResolved.awayScore);
			assert.equal(statusCancelled, gameResolved.statusId);

			const sportId = await ApexConsumerDeployed.supportedSportId(sportFormula1);

			// check if event is emited
			assert.eventEqual(txSecondResolveGame.logs[0], 'GameResolved', {
				_requestId: reqIdResolveGame,
				_sportId: sportId,
				_id: gameid1,
				_game: gameResolved,
			});

			// resolve markets
			const txCancelMarket = await ApexConsumerDeployed.resolveMarketForGame(gameid1, {
				from: owner,
			});
			assert.equal(false, await ApexConsumerDeployed.marketResolved(marketAddress));
			assert.equal(true, await ApexConsumerDeployed.marketCanceled(marketAddress));

			// check if event is emited
			assert.eventEqual(txCancelMarket.logs[0], 'CancelSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
			});

			assert.equal(false, await deployedMarket.paused());
			assert.equal(true, await deployedMarket.cancelled());

			await expect(
				ApexConsumerDeployed.resolveMarketForGame(gameid1, {
					from: owner,
				})
			).to.be.revertedWith('Market resolved or canceled');
		});
	});

	describe('Game resolve/cancel manually', () => {
		it('Resolve market manually (AWAY WIN), check results', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPre,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());

			await fastForward(game1raceStartTime - (await currentTime()) + SECOND);

			assert.equal(true, await deployedMarket.canResolve());

			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 2, 1, 1, { from: second })
			).to.be.revertedWith('Invalid caller');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 4, 1, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 2, 2, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 2, 1, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 1, 1, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 1, 1, 2, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 0, 1, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(second, outcomeAwayWin, loseScore, winScore, {
					from: third,
				})
			).to.be.revertedWith('No market created for game');

			const txResolveGame = await ApexConsumerDeployed.resolveMarketManually(
				marketAddress,
				outcomeAwayWin,
				loseScore,
				winScore,
				{
					from: third,
				}
			);

			const sportId = await ApexConsumerDeployed.supportedSportId(sportFormula1);

			// check if event is emited
			assert.eventEqual(txResolveGame.logs[0], 'GameResolved', {
				_requestId: gameid1,
				_sportId: sportId,
				_id: gameid1,
			});

			// check if event is emited
			assert.eventEqual(txResolveGame.logs[1], 'ResolveSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
				_outcome: outcomeAwayWin,
			});

			await expect(
				ApexConsumerDeployed.resolveMarketManually(
					marketAddress,
					outcomeAwayWin,
					loseScore,
					winScore,
					{
						from: third,
					}
				)
			).to.be.revertedWith('Market resolved or canceled');
		});

		it('Resolve market manually (HOME WIN), check results', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPre,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());

			await fastForward(game1raceStartTime - (await currentTime()) + SECOND);

			assert.equal(true, await deployedMarket.canResolve());
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 2, 1, 2, { from: second })
			).to.be.revertedWith('Invalid caller');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 4, 0, 0, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(second, outcomeHomeWin, winScore, loseScore, {
					from: third,
				})
			).to.be.revertedWith('No market created for game');

			const txResolveMarket = await ApexConsumerDeployed.resolveMarketManually(
				marketAddress,
				outcomeHomeWin,
				winScore,
				loseScore,
				{
					from: third,
				}
			);

			const sportId = await ApexConsumerDeployed.supportedSportId(sportFormula1);

			// check if event is emited
			assert.eventEqual(txResolveMarket.logs[0], 'GameResolved', {
				_requestId: gameid1,
				_sportId: sportId,
				_id: gameid1,
			});

			// check if event is emited
			assert.eventEqual(txResolveMarket.logs[1], 'ResolveSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
				_outcome: outcomeHomeWin,
			});

			await expect(
				ApexConsumerDeployed.resolveMarketManually(
					marketAddress,
					outcomeHomeWin,
					winScore,
					loseScore,
					{ from: third }
				)
			).to.be.revertedWith('Market resolved or canceled');
		});

		it('Cancel market manually, check results', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPre,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());

			await fastForward(game1raceStartTime - (await currentTime()) + SECOND);

			await expect(
				ApexConsumerDeployed.cancelMarketManually(marketAddress, { from: second })
			).to.be.revertedWith('Invalid caller');
			await expect(
				ApexConsumerDeployed.cancelMarketManually(second, { from: third })
			).to.be.revertedWith('No market created for game');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 3, 0, 0, { from: third })
			).to.be.revertedWith('Bad result or outcome');

			const txCancelMarket = await ApexConsumerDeployed.cancelMarketManually(marketAddress, {
				from: third,
			});

			// check if event is emited
			assert.eventEqual(txCancelMarket.logs[0], 'CancelSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
			});

			await expect(
				ApexConsumerDeployed.resolveMarketManually(
					marketAddress,
					outcomeHomeWin,
					winScore,
					loseScore,
					{
						from: third,
					}
				)
			).to.be.revertedWith('Market resolved or canceled');
			await expect(
				ApexConsumerDeployed.cancelMarketManually(marketAddress, { from: third })
			).to.be.revertedWith('Market resolved or canceled');
		});
	});

	describe('Odds for game', () => {
		it('Get odds per game, check results, valid odds', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			const txCreateGame = await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPre,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			let odds = await ApexConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(game1homeOddsPre, odds[0]);
			assert.bnEqual(game1awayOddsPre, odds[1]);
			assert.bnEqual(0, odds[2]);

			const parsedHomeNormalizedOddsPre = w3utils.toWei(game1homeNormalizedOddsPre.toString());
			const parsedAwayNormalizedOddsPre = w3utils.toWei(game1awayNormalizedOddsPre.toString());

			let normalizedOdds = await ApexConsumerDeployed.getNormalizedOdds(gameid1);
			assert.bnEqual(parsedHomeNormalizedOddsPre, normalizedOdds[0]);
			assert.bnEqual(parsedAwayNormalizedOddsPre, normalizedOdds[1]);
			assert.bnEqual(0, normalizedOdds[2]);

			let gameOdds = await ApexConsumerDeployed.gameOdds(gameid1);

			// check if event is emited
			assert.eventEqual(txCreateGame.logs[1], 'GameOddsAdded', {
				_requestId: reqIdCreateGame,
				_id: gameid1,
				_game: gameOdds,
			});

			assert.equal(
				false,
				await ApexConsumerDeployed.isGamePausedByNonExistingPostQualifyingOdds(gameid1)
			);

			await fastForward(game1qualifyingStartTime - (await currentTime()) + SECOND);

			assert.equal(
				true,
				await ApexConsumerDeployed.isGamePausedByNonExistingPostQualifyingOdds(gameid1)
			);

			odds = await ApexConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(0, odds[0]);
			assert.bnEqual(0, odds[1]);
			assert.bnEqual(0, odds[2]);

			normalizedOdds = await ApexConsumerDeployed.getNormalizedOdds(gameid1);
			assert.bnEqual(0, normalizedOdds[0]);
			assert.bnEqual(0, normalizedOdds[1]);
			assert.bnEqual(0, normalizedOdds[2]);

			gameOdds = await ApexConsumerDeployed.gameOdds(gameid1);
			assert.equal(false, gameOdds.arePostQualifyingOddsFetched);

			// send again "pre" as qualifying status
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPost,
				game1awayOddsPost,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(
				true,
				await ApexConsumerDeployed.isGamePausedByNonExistingPostQualifyingOdds(gameid1)
			);

			odds = await ApexConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(0, odds[0]);
			assert.bnEqual(0, odds[1]);
			assert.bnEqual(0, odds[2]);

			normalizedOdds = await ApexConsumerDeployed.getNormalizedOdds(gameid1);
			assert.bnEqual(0, normalizedOdds[0]);
			assert.bnEqual(0, normalizedOdds[1]);
			assert.bnEqual(0, normalizedOdds[2]);

			gameOdds = await ApexConsumerDeployed.gameOdds(gameid1);
			assert.equal(false, gameOdds.arePostQualifyingOddsFetched);

			// get "post" odds
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPost,
				game1awayOddsPost,
				gameid1,
				sportFormula1,
				eventId,
				true,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(
				false,
				await ApexConsumerDeployed.isGamePausedByNonExistingPostQualifyingOdds(gameid1)
			);

			odds = await ApexConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(game1homeOddsPost, odds[0]);
			assert.bnEqual(game1awayOddsPost, odds[1]);
			assert.bnEqual(0, odds[2]);

			const parsedHomeNormalizedOddsPost = w3utils.toWei(game1homeNormalizedOddsPost.toString());
			const parsedAwayNormalizedOddsPost = w3utils.toWei(game1awayNormalizedOddsPost.toString());

			normalizedOdds = await ApexConsumerDeployed.getNormalizedOdds(gameid1);
			assert.bnEqual(parsedHomeNormalizedOddsPost, normalizedOdds[0]);
			assert.bnEqual(parsedAwayNormalizedOddsPost, normalizedOdds[1]);
			assert.bnEqual(0, normalizedOdds[2]);

			gameOdds = await ApexConsumerDeployed.gameOdds(gameid1);
			assert.equal(true, gameOdds.arePostQualifyingOddsFetched);
		});

		it('Get odds per game, check results, invalid odds, pause market, unpause once odds are valid', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game.
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPre,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			let odds = await ApexConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(game1homeOddsPre, odds[0]);
			assert.bnEqual(game1awayOddsPre, odds[1]);
			assert.bnEqual(0, odds[2]);

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.paused());

			// invalid odds - zero as homeOdds
			const txGetInvalidOdds = await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				invalidOdds,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);

			assert.equal(true, await deployedMarket.paused());
			assert.equal(true, await ApexConsumerDeployed.invalidOdds(marketAddress));

			let gameOdds = await ApexConsumerDeployed.gameOdds(gameid1);
			let newOdds = {
				gameId: gameOdds.gameId,
				homeOdds: toBN(invalidOdds),
				awayOdds: gameOdds.awayOdds,
				drawOdds: gameOdds.drawOdds,
			};

			// check if event is emited
			assert.eventEqual(txGetInvalidOdds.logs[0], 'PauseSportsMarket', {
				_marketAddress: marketAddress,
				_pause: true,
			});
			assert.eventEqual(txGetInvalidOdds.logs[1], 'InvalidOddsForMarket', {
				_requestId: reqIdCreateGame,
				_id: gameid1,
				_game: newOdds,
			});

			// valid odds
			const txGetValidOdds = await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOddsPre,
				game1awayOddsPre,
				gameid1,
				sportFormula1,
				eventId,
				false,
				game1betType,
				{ from: wrapper }
			);

			assert.equal(false, await deployedMarket.paused());
			assert.equal(false, await ApexConsumerDeployed.invalidOdds(marketAddress));

			let validGameOdds = await ApexConsumerDeployed.gameOdds(gameid1);

			// check if event is emited
			assert.eventEqual(txGetValidOdds.logs[1], 'GameOddsAdded', {
				_requestId: reqIdCreateGame,
				_id: gameid1,
				_game: validGameOdds,
			});
		});
	});

	describe('Consumer management', () => {
		it('Test owner functions', async () => {
			// ====== setSupportedSport ======
			await expect(
				ApexConsumerDeployed.setSupportedSport(sportFootball, false, { from: wrapper })
			).to.be.revertedWith('Only the contract owner may perform this action');
			await expect(
				ApexConsumerDeployed.setSupportedSport(sportFormula1, true, { from: owner })
			).to.be.revertedWith('Already set');

			const txSupportedSport = await ApexConsumerDeployed.setSupportedSport(sportFootball, true, {
				from: owner,
			});
			// check if event is emited
			assert.eventEqual(txSupportedSport.logs[0], 'SupportedSportsChanged', {
				_sport: sportFootball,
				_isSupported: true,
			});
			assert.equal(true, await ApexConsumerDeployed.isSupportedSport(sportFootball));

			// ====== setSportContracts ======
			await expect(
				ApexConsumerDeployed.setSportContracts(first, second, { from: wrapper })
			).to.be.revertedWith('Only the contract owner may perform this action');
			await expect(
				ApexConsumerDeployed.setSportContracts(ZERO_ADDRESS, ZERO_ADDRESS, {
					from: owner,
				})
			).to.be.revertedWith('Invalid addreses');

			const txSportsManager = await ApexConsumerDeployed.setSportContracts(first, second, {
				from: owner,
			});
			// check if event is emited
			assert.eventEqual(txSportsManager.logs[0], 'NewSportContracts', {
				_wrapperAddress: first,
				_sportsManager: second,
			});
			assert.equal(first, await ApexConsumerDeployed.wrapperAddress());
			assert.equal(second, await ApexConsumerDeployed.sportsManager());

			// ====== addToWhitelist ======
			await expect(
				ApexConsumerDeployed.addToWhitelist(first, false, { from: wrapper })
			).to.be.revertedWith('Only the contract owner may perform this action');
			await expect(
				ApexConsumerDeployed.addToWhitelist(owner, true, { from: owner })
			).to.be.revertedWith('Already set to that flag');
			await expect(
				ApexConsumerDeployed.addToWhitelist(ZERO_ADDRESS, true, { from: owner })
			).to.be.revertedWith('Invalid address');

			const txAddToWhitelist = await ApexConsumerDeployed.addToWhitelist(first, true, {
				from: owner,
			});
			// check if event is emited
			assert.eventEqual(txAddToWhitelist.logs[0], 'AddedIntoWhitelist', {
				_whitelistAddress: first,
				_flag: true,
			});
			assert.equal(true, await ApexConsumerDeployed.whitelistedAddresses(first));
		});
	});
});
