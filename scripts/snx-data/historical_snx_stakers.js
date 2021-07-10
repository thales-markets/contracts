'use strict';

const fs = require('fs');
const ethers = require('ethers');
const { feesClaimed } = require('./util.js');

const PROXY_FEE_POOL_ADDRESS = '0xb440dd674e1243644791a4adfe3a2abb0a92d309';
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;

let accountsScores = {};
let txCount = 0;
let totalScores = 0;

async function getBlocks() {
    const blocks = [];
    let provider = new ethers.providers.EtherscanProvider("mainnet", ETHERSCAN_KEY);

    const filter = {
        address: PROXY_FEE_POOL_ADDRESS,
        fromBlock: 0,
        topics: [
            ethers.utils.id("FeePeriodClosed(uint256)"),
        ]
    }
    const logs = await provider.getLogs(filter);
    for(let key in logs) {
        blocks.push(logs[key].blockNumber);
    }
    return blocks;
}

async function fetchData() {
    const blocks = await getBlocks();

    for (let i = 0; i < blocks.length; i++) {
        if(!blocks[i+1]) break;

        const result = await feesClaimed(blocks[i],blocks[i+1]); 

        let data = [];
        let weeklyReward = 0;
        for (var element in result) {
            weeklyReward += result[element].rewards;
            data.push({ 'account': result[element].account, 'rewards': result[element].rewards});
        }
        
        Object.keys(data).map(function(key, index) {
            const weeklyPercent = (data[index].rewards * 100) / weeklyReward;
            
            if(accountsScores[data[index].account]) {
                accountsScores[data[index].account] += weeklyPercent;
            } else {
                accountsScores[data[index].account] = weeklyPercent;
            }
            totalScores += weeklyPercent;
        });

        console.log('tx count for week ' + (i + 1) + ' -', result.length );
        console.log('min block', blocks[i], 'max block', blocks[i+1], 'diff', blocks[i+1] - blocks[i]);
        txCount += result.length;
    }
}

 async function main() {
    await fetchData();

    fs.writeFileSync('scripts/snx-data/historical_snx.json', JSON.stringify(accountsScores), function (err) {
        if (err) return console.log(err);
    });
   
    console.log('accounts scores length', Object.keys(accountsScores).length);
    console.log('tx total count', txCount);
    console.log('total scores', totalScores);
};

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});