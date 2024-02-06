import { arrayify, hexZeroPad, splitSignature } from "@ethersproject/bytes";
import { _TypedDataEncoder } from "@ethersproject/hash";
import {
  digestApprovalBytes,
  digestDepositERC20Bytes,
} from "./2a_generateHashERC20.js";

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
const signatureApprovalWallet = keyPair.sign(digestApprovalBytes, {
  canonical: true,
});

// Concatenate Signature in App
const resApprove = splitSignature({
  v: signatureApprovalWallet.recoveryParam,
  r: hexZeroPad("0x" + signatureApprovalWallet.r.toString(16), 32),
  s: hexZeroPad("0x" + signatureApprovalWallet.s.toString(16), 32),
});

const signatureDepositWallet = keyPair.sign(digestDepositERC20Bytes, {
  canonical: true,
});

// Concatenate Signature in App
const resDeposit = splitSignature({
  v: signatureDepositWallet.recoveryParam,
  r: hexZeroPad("0x" + signatureDepositWallet.r.toString(16), 32),
  s: hexZeroPad("0x" + signatureDepositWallet.s.toString(16), 32),
});

export { resApprove, resDeposit };
