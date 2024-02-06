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
  insertGasPrice,
  getBaseCost,
  getMainContract,
} from "./utils.js";
import {
  sender,
  ERC20token,
  sendingAmtERC20,
  recipient,
} from "./1_inputFromClient.js";
const version = "properties/5.7.0";
const logger = new Logger(version);

async function getRequestExecuteTx(transaction: {
  contractAddress: Address;
  calldata: BytesLike;
  l2GasLimit?: BigNumberish;
  l2Value?: BigNumberish;
  factoryDeps?: ethers.BytesLike[];
  operatorTip?: BigNumberish;
  gasPerPubdataByte?: BigNumberish;
  refundRecipient?: Address;
  overrides?: ethers.PayableOverrides;
}): Promise<ethers.PopulatedTransaction> {
  const zksyncContract = await getMainContract();

  const { ...tx } = transaction;
  tx.l2Value ??= BigNumber.from(0);
  tx.operatorTip ??= BigNumber.from(0);
  tx.factoryDeps ??= [];
  tx.overrides ??= {};
  tx.gasPerPubdataByte ??= utilsZK.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT;
  tx.refundRecipient ??= sender; // nếu ko cung cấp recipient thì mặc định người nhận sẽ chính là sender
  tx.l2GasLimit ??= await zkSyncProvider.estimateL1ToL2Execute(transaction);

  const {
    contractAddress,
    l2Value,
    calldata,
    l2GasLimit,
    factoryDeps,
    operatorTip,
    overrides,
    gasPerPubdataByte,
    refundRecipient,
  } = tx;

  await insertGasPrice(providerL1, overrides);
  const gasPriceForEstimation = overrides.maxFeePerGas || overrides.gasPrice;

  const baseCost = await getBaseCost({
    gasPrice: await gasPriceForEstimation,
    gasPerPubdataByte,
    gasLimit: l2GasLimit,
  });

  overrides.value ??= baseCost.add(operatorTip).add(l2Value);

  await utilsZK.checkBaseCost(baseCost, overrides.value);

  return await zksyncContract.populateTransaction.requestL2Transaction(
    contractAddress,
    l2Value,
    calldata,
    l2GasLimit,
    utilsZK.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
    factoryDeps,
    refundRecipient,
    overrides
  );
}

unsignedTXL1toL2.to = recipient; // recipient có thể chính là sender
unsignedTXL1toL2.approveERC20 == false || undefined;
unsignedTXL1toL2.token == utilsZK.ETH_ADDRESS;

let TxDeposit = await getDepositTx(unsignedTXL1toL2);

const requestExecuteTx = await getRequestExecuteTx(TxDeposit);

/* requestExecuteTx = 
{
  data: '0xeb672419000000000000000000000000b98ef0896c9f1a175b97078f40097ea9fdf1858800000000000000000000000000000000000000000000000000b1a2bc2ec5000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000011366000000000000000000000000000000000000000000000000000000000000003200000000000000000000000000000000000000000000000000000000000000100000000000000000000000000b98ef0896c9f1a175b97078f40097ea9fdf1858800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  to: '0x1908e2BF4a88F91E4eF0DC72f02b8Ea36BEa2319',
  maxFeePerGas: BigNumber { _hex: '0x59682f0f', _isBigNumber: true },
  maxPriorityFeePerGas: BigNumber { _hex: '0x59682f00', _isBigNumber: true },
  accessList: [],
  value: BigNumber { _hex: '0xb3a3b46418e000', _isBigNumber: true },
  customData: {},
  ccipReadEnabled: true
} */

unsignedTxL1.to = requestExecuteTx.to;
unsignedTxL1.nonce = await providerL1.getTransactionCount(sender);
unsignedTxL1.gasPrice = requestExecuteTx.maxFeePerGas;
unsignedTxL1.maxFeePerGas = requestExecuteTx.maxFeePerGas;
unsignedTxL1.maxPriorityFeePerGas = requestExecuteTx.maxPriorityFeePerGas;
unsignedTxL1.type = 2; // no accessList, no maxPriorityFeePerGas, no maxFeePerGas
unsignedTxL1.data = requestExecuteTx.data;
unsignedTxL1.chainId = chainidGoerli;
unsignedTxL1.value = requestExecuteTx.value;
unsignedTxL1.gasLimit = await zkSyncProvider.estimateGas({
  from: sender,
  to: requestExecuteTx.to,
  data: requestExecuteTx.data,
  type: 2,
});

const digest = keccak256(serializeL1(unsignedTxL1));

const digestBytes = arrayify(digest);
if (digestBytes.length !== 32) {
  logger.throwArgumentError("bad digest length", "digest", digest);
}

export { digestBytes, unsignedTxL1 };
