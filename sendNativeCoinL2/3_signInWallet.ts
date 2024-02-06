import { arrayify, hexZeroPad, splitSignature } from "@ethersproject/bytes";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { digestBytes } from "./2_generateHash.js";

import _ec from "elliptic";
import EC = _ec.ec;

let privKeySender = process.env.PRIVATE_KEY_SENDER;

function getCurve() {
  let _curve;
  if (!_curve) {
    _curve = new EC("secp256k1");
  }
  return _curve;
}

const keyPair = getCurve().keyFromPrivate(arrayify(privKeySender));

// Sign in Wallet
const signatureWallet = keyPair.sign(digestBytes, { canonical: true });

// Concatenate Signature in App
const res = splitSignature({
  v: signatureWallet.recoveryParam,
  r: hexZeroPad("0x" + signatureWallet.r.toString(16), 32),
  s: hexZeroPad("0x" + signatureWallet.s.toString(16), 32),
});

export { res };
