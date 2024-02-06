import {
  l1Bridge,
  l2Bridge,
  finalizeWithdrawalParams,
  zkSyncProvider,
  unsignedWithdrawTxL1,
  providerL1,
  L1ERC20Bridge,
  chainidGoerli,
  zksync,
} from "./utils.js";
import { resTxWithdrawL2 } from "./4a_L2getFromWalletAndBroadcastERC20.js";
import { sender } from "./1_inputFromClient.js";
import { ethers } from "ethers";
import { serialize as serializeL1 } from "@ethersproject/transactions";
import { keccak256 } from "@ethersproject/keccak256";
import { utils as utilsZK } from "zksync-web3";
import { arrayify, hexZeroPad, splitSignature } from "@ethersproject/bytes";
import { Logger } from "@ethersproject/logger";

const version = "properties/5.7.0";
const logger = new Logger(version);

let overrides: ethers.Overrides = {} || undefined;
let digestWithdrawETHBytesL1: Uint8Array;

const {
  l1BatchNumber,
  l2MessageIndex,
  l2TxNumberInBlock,
  message,
  senderFromL2,
  proof,
} = await finalizeWithdrawalParams(resTxWithdrawL2.hash, 0, zkSyncProvider);

if (utilsZK.isETH(senderFromL2) == false) {
  throw Error("This is not for ETH Withdraw from L2 to L1");
} else {
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
  unsignedWithdrawTxL1.nonce = await providerL1.getTransactionCount(sender);
  unsignedWithdrawTxL1.maxFeePerGas = feeData.maxPriorityFeePerGas;
  unsignedWithdrawTxL1.gasPrice = feeData.maxPriorityFeePerGas;
  unsignedWithdrawTxL1.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
  unsignedWithdrawTxL1.type = 2; // no accessList, no maxPriorityFeePerGas, no maxFeePerGas
  unsignedWithdrawTxL1.data = txETHFinalizeWithdraw.data;
  unsignedWithdrawTxL1.chainId = chainidGoerli;
  unsignedWithdrawTxL1.value = 0;
  unsignedWithdrawTxL1.gasLimit = await providerL1.estimateGas({
    from: sender,
    to: unsignedWithdrawTxL1.to,
    data: unsignedWithdrawTxL1.data,
    type: 2,
  });

  const digestWithdrawERC20L1 = keccak256(serializeL1(unsignedWithdrawTxL1));

  digestWithdrawETHBytesL1 = arrayify(digestWithdrawERC20L1);
  if (digestWithdrawETHBytesL1.length !== 32) {
    logger.throwArgumentError(
      "bad digest length",
      "digest",
      digestWithdrawERC20L1
    );
  }
}

export { digestWithdrawETHBytesL1, unsignedWithdrawTxL1 };
