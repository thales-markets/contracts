'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

const { toBytes32 } = require('../../../index');

var ethers2 = require('ethers');
var crypto = require('crypto');
const fs = require('fs');

const SECOND = 1000;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const YEAR = 31556926;

const {
	fastForward,
	toUnit,
	fromUnit,
	currentTime,
	bytesToString,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();

const {
	onlyGivenAddressCanInvoke,
	convertToDecimals,
	encodeCall,
	assertRevert,
} = require('../../utils/helpers');
const { BN } = require('bn.js');
const { expect } = require('chai');

contract('ParlayAMM', (accounts) => {
	const [
		manager,
		first,
		owner,
		second,
		third,
		fourth,
		safeBox,
		wrapper,
		firstLiquidityProvider,
		defaultLiquidityProvider,
		firstParlayAMMLiquidityProvider,
		defaultParlayAMMLiquidityProvider,
	] = accounts;

	const ZERO_ADDRESS = '0x' + '0'.repeat(40);
	const MAX_NUMBER =
		'115792089237316195423570985008687907853269984665640564039457584007913129639935';

	const SportAMMLiquidityPoolRoundMastercopy = artifacts.require(
		'SportAMMLiquidityPoolRoundMastercopy'
	);
	const SportPositionContract = artifacts.require('SportPosition');
	const SportPositionalMarketContract = artifacts.require('SportPositionalMarket');
	const SportPositionalMarketDataContract = artifacts.require('SportPositionalMarketData');
	const SportPositionalMarketManagerContract = artifacts.require('SportPositionalMarketManager');
	const SportPositionalMarketFactoryContract = artifacts.require('SportPositionalMarketFactory');
	const SportPositionalMarketMasterCopyContract = artifacts.require(
		'SportPositionalMarketMastercopy'
	);
	const SportPositionMasterCopyContract = artifacts.require('SportPositionMastercopy');
	const StakingThalesContract = artifacts.require('StakingThales');
	const SportsAMMContract = artifacts.require('SportsAMM');
	const ThalesContract = artifacts.require('contracts/Token/OpThales_L1.sol:OpThales');
	const SNXRewardsContract = artifacts.require('SNXRewards');
	const AddressResolverContract = artifacts.require('AddressResolverHelper');
	const TestOddsContract = artifacts.require('TestOdds');
	const ReferralsContract = artifacts.require('Referrals');
	const ParlayAMMContract = artifacts.require('ParlayMarketsAMM');
	const ParlayMarketContract = artifacts.require('ParlayMarketMastercopy');
	const ParlayMarketDataContract = artifacts.require('ParlayMarketData');
	const ParlayVerifierContract = artifacts.require('ParlayVerifier');
	const SportsAMMUtils = artifacts.require('SportsAMMUtils');

	let ParlayAMM;
	let ParlayMarket;
	let ParlayMarketData;

	let Thales;
	let answer;
	let minimumPositioningDuration = 0;
	let minimumMarketMaturityDuration = 0;

	let marketQuestion,
		marketSource,
		endOfPositioning,
		fixedTicketPrice,
		positionAmount1,
		positionAmount2,
		positionAmount3,
		withdrawalAllowed,
		tag,
		paymentToken,
		phrases = [],
		deployedMarket,
		outcomePosition,
		outcomePosition2;

	let consumer;
	let TherundownConsumer;
	let TherundownConsumerImplementation;
	let TherundownConsumerDeployed;
	let MockTherundownConsumerWrapper;
	let initializeConsumerData;
	let gamesQueue;
	let game_1_create;
	let game_1_resolve;
	let fightId;
	let fight_create;
	let fightCreated;
	let game_fight_resolve;
	let gamesFightResolved;
	let game_fight_resolve_draw;
	let gamesFightResolvedDraw;
	let reqIdFightCreate;
	let reqIdFightResolve;
	let reqIdFightResolveDraw;
	let gameid1;
	let oddsid;
	let oddsResult;
	let oddsResultArray;
	let reqIdOdds;
	let gameid2;
	let gameid3;
	let game_2_create;
	let game_2_resolve;
	let gamesCreated;
	let gamesResolved;
	let reqIdCreate;
	let reqIdResolve;
	let reqIdFootballCreate;
	let reqIdFootballCreate2;
	let gameFootballid1;
	let gameFootballid2;
	let gameFootballid3;
	let game_1_football_create;
	let game_2_football_create;
	let game_3_football_create;
	let gamesFootballCreated;
	let game_1_football_resolve;
	let game_2_football_resolve;
	let reqIdResolveFoodball;
	let gamesResolvedFootball;
	let GamesOddsObtainerDeployed;

	let nba_create_array,
		gamesCreated_single,
		nba_game_create,
		oddsid_create_all,
		oddsid_create_result_1,
		oddsid_create_result_array_1,
		oddsid_create_result_array_football,
		reqIdOdds_create_1,
		oddsid_create_result_2,
		oddsid_create_result_array_2,
		reqIdOdds_create_2,
		game_1_resolve_spread_total_1,
		gamesResolved_single_1,
		gamesResolved_single_2,
		game_1_resolve_spread_total_2;

	let oddsid_2;
	let oddsResult_2;
	let oddsResultArray_2;
	let reqIdOdds_2;
	let oddsid_1;
	let oddsResult_1;
	let oddsResultArray_1;
	let reqIdOdds_1;
	let oddsid_total;
	let oddsResult_total;
	let oddsResultArray_total;
	let reqIdOdds_total;
	let oddsid_total_update;
	let oddsResult_total_update;
	let oddsResultArray_total_update;
	let reqIdOdds_total_update;
	let oddsid_total_update_line;
	let oddsResult_total_update_line;
	let oddsResultArray_total_update_line;
	let reqIdOdds_total_update_line;
	let oddsid_spread;
	let oddsResult_spread;
	let oddsResultArray_spread;
	let reqIdOdds_spread;
	let oddsid_spread_update;
	let oddsResult_spread_update;
	let oddsResultArray_spread_update;
	let reqIdOdds_spread_update;
	let oddsid_spread_update_line;
	let oddsResult_spread_update_line;
	let oddsResultArray_spread_update_line;
	let reqIdOdds_spread_update_line;

	let SportPositionalMarketManager,
		SportPositionalMarketFactory,
		SportPositionalMarketData,
		SportPositionalMarket,
		SportPositionalMarketMastercopy,
		SportPositionMastercopy,
		ParlayMarketMastercopy,
		StakingThales,
		SNXRewards,
		AddressResolver,
		TestOdds,
		curveSUSD,
		testUSDC,
		testUSDT,
		testDAI,
		Referrals,
		ParlayVerifier,
		SportsAMM,
		SportAMMLiquidityPool,
		ParlayAMMLiquidityPool,
		ParlayPolicy;

	let verifier;

	const game1NBATime = 1646958600;
	const gameFootballTime = 1649876400;
	const fightTime = 1660089600;

	const sportId_4 = 4; // NBA
	const sportId_16 = 16; // CHL
	const sportId_7 = 7; // UFC

	const tagID_4 = 9000 + sportId_4;
	let gameMarket;

	let parlayAMMfee = toUnit('0.05');
	let safeBoxImpact = toUnit('0.02');
	let minUSDAmount = '10';
	let maxSupportedAmount = '20000';
	let maxSupportedOdd = '0.05';

	const usdcQuantity = toBN(10000 * 1e6); //100 USDC
	let parlayMarkets = [];
	let parlayMarkets2 = [];
	let parlayMarkets3 = [];
	let parlayMarkets4 = [];
	let parlayMarkets5 = [];

	let equalParlayMarkets = [];
	let parlayPositions = [];
	let parlaySingleMarketAddress;
	let parlaySingleMarket;
	let voucher, SportAMMRiskManager;
	let emptyArray = [];

	let sportsAMMUtils;
	let lines;
	fs.readFile('./test/contracts/SportMarkets/SGP_mozzart.csv', 'utf8', (err, data) => {
		if (err) throw err;
		lines = data.split('\n').slice(1);
	});

	beforeEach(async () => {
		ParlayVerifier = await ParlayVerifierContract.new({ from: manager });
	});

	describe('Calculations', () => {
		it('get calculations', async () => {
			let sgpFee = 0.85 * 1e18;
			let csvContent;
			let rowContent = '';
			console.log(lines);
			for (let i = 0; i < lines.length - 1; i++) {
				const columns = lines[i].split(',');
				// console.log(columns);
				let odds1 = parseFloat(1 / parseFloat(columns[0])) * 1e18;
				let oddsX = parseFloat(1 / parseFloat(columns[1])) * 1e18;
				let odds2 = parseFloat(1 / parseFloat(columns[2])) * 1e18;
				let oddsOVER = parseFloat(1 / parseFloat(columns[3])) * 1e18;
				let oddsUNDER = parseFloat(1 / parseFloat(columns[4])) * 1e18;
				let odds1andOVER = parseFloat(1 / parseFloat(columns[5])) * 1e18;
				let odds1andUNDER = parseFloat(1 / parseFloat(columns[6])) * 1e18;
				let odds2andOVER = parseFloat(1 / parseFloat(columns[7])) * 1e18;
				let odds2andUNDER = parseFloat(1 / parseFloat(columns[8])) * 1e18;
				rowContent = lines[i].split('\r')[0];
				// console.log("odds1: ", odds1);
				// console.log("odds2andUNDER: ", odds2andUNDER);
				// console.log("rowContent: ", rowContent);
				let result1andOVER = await ParlayVerifier.getSPGOdds(
					odds1.toString(),
					oddsOVER.toString(),
					0,
					sgpFee.toString(),
					'250'
				);
				result1andOVER = parseFloat(result1andOVER.sgpFee2.toString());
				// console.log("result1andOVER: ", result1andOVER);
				result1andOVER = (parseFloat(odds1) * parseFloat(oddsOVER)) / result1andOVER;
				// let diff_1AndOver = result1andOVER > odds1andOVER ? result1andOVER - odds1andOVER : odds1andOVER - result1andOVER;
				let diff_1AndOver = ((odds1andOVER - result1andOVER) / odds1andOVER) * 100;
				// console.log("diff_1AndOver: ", (diff_1AndOver)*100);
				result1andOVER = result1andOVER / 1e18;
				result1andOVER = 1 / result1andOVER;
				if (
					diff_1AndOver > 4.0
					// || diff_1AndOver < -31.0
				) {
					console.log(
						'odds 1: ',
						odds1 / 1e18,
						' odds OVER: ',
						oddsOVER / 1e18,
						'| difference is: ',
						diff_1AndOver
					);
				}

				let result1andUNDER = await ParlayVerifier.getSPGOdds(
					odds1.toString(),
					oddsUNDER.toString(),
					1,
					sgpFee.toString(),
					'250'
				);
				result1andUNDER = parseFloat(result1andUNDER.sgpFee2.toString());
				result1andUNDER = (parseFloat(odds1) * parseFloat(oddsUNDER)) / result1andUNDER;
				let diff_1andUNDER = ((odds1andUNDER - result1andUNDER) / odds1andUNDER) * 100;
				result1andUNDER = result1andUNDER / 1e18;
				result1andUNDER = 1 / result1andUNDER;
				if (
					diff_1andUNDER > 4.0
					// || diff_1andUNDER < -31.0
				) {
					console.log(
						'odds 1: ',
						odds1 / 1e18,
						' odds UNDER: ',
						oddsUNDER / 1e18,
						'| difference is: ',
						diff_1andUNDER
					);
				}

				let result2andOVER = await ParlayVerifier.getSPGOdds(
					odds2.toString(),
					oddsOVER.toString(),
					0,
					sgpFee.toString(),
					'250'
				);
				result2andOVER = parseFloat(result2andOVER.sgpFee2.toString());
				result2andOVER = (parseFloat(odds2) * parseFloat(oddsOVER)) / result2andOVER;
				let diff_2andOVER = ((odds2andOVER - result2andOVER) / odds2andOVER) * 100;
				result2andOVER = result2andOVER / 1e18;
				result2andOVER = 1 / result2andOVER;
				if (
					diff_2andOVER > 4.0
					// || diff_2andOVER < -31.0
				) {
					console.log(
						'odds 2: ',
						odds2 / 1e18,
						' odds OVER: ',
						oddsOVER / 1e18,
						'| difference is: ',
						diff_2andOVER
					);
				}

				let result2andUNDER = await ParlayVerifier.getSPGOdds(
					odds2.toString(),
					oddsUNDER.toString(),
					1,
					sgpFee.toString(),
					'250'
				);
				result2andUNDER = parseFloat(result2andUNDER.sgpFee2.toString());
				result2andUNDER = (parseFloat(odds2) * parseFloat(oddsUNDER)) / result2andUNDER;
				let diff_2andUNDER = ((odds2andUNDER - result2andUNDER) / odds2andUNDER) * 100;
				result2andUNDER = result2andUNDER / 1e18;
				result2andUNDER = 1 / result2andUNDER;

				if (
					diff_2andUNDER > 4.0
					// || diff_2andUNDER < -31.0
				) {
					console.log(
						'odds 2: ',
						odds2 / 1e18,
						' odds UNDER: ',
						oddsUNDER / 1e18,
						'| difference is: ',
						diff_2andUNDER
					);
				}

				rowContent =
					rowContent +
					',' +
					result1andOVER.toString() +
					',' +
					result1andUNDER.toString() +
					',' +
					result2andOVER.toString() +
					',' +
					result2andUNDER.toString();
				// console.log()
				csvContent += rowContent + '\n';
			}
			fs.writeFileSync('./test/contracts/SportMarkets/SGP_mozzart_generated.csv', csvContent);

			// fs.writeFileSync('./test/contracts/SportMarkets/SGP.csv', csvContent);
		});
		// it('generate calculations', async () => {

		// 	let odd1, odd2;
		// 	let sgpFee = 0.85 * 1e18;
		// 	let firstRowOdds = [];
		// 	let result;
		// 	let allResults = [];
		// 	for (let i = 1; i < 100; i++) {
		// 		firstRowOdds[i] = parseFloat(i / 100);
		// 		firstRowOdds[i] = parseFloat(1 / firstRowOdds[i]);
		// 	}
		// 	let csvContent = firstRowOdds.join(',') + '\n';

		// 	// console.log(csvContent);
		// 	let rowContent = '';
		// 	let convertedResult;
		// 	let finalOdds;
		// 	for (let i = 1; i < 100; i++) {
		// 		// let row = [];
		// 		rowContent = parseFloat(1 / parseFloat(i / 100));
		// 		console.log('odd1: ', parseFloat(i / 100));
		// 		for (let j = 1; j < 100; j++) {
		// 			odd1 = i * 1e16;
		// 			odd2 = j * 1e16;
		// 			result = await ParlayVerifier.getSPGOdds(
		// 				odd1.toString(),
		// 				odd2.toString(),
		// 				0,
		// 				sgpFee.toString(),
		// 				'250'
		// 			);
		// 			convertedResult = parseFloat(result.sgpFee2.toString());
		// 			convertedResult = convertedResult / 1e18;
		// 			finalOdds = (parseFloat(i / 100) * parseFloat(j / 100)) / convertedResult;
		// 			// console.log("odd1: ", parseFloat(i/100), "| odd2: ", parseFloat(j/100), "| sgp: ", convertedResult, "| finalOdd: ", finalOdds);
		// 			// row.push(convertedResult);
		// 			finalOdds = parseFloat(1 / finalOdds);
		// 			rowContent += ',' + finalOdds;
		// 		}
		// 		// allResults.push(row);
		// 		csvContent += rowContent + '\n';
		// 	}

		// 	fs.writeFileSync('./test/contracts/SportMarkets/SGP.csv', csvContent);
		// });
	});
});
