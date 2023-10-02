import { BigNumberish } from "@ethersproject/bignumber";
import { ethers, BigNumber, BytesLike, UnsignedTransaction } from "ethers";
import { arrayify, hexZeroPad, splitSignature } from "@ethersproject/bytes";
import { Provider, utils as utilsZK, types } from "zksync-web3";
import { SignatureLike } from "@ethersproject/bytes";
import { serialize as serializeL1 } from "@ethersproject/transactions";
import { keccak256 } from "@ethersproject/keccak256";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { Logger } from "@ethersproject/logger";
import _ec from "elliptic";
import IZKSyncFactory from "./IZKSyncFactory.json" assert { type: "json" };
import IL1BridgeFactory from "./IL1BridgeFactory.json" assert { type: "json" };
import IL2BridgeFactory from "./IL2BridgeFactory.json" assert { type: "json" };
import IERC20MetadataFactory from "./IERC20MetadataFactory.json" assert { type: "json" };
import EC = _ec.ec;
const version = "properties/5.7.0";
const logger = new Logger(version);

// Some Fix Value for Testing
let zkSyncProvider: Provider;
let providerL1: ethers.providers.Provider;
let chainid: number | undefined = 280; // ChainID of ZKsync Testnet
let chainidGoerli: number | undefined = 5; // ChainID of Goerli Testnet

type Address = string;

function getCurve() {
  let _curve;
  if (!_curve) {
    _curve = new EC("secp256k1");
  }
  return _curve;
}

zkSyncProvider = new Provider("https://testnet.era.zksync.dev");
providerL1 = ethers.getDefaultProvider("goerli");

let withdrawalHash: string;
let TxIndex: number;
let overrides: ethers.Overrides = {} || undefined;

const PRIVATE_KEY_SENDER: string =
  "0x7a12e8a7c1b18a47df7ae73f89931af32483743ab522e2003b6b65727e4a31bd";
const txSender: Address = "0xb98Ef0896C9f1A175B97078f40097ea9fdf18588";
const L2DiamondProxy: Address = "0x1908e2BF4a88F91E4eF0DC72f02b8Ea36BEa2319"; // Interact via Proxy
const L2ERC20Bridge: Address = "0x00ff932A6d70E2B8f1Eb4919e1e09C1923E7e57b";
const L1ERC20Bridge: Address = "0x927DdFcc55164a59E0F33918D13a2D559bC10ce7";

const keyPair = getCurve().keyFromPrivate(arrayify(PRIVATE_KEY_SENDER));

let unsignedWithdrawTxL1: UnsignedTransaction = {
  to: "" || undefined,
  nonce: 0 || undefined,

  gasLimit: 0 || undefined,
  gasPrice: 0 || undefined,

  data: "" || undefined,
  value: 0 || undefined,
  chainId: 0,

  type: 0 || undefined,

  maxPriorityFeePerGas: 0 || undefined,
  maxFeePerGas: 0 || undefined,
};

let unsignedWithdrawTxL2: UnsignedTransaction = {
  to: "" || undefined,
  nonce: 0 || undefined,

  gasLimit: 0 || undefined,
  gasPrice: 0 || undefined,

  data: "" || undefined,
  value: 0 || undefined,
  chainId: 0,

  type: 0 || undefined,

  maxPriorityFeePerGas: 0 || undefined,
  maxFeePerGas: 0 || undefined,
};

async function getL1BridgeContract() {
  return new ethers.Contract(L1ERC20Bridge, IL1BridgeFactory.abi, providerL1);
}

async function getL2BridgeContract() {
  return new ethers.Contract(
    L2ERC20Bridge,
    IL2BridgeFactory.abi,
    zkSyncProvider
  );
}

async function finalizeWithdrawalParams(
  withdrawalHash: BytesLike,
  index: number = 0
) {
  const { log, l1BatchTxId } = await _getWithdrawalLog(withdrawalHash, index);
  const { l2ToL1LogIndex } = await _getWithdrawalL2ToL1Log(
    withdrawalHash,
    index
  );
  const sender = ethers.utils.hexDataSlice(log.topics[1], 12);
  const proof = await zkSyncProvider.getLogProof(
    withdrawalHash,
    l2ToL1LogIndex
  );
  const message = ethers.utils.defaultAbiCoder.decode(["bytes"], log.data)[0];
  return {
    l1BatchNumber: log.l1BatchNumber,
    l2MessageIndex: proof.id,
    l2TxNumberInBlock: l1BatchTxId,
    message,
    sender,
    proof: proof.proof,
  };
}

async function _getWithdrawalLog(withdrawalHash: BytesLike, index: number = 0) {
  const hash = ethers.utils.hexlify(withdrawalHash);
  const receipt = await zkSyncProvider.getTransactionReceipt(hash);
  const log = receipt.logs.filter(
    (log) =>
      log.address == utilsZK.L1_MESSENGER_ADDRESS &&
      log.topics[0] == ethers.utils.id("L1MessageSent(address,bytes32,bytes)")
  )[index];

  return {
    log,
    l1BatchTxId: receipt.l1BatchTxIndex,
  };
}

async function _getWithdrawalL2ToL1Log(
  withdrawalHash: BytesLike,
  index: number = 0
) {
  const hash = ethers.utils.hexlify(withdrawalHash);
  const receipt = await zkSyncProvider.getTransactionReceipt(hash);
  const messages = Array.from(receipt.l2ToL1Logs.entries()).filter(
    ([_, log]) => log.sender == utilsZK.L1_MESSENGER_ADDRESS
  );
  const [l2ToL1LogIndex, l2ToL1Log] = messages[index];

  return {
    l2ToL1LogIndex,
    l2ToL1Log,
  };
}

// Step 1: Initiate withdraw in L2

type WithdrawTXL2 = {
  token: Address;
  amount: BigNumberish;
  to?: Address;
  bridgeAddress?: Address;
  overrides?: ethers.Overrides;
};

const initWithdrawL2: WithdrawTXL2 = {
  token: "",
  amount: 0,
  to: "" || undefined,
  bridgeAddress: "" || undefined,
  overrides: {} || undefined,
};

initWithdrawL2.token = utilsZK.ETH_ADDRESS;
initWithdrawL2.amount = ethers.utils.parseEther("0.03");

const withdrawTx = await zkSyncProvider.getWithdrawTx({
  from: txSender,
  ...initWithdrawL2,
});

const feeData = await zkSyncProvider.getFeeData();

unsignedWithdrawTxL2.to = L2ERC20Bridge;
unsignedWithdrawTxL2.nonce = await providerL1.getTransactionCount(txSender);
unsignedWithdrawTxL2.maxFeePerGas = feeData.maxPriorityFeePerGas;
unsignedWithdrawTxL2.gasPrice = feeData.maxPriorityFeePerGas;
unsignedWithdrawTxL2.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
unsignedWithdrawTxL2.type = 2; // no accessList, maxPriorityFeePerGas, maxFeePerGas
unsignedWithdrawTxL2.data = withdrawTx.data;
unsignedWithdrawTxL2.chainId = chainidGoerli;
unsignedWithdrawTxL2.value = 0; // even through we withdraw ETH, value still equals 0 as we are dealing with WETH in L2
unsignedWithdrawTxL2.gasLimit = await providerL1.estimateGas({
  from: txSender,
  to: unsignedWithdrawTxL2.to,
  data: unsignedWithdrawTxL2.data,
  type: 2,
});

const digest = keccak256(serializeL1(unsignedWithdrawTxL2));

const keyPairL2 = getCurve().keyFromPrivate(arrayify(PRIVATE_KEY_SENDER));
const digestBytes = arrayify(digest);
if (digestBytes.length !== 32) {
  logger.throwArgumentError("bad digest length", "digest", digest);
}
// Sign in Wallet
const signatureWallet = keyPairL2.sign(digestBytes, { canonical: true });

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
const txBytes = utilsZK.serialize(unsignedWithdrawTxL2, signatureBroadcast);
zkSyncProvider.sendTransaction(txBytes);

// Step 2: After 24h hour Finalize withdraw in L1

const {
  l1BatchNumber,
  l2MessageIndex,
  l2TxNumberInBlock,
  message,
  sender,
  proof,
} = await finalizeWithdrawalParams(withdrawalHash, TxIndex);

if (utilsZK.isETH(sender)) {
  const zksync = new ethers.Contract(
    L2DiamondProxy,
    IZKSyncFactory.abi,
    providerL1
  );

  const txETHFinalizeWithdraw =
    await zksync.populateTransaction.finalizeWithdrawal(
      l1BatchNumber,
      l2MessageIndex,
      l2TxNumberInBlock,
      message,
      proof,
      overrides ?? {}
    );

  const feeData = await providerL1.getFeeData();

  unsignedWithdrawTxL1.to = L1ERC20Bridge;
  unsignedWithdrawTxL1.nonce = await providerL1.getTransactionCount(txSender);
  unsignedWithdrawTxL1.maxFeePerGas = feeData.maxPriorityFeePerGas;
  unsignedWithdrawTxL1.gasPrice = feeData.maxPriorityFeePerGas;
  unsignedWithdrawTxL1.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
  unsignedWithdrawTxL1.type = 2; // no accessList, no maxPriorityFeePerGas, no maxFeePerGas
  unsignedWithdrawTxL1.data = txETHFinalizeWithdraw.data;
  unsignedWithdrawTxL1.chainId = chainidGoerli;
  unsignedWithdrawTxL1.value = 0;
  unsignedWithdrawTxL1.gasLimit = await providerL1.estimateGas({
    from: txSender,
    to: unsignedWithdrawTxL1.to,
    data: unsignedWithdrawTxL1.data,
    type: 2,
  });

  const digestWithdrawERC20L1 = keccak256(serializeL1(unsignedWithdrawTxL1));

  const digestWithdrawERC20BytesL1 = arrayify(digestWithdrawERC20L1);
  if (digestWithdrawERC20BytesL1.length !== 32) {
    logger.throwArgumentError(
      "bad digest length",
      "digest",
      digestWithdrawERC20L1
    );
  }

  // Sign in Wallet for Withdraw L1 Transaction
  const signatureWithdrawL1 = keyPair.sign(digestWithdrawERC20BytesL1, {
    canonical: true,
  });

  // Concatenate Withdraw L1 Signature in App
  const sigWithdrawL1Split = splitSignature({
    v: signatureWithdrawL1.recoveryParam,
    r: hexZeroPad("0x" + signatureWithdrawL1.r.toString(16), 32),
    s: hexZeroPad("0x" + signatureWithdrawL1.s.toString(16), 32),
  });

  const signatureWithdrawL1Broadcast: SignatureLike = {
    r: sigWithdrawL1Split.r,
    s: sigWithdrawL1Split.s,
    _vs: sigWithdrawL1Split._vs,
    recoveryParam: sigWithdrawL1Split.recoveryParam,
    v: sigWithdrawL1Split.v,
  };

  // Broadcast to Blockchain
  const txWithdrawL1Bytes = utilsZK.serialize(
    unsignedWithdrawTxL1,
    signatureWithdrawL1Broadcast
  );

  await providerL1.sendTransaction(txWithdrawL1Bytes);
} else {
  const l2Bridge = new ethers.Contract(
    L2ERC20Bridge,
    IL2BridgeFactory.abi,
    zkSyncProvider
  );

  const l1Bridge = new ethers.Contract(
    l2Bridge.l1Bridge(),
    IL1BridgeFactory.abi,
    providerL1
  );

  const txERC20FinalizeWithdraw =
    await l1Bridge.populateTransaction.finalizeWithdrawal(
      l1BatchNumber,
      l2MessageIndex,
      l2TxNumberInBlock,
      message,
      proof,
      overrides ?? {}
    );

  const feeData = await providerL1.getFeeData();

  unsignedWithdrawTxL1.to = L1ERC20Bridge;

  unsignedWithdrawTxL1.nonce = await providerL1.getTransactionCount(txSender);
  unsignedWithdrawTxL1.maxFeePerGas = feeData.maxPriorityFeePerGas;
  unsignedWithdrawTxL1.gasPrice = feeData.maxPriorityFeePerGas;
  unsignedWithdrawTxL1.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
  unsignedWithdrawTxL1.type = 2; // no accessList, no maxPriorityFeePerGas, no maxFeePerGas
  unsignedWithdrawTxL1.data = txERC20FinalizeWithdraw.data;
  unsignedWithdrawTxL1.chainId = chainidGoerli;
  unsignedWithdrawTxL1.value = 0;
  unsignedWithdrawTxL1.gasLimit = await providerL1.estimateGas({
    from: txSender,
    to: unsignedWithdrawTxL1.to,
    data: txERC20FinalizeWithdraw.data,
    type: 2,
  });

  const digestWithdrawERC20L1 = keccak256(serializeL1(unsignedWithdrawTxL1));

  const digestWithdrawERC20BytesL1 = arrayify(digestWithdrawERC20L1);
  if (digestWithdrawERC20BytesL1.length !== 32) {
    logger.throwArgumentError(
      "bad digest length",
      "digest",
      digestWithdrawERC20L1
    );
  }

  // Sign in Wallet for Withdraw L1 Transaction
  const signatureWithdrawL1 = keyPair.sign(digestWithdrawERC20BytesL1, {
    canonical: true,
  });

  // Concatenate Withdraw L1 Signature in App
  const sigWithdrawL1Split = splitSignature({
    v: signatureWithdrawL1.recoveryParam,
    r: hexZeroPad("0x" + signatureWithdrawL1.r.toString(16), 32),
    s: hexZeroPad("0x" + signatureWithdrawL1.s.toString(16), 32),
  });

  const signatureWithdrawL1Broadcast: SignatureLike = {
    r: sigWithdrawL1Split.r,
    s: sigWithdrawL1Split.s,
    _vs: sigWithdrawL1Split._vs,
    recoveryParam: sigWithdrawL1Split.recoveryParam,
    v: sigWithdrawL1Split.v,
  };

  // Broadcast to Blockchain
  const txWithdrawL1Bytes = utilsZK.serialize(
    unsignedWithdrawTxL1,
    signatureWithdrawL1Broadcast
  );

  await providerL1.sendTransaction(txWithdrawL1Bytes);
}
