"use strict";
// required npm install blind-signatures
const blindSignatures = require('blind-signatures');

const { Coin, COIN_RIS_LENGTH, IDENT_STR, BANK_STR } = require('./coin.js');
const utils = require('./utils.js');

// Details about the bank's key.
const BANK_KEY = blindSignatures.keyGeneration({ b: 2048 });
const N = BANK_KEY.keyPair.n.toString();
const E = BANK_KEY.keyPair.e.toString();

/**
 * Function signing the coin on behalf of the bank.
 * 
 * @param blindedCoinHash - the blinded hash of the coin.
 * 
 * @returns the signature of the bank for this coin.
 */
function signCoin(blindedCoinHash) {
  return blindSignatures.sign({
      blinded: blindedCoinHash,
      key: BANK_KEY,
  });
}

/**
 * Parses a string representing a coin, and returns the left/right identity string hashes.
 *
 * @param {string} s - string representation of a coin.
 * 
 * @returns {[[string]]} - two arrays of strings of hashes, commiting the owner's identity.
 */
function parseCoin(s) {
  let [cnst,amt,guid,leftHashes,rightHashes] = s.split('-');
  if (cnst !== BANK_STR) {
    throw new Error(`Invalid identity string: ${cnst} received, but ${BANK_STR} expected`);
  }
  //console.log(`Parsing ${guid}, valued at ${amt} coins.`);
  let lh = leftHashes.split(',');
  let rh = rightHashes.split(',');
  return [lh,rh];
}

/**
 * Procedure for a merchant accepting a token. The merchant randomly selects
 * the left or right halves of the identity string.
 * 
 * @param {Coin} - the coin that a purchaser wants to use.
 * 
 * @returns {[String]} - an array of strings, each holding half of the user's identity.
 */
function acceptCoin(coin) {
  // 1) Verify signature
  let valid = blindSignatures.verify({
    unblinded: coin.signature,
    key: BANK_KEY,
    message: utils.hash(coin.toString())
  });
  

  if (!valid) {
    throw new Error("Invalid signature. Coin rejected.");
  }

  // 2) Parse coin to get RIS
  let [leftHashes, rightHashes] = parseCoin(coin.toString());

  // 3) Randomly select 0 (left) or 1 (right)
  let side = utils.randInt(2);
  let selectedRIS = side === 0 ? coin.left : coin.right;
  let selectedHashes = side === 0 ? leftHashes : rightHashes;

  // 4) Verify hashes
  for (let i = 0; i < selectedRIS.length; i++) {
    if (utils.hash(selectedRIS[i]) !== selectedHashes[i]) {
      throw new Error("RIS hash mismatch. Coin is invalid.");
    }
  }

  return selectedRIS;
}


/**
 * If a token has been double-spent, determine who is the cheater
 * and print the result to the screen.
 * 
 * If the coin purchaser double-spent their coin, their anonymity
 * will be broken, and their idenityt will be revealed.
 * 
 * @param guid - Globablly unique identifier for coin.
 * @param ris1 - Identity string reported by first merchant.
 * @param ris2 - Identity string reported by second merchant.
 */
function determineCheater(guid, ris1, ris2) {
  for (let i = 0; i < ris1.length; i++) {
    if (ris1[i] !== ris2[i]) {
      // Parse the two halves (as JSON strings)
      let r1 = JSON.parse(ris1[i]);
      let r2 = JSON.parse(ris2[i]);

      // Decrypt using OTP
      let result = utils.decryptOTP({
        key: Buffer.from(r1),
        ciphertext: Buffer.from(r2),
        returnType: 'string'
      });

      if (result.startsWith(IDENT_STR)) {
        let identity = result.slice(IDENT_STR.length);
        console.log(`Coin ${guid} was double-spent by: ${identity}`);
      } else {
        console.log(`Coin ${guid} was double-spent by a merchant.`);
      }
      return;
    }
  }
  console.log(`Coin ${guid} was spent only once (or the same RIS was reused).`);
}


let coin = new Coin('alice', 20, N, E);

coin.signature = signCoin(coin.blinded);

coin.unblind();


// Merchant 1 accepts the coin.
let ris1 = acceptCoin(coin);


// Merchant 2 accepts the same coin.
let ris2 = acceptCoin(coin);


// The bank realizes that there is an issue and
// identifies Alice as the cheater.
determineCheater(coin.guid, ris1, ris2);

console.log();
// On the other hand, if the RIS strings are the same,
// the merchant is marked as the cheater.
determineCheater(coin.guid, ris1, ris1);
