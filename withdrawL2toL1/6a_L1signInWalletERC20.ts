import { arrayify, hexZeroPad, splitSignature } from "@ethersproject/bytes";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { digestWithdrawERC20BytesL1 } from "./5a_L1generateHashERC20.js";

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
const withdrawL1ERC20 = keyPair.sign(digestWithdrawERC20BytesL1, {
  canonical: true,
});

// Concatenate Signature in App
const resWithdrawL1 = splitSignature({
  v: withdrawL1ERC20.recoveryParam,
  r: hexZeroPad("0x" + withdrawL1ERC20.r.toString(16), 32),
  s: hexZeroPad("0x" + withdrawL1ERC20.s.toString(16), 32),
});

export { resWithdrawL1 };
