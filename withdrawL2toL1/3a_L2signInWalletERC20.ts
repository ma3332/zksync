import { arrayify, hexZeroPad, splitSignature } from "@ethersproject/bytes";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { digestBytesERC20 } from "./2a_L2generateHashERC20.js";

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
const withdrawL2ERC20 = keyPair.sign(digestBytesERC20, {
  canonical: true,
});

// Concatenate Signature in App
const resWithdrawL2 = splitSignature({
  v: withdrawL2ERC20.recoveryParam,
  r: hexZeroPad("0x" + withdrawL2ERC20.r.toString(16), 32),
  s: hexZeroPad("0x" + withdrawL2ERC20.s.toString(16), 32),
});

export { resWithdrawL2 };
