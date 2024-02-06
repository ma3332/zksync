import { arrayify, hexZeroPad, splitSignature } from "@ethersproject/bytes";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { digestBytesETH } from "./2b_L2generateHashETH.js";

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
const withdrawL2ETH = keyPair.sign(digestBytesETH, {
  canonical: true,
});

// Concatenate Signature in App
const resWithdrawETHL2 = splitSignature({
  v: withdrawL2ETH.recoveryParam,
  r: hexZeroPad("0x" + withdrawL2ETH.r.toString(16), 32),
  s: hexZeroPad("0x" + withdrawL2ETH.s.toString(16), 32),
});

export { resWithdrawETHL2 };
