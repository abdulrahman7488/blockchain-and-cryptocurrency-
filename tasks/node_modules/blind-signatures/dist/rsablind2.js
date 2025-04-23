"use strict";

var secureRandom = require('secure-random');

var BigInteger = require('jsbn').BigInteger;

var sha256 = require('js-sha256');

var NodeRSA = require('node-rsa');

function keyGeneration(params) {
  var key = new NodeRSA(params || {
    b: 2048
  });
  return key;
}

function keyProperties(key) {
  var bigE = new BigInteger(key.keyPair.e.toString());
  var bigN = key.keyPair.n;
  var bigD = key.keyPair.d;
  var bigP = key.keyPair.p;
  var bigQ = key.keyPair.q;
  return {
    bigE: bigE,
    bigN: bigN,
    bigD: bigD,
    bigP: bigP,
    bigQ: bigQ
  };
}

function messageToHash(message) {
  var messageHash = sha256(message);
  return messageHash;
}

function messageToHashInt(message) {
  var messageHash = messageToHash(message);
  var messageBig = new BigInteger(messageHash, 16);
  return messageBig;
}

function blind(_ref) {
  var message = _ref.message,
      key = _ref.key,
      N = _ref.N,
      E = _ref.E;
  var messageHash = messageToHashInt(message);
  var bigN = key ? key.keyPair.n : new BigInteger(N.toString());
  var bigE = key ? new BigInteger(key.keyPair.e.toString()) : new BigInteger(E.toString());
  var bigOne = new BigInteger('1');
  var gcd;
  var r;

  do {
    r = new BigInteger(secureRandom(64));
    gcd = r.gcd(bigN); // console.log('Try');
  } while (!gcd.equals(bigOne) || r.compareTo(bigN) >= 0 || r.compareTo(bigOne) <= 0); // now that we got an r that satisfies the restrictions described we can proceed with calculation of mu


  var mu = r.modPow(bigE, bigN).multiply(messageHash).mod(bigN); // Alice computes mu = H(msg) * r^e mod N

  return {
    blinded: mu,
    r: r
  };
}

function sign(_ref2) {
  var blinded = _ref2.blinded,
      key = _ref2.key;

  var _keyProperties = keyProperties(key),
      bigN = _keyProperties.bigN,
      bigP = _keyProperties.bigP,
      bigQ = _keyProperties.bigQ,
      bigD = _keyProperties.bigD;

  var mu = new BigInteger(blinded.toString()); // We split the mu^d modN in two , one mode p , one mode q

  var PinverseModQ = bigP.modInverse(bigQ); // calculate p inverse modulo q

  var QinverseModP = bigQ.modInverse(bigP); // calculate q inverse modulo p
  // We split the message mu in to messages m1, m2 one mod p, one mod q

  var m1 = mu.modPow(bigD, bigN).mod(bigP); // calculate m1=(mu^d modN)modP

  var m2 = mu.modPow(bigD, bigN).mod(bigQ); // calculate m2=(mu^d modN)modQ
  // We combine the calculated m1 and m2 in order to calculate muprime
  // We calculate muprime: (m1*Q*QinverseModP + m2*P*PinverseModQ) mod N where N =P*Q

  var muprime = m1.multiply(bigQ).multiply(QinverseModP).add(m2.multiply(bigP).multiply(PinverseModQ)).mod(bigN);
  return muprime;
}

function unblind(_ref3) {
  var signed = _ref3.signed,
      key = _ref3.key,
      r = _ref3.r,
      N = _ref3.N;
  var bigN = key ? key.keyPair.n : new BigInteger(N.toString());
  var muprime = new BigInteger(signed.toString());
  var s = r.modInverse(bigN).multiply(muprime).mod(bigN); // Alice computes sig = mu'*r^-1 mod N, inverse of r mod N multiplied with muprime mod N, to remove the blinding factor

  return s;
}

function verify(_ref4) {
  var unblinded = _ref4.unblinded,
      key = _ref4.key,
      message = _ref4.message,
      E = _ref4.E,
      N = _ref4.N;
  var signature = new BigInteger(unblinded.toString());
  var messageHash = messageToHashInt(message);
  var bigN = key ? key.keyPair.n : new BigInteger(N.toString());
  var bigE = key ? new BigInteger(key.keyPair.e.toString()) : new BigInteger(E.toString());
  var signedMessageBigInt = signature.modPow(bigE, bigN); // calculate sig^e modN, if we get back the initial message that means that the signature is valid, this works because (m^d)^e modN = m

  var result = messageHash.equals(signedMessageBigInt);
  return result;
}

function verify2(_ref5) {
  var unblinded = _ref5.unblinded,
      key = _ref5.key,
      message = _ref5.message;
  var signature = new BigInteger(unblinded.toString());
  var messageHash = messageToHashInt(message);

  var _keyProperties2 = keyProperties(key),
      bigD = _keyProperties2.bigD,
      bigN = _keyProperties2.bigN;

  var msgSig = messageHash.modPow(bigD, bigN); // calculate H(msg)^d modN, if we get back the signature that means the message was signed

  var result = signature.equals(msgSig);
  return result;
}

function verifyBlinding(_ref6) {
  var blinded = _ref6.blinded,
      r = _ref6.r,
      unblinded = _ref6.unblinded,
      key = _ref6.key,
      E = _ref6.E,
      N = _ref6.N;
  var messageHash = messageToHashInt(unblinded);
  r = new BigInteger(r.toString());
  N = key ? key.keyPair.n : new BigInteger(N.toString());
  E = key ? new BigInteger(key.keyPair.e.toString()) : new BigInteger(E.toString());
  var blindedHere = messageHash.multiply(r.modPow(E, N)).mod(N);
  var result = blindedHere.equals(blinded);
  return result;
}

module.exports = {
  keyGeneration: keyGeneration,
  messageToHash: messageToHash,
  blind: blind,
  sign: sign,
  unblind: unblind,
  verify: verify,
  verify2: verify2,
  verifyBlinding: verifyBlinding
};