import { ethers, UnsignedTransaction } from "ethers";
import { arrayify, hexZeroPad, splitSignature } from "@ethersproject/bytes";
import { Provider, utils as utilsZK, types } from "zksync-web3";
import { SignatureLike } from "@ethersproject/bytes";
import { serialize as serializeL1 } from "@ethersproject/transactions";
import { keccak256 } from "@ethersproject/keccak256";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { Logger } from "@ethersproject/logger";
import artifact from "./MyERC20.json" assert { type: "json" };
import _ec from "elliptic";
import EC = _ec.ec;
const version = "properties/5.7.0";
const logger = new Logger(version);

// Some Fix Value for Testing
let zkSyncProvider: Provider;
let chainid: number | undefined = 280; // ChainID of ZKsync Testnet

type Address = string;

function getCurve() {
  let _curve;
  if (!_curve) {
    _curve = new EC("secp256k1");
  }
  return _curve;
}

zkSyncProvider = new Provider("https://testnet.era.zksync.dev");

const PRIVATE_KEY: string =
  "0x7a12e8a7c1b18a47df7ae73f89931af32483743ab522e2003b6b65727e4a31bd";
const address: Address = "0xb98Ef0896C9f1A175B97078f40097ea9fdf18588";

const TOKEN_ADDRESS = "0x693F76A09521902Ce89D05EDBFC8143FB87Fe6f9";

const erc20Contract = new ethers.Contract(
  TOKEN_ADDRESS,
  artifact.abi,
  zkSyncProvider
);

// Example of a Smart Contract Function
const tx = await erc20Contract.populateTransaction.mint(
  address,
  ethers.utils.parseEther("5")
);

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
unsignedTx.to = TOKEN_ADDRESS;
unsignedTx.nonce = await zkSyncProvider.getTransactionCount(address);
unsignedTx.gasPrice = await zkSyncProvider.getGasPrice();
unsignedTx.type = 0; // no accessList, no maxPriorityFeePerGas, no maxFeePerGas
unsignedTx.data = "0x";
unsignedTx.chainId = chainid;
unsignedTx.value = 0;
unsignedTx.gasLimit = await zkSyncProvider.estimateGas({
  from: address,
  to: TOKEN_ADDRESS,
  data: tx.data,
  type: 0,
});
unsignedTx.data = tx.data;

const digest = keccak256(serializeL1(unsignedTx));

const keyPair = getCurve().keyFromPrivate(arrayify(PRIVATE_KEY));
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
