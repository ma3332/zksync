import { arrayify, hexZeroPad, splitSignature } from "@ethersproject/bytes";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { digestWithdrawETHBytesL1 } from "./5b_L1generateHashETH.js";

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
const withdrawL1ETH = keyPair.sign(digestWithdrawETHBytesL1, {
  canonical: true,
});

// Concatenate Signature in App
const resWithdrawL1 = splitSignature({
  v: withdrawL1ETH.recoveryParam,
  r: hexZeroPad("0x" + withdrawL1ETH.r.toString(16), 32),
  s: hexZeroPad("0x" + withdrawL1ETH.s.toString(16), 32),
});

export { resWithdrawL1 };
