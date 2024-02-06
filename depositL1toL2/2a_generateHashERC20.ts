import { BigNumberish } from "@ethersproject/bignumber";
import { ethers, BigNumber, BytesLike, UnsignedTransaction } from "ethers";
import { arrayify, hexZeroPad, splitSignature } from "@ethersproject/bytes";
import { utils as utilsZK } from "zksync-web3";
import { serialize as serializeL1 } from "@ethersproject/transactions";
import { keccak256 } from "@ethersproject/keccak256";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { Logger } from "@ethersproject/logger";
import {
  TXL1toL2,
  chainidGoerli,
  Address,
  L1BridgeAddress,
  L2DiamondProxy,
  zkSyncProvider,
  providerL1,
  getERC20Contract,
  bridgeContracts,
  getDepositTx,
  unsignedTXL1toL2,
  unsignedTxL1,
  unsignedApproveTxL1,
} from "./utils.js";
import {
  sender,
  ERC20token,
  sendingAmtERC20,
  recipient,
} from "./1_inputFromClient.js";
const version = "properties/5.7.0";
const logger = new Logger(version);

unsignedTXL1toL2.to = recipient; // recipient có thể chính là sender
unsignedTXL1toL2.token = ERC20token;
unsignedTXL1toL2.amount = sendingAmtERC20;
unsignedTXL1toL2.approveERC20 = true;

let overrides = {
  bridgeAddress:
    unsignedTXL1toL2.bridgeAddress ?? bridgeContracts.erc20.address,
  ...unsignedTXL1toL2.approveOverrides,
};

let bridgeAddress = overrides.bridgeAddress;
const erc20contract = await getERC20Contract(unsignedTXL1toL2.token);

if (bridgeAddress == null) {
  bridgeAddress = (await zkSyncProvider.getDefaultBridgeAddresses()).erc20L1;
} else {
  delete overrides.bridgeAddress;
}

// Perform Approve() of ERC20
const txApproveERC20 = await erc20contract.populateTransaction.approve(
  bridgeAddress,
  unsignedTXL1toL2.amount,
  overrides
);

const feeData = await providerL1.getFeeData();
unsignedApproveTxL1.to = ERC20token;
unsignedApproveTxL1.nonce = await providerL1.getTransactionCount(sender);
unsignedApproveTxL1.maxFeePerGas = feeData.maxPriorityFeePerGas;
unsignedApproveTxL1.gasPrice = feeData.maxPriorityFeePerGas;
unsignedApproveTxL1.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
unsignedApproveTxL1.type = 2; // no accessList, no maxPriorityFeePerGas, no maxFeePerGas
unsignedApproveTxL1.data = txApproveERC20.data;
unsignedApproveTxL1.chainId = chainidGoerli;
unsignedApproveTxL1.value = 0;
unsignedApproveTxL1.gasLimit = await providerL1.estimateGas({
  from: sender,
  to: ERC20token,
  data: txApproveERC20.data,
  type: 2,
});

const digestApproval = keccak256(serializeL1(unsignedApproveTxL1));

const digestApprovalBytes = arrayify(digestApproval);
if (digestApprovalBytes.length !== 32) {
  logger.throwArgumentError("bad digest length", "digest", digestApproval);
}

// depositTx =
// {
//   data: '0xeb672419000000000000000000000000b98ef0896c9f1a175b97078f40097ea9fdf1858800000000000000000000000000000000000000000000000000b1a2bc2ec5000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000011366000000000000000000000000000000000000000000000000000000000000003200000000000000000000000000000000000000000000000000000000000000100000000000000000000000000b98ef0896c9f1a175b97078f40097ea9fdf1858800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
//   to: '0x1908e2BF4a88F91E4eF0DC72f02b8Ea36BEa2319',
//   maxFeePerGas: BigNumber { _hex: '0x59682f0f', _isBigNumber: true },
//   maxPriorityFeePerGas: BigNumber { _hex: '0x59682f00', _isBigNumber: true },
//   accessList: [],
//   value: BigNumber { _hex: '0xb3a3b46418e000', _isBigNumber: true },
//   customData: {},
//   ccipReadEnabled: true
// }
// */

// Perform actual deposit function
const TxDeposit = await getDepositTx(unsignedTXL1toL2);

unsignedTxL1.to = TxDeposit.to;
unsignedTxL1.nonce = await providerL1.getTransactionCount(sender);
unsignedTxL1.gasPrice = TxDeposit.maxFeePerGas;
unsignedTxL1.maxFeePerGas = TxDeposit.maxFeePerGas;
unsignedTxL1.maxPriorityFeePerGas = TxDeposit.maxPriorityFeePerGas;
unsignedTxL1.type = 2; // no accessList, no maxPriorityFeePerGas, no maxFeePerGas
unsignedTxL1.data = TxDeposit.data;
unsignedTxL1.chainId = chainidGoerli;
unsignedTxL1.value = TxDeposit.value;
unsignedTxL1.gasLimit = await zkSyncProvider.estimateGas({
  from: sender,
  to: TxDeposit.to,
  data: TxDeposit.data,
  type: 2,
});

const digestDepositERC20 = keccak256(serializeL1(unsignedTxL1));

const digestDepositERC20Bytes = arrayify(digestDepositERC20);
if (digestDepositERC20Bytes.length !== 32) {
  logger.throwArgumentError("bad digest length", "digest", digestDepositERC20);
}

export {
  digestApprovalBytes,
  digestDepositERC20Bytes,
  unsignedApproveTxL1,
  unsignedTxL1,
};
