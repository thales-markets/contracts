const { gray, green, yellow, bgCyan, black } = require('chalk');
const Big = require('big.js');
const fs = require('fs');
const deployments = require('./deployments.json');
const abi = require('ethereumjs-abi');

const numberExponentToLarge = numIn => {
	numIn += ''; // To cater to numric entries
	var sign = ''; // To remember the number sign
	numIn.charAt(0) == '-' && ((numIn = numIn.substring(1)), (sign = '-')); // remove - sign & remember it
	var str = numIn.split(/[eE]/g); // Split numberic string at e or E
	if (str.length < 2) return sign + numIn; // Not an Exponent Number? Exit with orginal Num back
	var power = str[1]; // Get Exponent (Power) (could be + or -)

	var deciSp = (1.1).toLocaleString().substring(1, 2); // Get Deciaml Separator
	str = str[0].split(deciSp); // Split the Base Number into LH and RH at the decimal point
	var baseRH = str[1] || '', // RH Base part. Make sure we have a RH fraction else ""
		baseLH = str[0]; // LH base part.

	if (power >= 0) {
		// ------- Positive Exponents (Process the RH Base Part)
		if (power > baseRH.length) baseRH += '0'.repeat(power - baseRH.length); // Pad with "0" at RH
		baseRH = baseRH.slice(0, power) + deciSp + baseRH.slice(power); // Insert decSep at the correct place into RH base
		if (baseRH.charAt(baseRH.length - 1) == deciSp) baseRH = baseRH.slice(0, -1); // If decSep at RH end? => remove it
	} else {
		// ------- Negative exponents (Process the LH Base Part)
		num = Math.abs(power) - baseLH.length; // Delta necessary 0's
		if (num > 0) baseLH = '0'.repeat(num) + baseLH; // Pad with "0" at LH
		baseLH = baseLH.slice(0, power) + deciSp + baseLH.slice(power); // Insert "." at the correct place into LH base
		if (baseLH.charAt(0) == deciSp) baseLH = '0' + baseLH; // If decSep at LH most? => add "0"
	}
	// Rremove leading and trailing 0's and Return the long number (with sign)
	return sign + (baseLH + baseRH).replace(/^0*(\d+|\d+\.\d+?)\.?0*$/, '$1');
};

const txLog = (tx, description) => {
	console.log(
		yellow('************************************************************************************')
	);
	console.log(black(bgCyan(description)));
	console.log(gray('Transaction hash: '), green(tx.hash));
	console.log(gray('Block hash: '), green(tx.blockHash));
	console.log(gray('Confirmations: '), green(tx.confirmations));
	console.log(gray('Gas limit: '), green(Big(tx.gasLimit).toString()));
};

const getTargetAddress = (contractName, network) => {
	return deployments[network][contractName];
};

const setTargetAddress = (contractName, network, address) => {
	deployments[network][contractName] = address;
	fs.writeFileSync('scripts/deployments.json', JSON.stringify(deployments), function(err) {
		if (err) return console.log(err);
	});
};


function encodeCall(name, arguments, values) {
  const methodId = abi.methodID(name, arguments).toString('hex');
  const params = abi.rawEncode(arguments, values).toString('hex');
  return '0x' + methodId + params;
}

module.exports = {
	numberExponentToLarge,
	txLog,
	getTargetAddress,
	setTargetAddress,
	encodeCall
};
