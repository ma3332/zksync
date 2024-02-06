import { BigNumberish } from "@ethersproject/bignumber";
import { ethers, BigNumber, BytesLike, UnsignedTransaction } from "ethers";
import { arrayify, hexZeroPad, splitSignature } from "@ethersproject/bytes";
import { utils as utilsZK } from "zksync-web3";
import { serialize as serializeL1 } from "@ethersproject/transactions";
import { keccak256 } from "@ethersproject/keccak256";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { Logger } from "@ethersproject/logger";

const version = "properties/5.7.0";
const logger = new Logger(version);

import {
  sender,
  nativeCoin,
  withdrawAmtETH,
  recipient,
} from "./1_inputFromClient.js";

import {
  initWithdrawL2,
  zkSyncProvider,
  unsignedWithdrawTxL2,
  L2ERC20Bridge,
  chainidGoerli,
  providerL1,
} from "./utils.js";

initWithdrawL2.token = nativeCoin;
initWithdrawL2.amount = ethers.utils.parseEther(withdrawAmtETH);
initWithdrawL2.to = recipient; // This could be to other address or the same address with sender

const withdrawTx = await zkSyncProvider.getWithdrawTx({
  from: sender,
  ...initWithdrawL2,
});
const feeData = await zkSyncProvider.getFeeData();

unsignedWithdrawTxL2.to = L2ERC20Bridge;
unsignedWithdrawTxL2.nonce = await providerL1.getTransactionCount(sender);
unsignedWithdrawTxL2.maxFeePerGas = feeData.maxPriorityFeePerGas;
unsignedWithdrawTxL2.gasPrice = feeData.maxPriorityFeePerGas;
unsignedWithdrawTxL2.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
unsignedWithdrawTxL2.type = 2; // no accessList, maxPriorityFeePerGas, maxFeePerGas
unsignedWithdrawTxL2.data = withdrawTx.data;
unsignedWithdrawTxL2.chainId = chainidGoerli;
unsignedWithdrawTxL2.value = 0; // even through we withdraw ETH, value still equals 0 as we are dealing with WETH in L2
unsignedWithdrawTxL2.gasLimit = await providerL1.estimateGas({
  from: sender,
  to: unsignedWithdrawTxL2.to,
  data: unsignedWithdrawTxL2.data,
  type: 2,
});

const digest = keccak256(serializeL1(unsignedWithdrawTxL2));
const digestBytesETH = arrayify(digest);
if (digestBytesETH.length !== 32) {
  logger.throwArgumentError("bad digest length", "digest", digest);
}

export { digestBytesETH, unsignedWithdrawTxL2 };
