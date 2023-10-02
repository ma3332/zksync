import { ethers, UnsignedTransaction } from "ethers";
import { arrayify, hexZeroPad, splitSignature } from "@ethersproject/bytes";
import { Provider, utils as utilsZK, types } from "zksync-web3";
import { SignatureLike } from "@ethersproject/bytes";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { Logger } from "@ethersproject/logger";
import { serialize as serializeL1 } from "@ethersproject/transactions";
import { keccak256 } from "@ethersproject/keccak256";

import _ec from "elliptic";
import EC = _ec.ec;

const version = "properties/5.7.0";
const logger = new Logger(version);
type Address = string;

let zkSyncProvider: Provider;
zkSyncProvider = new Provider("https://testnet.era.zksync.dev");
let chainid: number | undefined = 280; // ChainID of ZKsync Testnet

const PRIVATE_KEY_SEND: string =
  "0x7a12e8a7c1b18a47df7ae73f89931af32483743ab522e2003b6b65727e4a31bd";
const addressSend: Address = "0xb98Ef0896C9f1A175B97078f40097ea9fdf18588";

const addressReceive: Address = "0x2a3a900590e1AE9BCd6549Fd9F73A8fed50A207c";

function getCurve() {
  let _curve;
  if (!_curve) {
    _curve = new EC("secp256k1");
  }
  return _curve;
}

let unsignedTx: UnsignedTransaction = {
  to: "" || undefined,
  nonce: 0 || undefined,

  gasLimit: 0 || undefined,
  gasPrice: 0 || undefined,

  data: "" || undefined,
  value: 0 || undefined,
  chainId: 0,

  type: 0 || undefined,

  // maxPriorityFeePerGas: 0 || undefined,
  // maxFeePerGas: 0 || undefined,
};

// type = 1: accesslist
// type = 2: EIP1559 (maxPriorityFeePerGas, maxFeePerGas)
unsignedTx.to = addressReceive;
unsignedTx.nonce = await zkSyncProvider.getTransactionCount(addressSend);
unsignedTx.gasPrice = await zkSyncProvider.getGasPrice();
unsignedTx.type = 0; // no accessList, no maxPriorityFeePerGas, no maxFeePerGas
unsignedTx.data = "0x";
unsignedTx.chainId = chainid;
unsignedTx.value = ethers.utils.parseEther("0.002");
unsignedTx.gasLimit = await zkSyncProvider.estimateGas({
  from: addressSend,
  to: addressReceive,
  data: "0x",
  type: 0,
});

const digest = keccak256(serializeL1(unsignedTx));

const keyPair = getCurve().keyFromPrivate(arrayify(PRIVATE_KEY_SEND));
const digestBytes = arrayify(digest);
if (digestBytes.length !== 32) {
  logger.throwArgumentError("bad digest length", "digest", digest);
}
// Sign in Wallet
const signatureWallet = keyPair.sign(digestBytes, { canonical: true });

// Concatenate Signature in App
const res = splitSignature({
  v: signatureWallet.recoveryParam,
  r: hexZeroPad("0x" + signatureWallet.r.toString(16), 32),
  s: hexZeroPad("0x" + signatureWallet.s.toString(16), 32),
});

const signatureBroadcast: SignatureLike = {
  r: res.r,
  s: res.s,
  _vs: res._vs,
  recoveryParam: res.recoveryParam,
  v: res.v,
};

// Broadcast to Blockchain
const txBytes = utilsZK.serialize(unsignedTx, signatureBroadcast);
zkSyncProvider.sendTransaction(txBytes);
