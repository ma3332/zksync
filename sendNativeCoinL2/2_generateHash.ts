import { ethers, UnsignedTransaction } from "ethers";
import { arrayify, hexZeroPad, splitSignature } from "@ethersproject/bytes";
import { Provider, utils as utilsZK, types } from "zksync-web3";
import { SignatureLike } from "@ethersproject/bytes";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { Logger } from "@ethersproject/logger";
import { serialize as serializeL1 } from "@ethersproject/transactions";
import { keccak256 } from "@ethersproject/keccak256";
import {
  sender,
  recipientAddress,
  sendingAmount,
} from "./1_inputFromClient.js";
import { unsignedTx, zkSyncProvider, chainid } from "./utils.js";

// type = 1: accesslist
// type = 2: EIP1559 (maxPriorityFeePerGas, maxFeePerGas)
unsignedTx.to = recipientAddress;
unsignedTx.nonce = await zkSyncProvider.getTransactionCount(sender);
unsignedTx.gasPrice = await zkSyncProvider.getGasPrice();
unsignedTx.type = 0; // no accessList, no maxPriorityFeePerGas, no maxFeePerGas
unsignedTx.data = "0x";
unsignedTx.chainId = chainid;
unsignedTx.value = ethers.utils.parseEther(sendingAmount);
unsignedTx.gasLimit = await zkSyncProvider.estimateGas({
  from: sender,
  to: recipientAddress,
  data: "0x",
  type: 0,
});

const digest = keccak256(serializeL1(unsignedTx));

const digestBytes = arrayify(digest);
if (digestBytes.length !== 32) {
  throw new Error("");
}

export { digestBytes, unsignedTx };
