import { BigNumberish } from "@ethersproject/bignumber";
import { ethers } from "ethers";
import {
  BytesLike,
  arrayify,
  hexZeroPad,
  splitSignature,
} from "@ethersproject/bytes";
import { Provider, utils as utilsZK, types } from "zksync-web3";
import {
  TypedDataDomain,
  TypedDataField,
} from "@ethersproject/abstract-signer";
import { joinSignature } from "@ethersproject/bytes";
import { _TypedDataEncoder } from "@ethersproject/hash";
import paymaster from "./deployGeneralPayMaster/generalPaymasterAddress.json" assert { type: "json" };
import paymasterAbi from "./deployGeneralPayMaster/GeneralPaymaster.json" assert { type: "json" };
import { Logger } from "@ethersproject/logger";

const version = "properties/5.7.0";
export const logger = new Logger(version);

export let zkSyncProvider = new Provider("https://testnet.era.zksync.dev");

export const chaindZK: number | undefined = 280; // ChainID of ZKsync Testnet
export const EIP712_TX_TYPE = 0x71;
export const DEFAULT_GAS_PER_PUBDATA_LIMIT = 50000;

export type Address = string;

export type Eip712Meta = {
  gasPerPubdata?: BigNumberish;
  factoryDeps?: BytesLike[];
  customSignature?: BytesLike;
  paymasterParams?: PaymasterParams;
};

export type PaymasterParams = {
  paymaster: Address;
  paymasterInput: BytesLike;
};

export const eip712Types: Record<string, Array<TypedDataField>> = {
  Transaction: [
    { name: "txType", type: "uint256" },
    { name: "from", type: "uint256" },
    { name: "to", type: "uint256" },
    { name: "gasLimit", type: "uint256" },
    { name: "gasPerPubdataByteLimit", type: "uint256" },
    { name: "maxFeePerGas", type: "uint256" },
    { name: "maxPriorityFeePerGas", type: "uint256" },
    { name: "paymaster", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
    { name: "factoryDeps", type: "bytes32[]" },
    { name: "paymasterInput", type: "bytes" },
  ],
};

export let eip712Domain: TypedDataDomain = {
  name: "zkSync",
  version: "2",
  chainId: chaindZK,
};

export function _fillCustomData(data?: Eip712Meta): Eip712Meta {
  const customData = { ...data };
  customData.gasPerPubdata ??= DEFAULT_GAS_PER_PUBDATA_LIMIT;
  customData.factoryDeps ??= [];
  return customData;
}

// Type: general is zero Gas
// Type: ApprovalBased is pay Gas by ERC20
export const paymasterParams = utilsZK.getPaymasterParams(
  paymaster.GeneralPaymasterAddress,
  {
    type: "General",
    innerInput: new Uint8Array(),
  }
);

export const customData: Eip712Meta = {
  gasPerPubdata: utilsZK.DEFAULT_GAS_PER_PUBDATA_LIMIT,
  paymasterParams: paymasterParams,
};

export function getSignInput(
  transaction: types.TransactionRequest
): Record<string, any> {
  const maxFeePerGas = transaction.maxFeePerGas || transaction.gasPrice;
  const maxPriorityFeePerGas = transaction.maxPriorityFeePerGas || maxFeePerGas;
  const gasPerPubdataByteLimit =
    transaction.customData?.gasPerPubdata || DEFAULT_GAS_PER_PUBDATA_LIMIT;
  const signInput = {
    txType: transaction.type,
    from: transaction.from,
    to: transaction.to,
    gasLimit: transaction.gasLimit,
    gasPerPubdataByteLimit: gasPerPubdataByteLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymaster:
      transaction.customData?.paymasterParams?.paymaster ||
      ethers.constants.AddressZero,
    nonce: transaction.nonce,
    value: transaction.value,
    data: transaction.data,
    factoryDeps:
      transaction.customData?.factoryDeps?.map((dep) =>
        utilsZK.hashBytecode(dep)
      ) || [],
    paymasterInput:
      transaction.customData?.paymasterParams?.paymasterInput || "0x",
  };
  return signInput;
}
