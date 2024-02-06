import { BigNumberish } from "@ethersproject/bignumber";
import { ethers, BigNumber, UnsignedTransaction, BytesLike } from "ethers";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { Provider } from "zksync-web3";
import IERC20MetadataFactory from "../IERC20MetadataFactory.json" assert { type: "json" };
import IZKSyncFactory from "../IZKSyncFactory.json" assert { type: "json" };
import { utils as utilsZK } from "zksync-web3";
import IL1BridgeFactory from "../IL1BridgeFactory.json" assert { type: "json" };
import IL2BridgeFactory from "../IL2BridgeFactory.json" assert { type: "json" };

let withdrawalHash: string;
let TxIndex: number;
let overrides: ethers.Overrides = {} || undefined;
type Address = string;

type WithdrawTXL2 = {
  token: Address;
  amount: BigNumberish;
  to?: Address;
  bridgeAddress?: Address;
  overrides?: ethers.Overrides;
};

export let zkSyncProvider: Provider = new Provider(
  "https://testnet.era.zksync.dev"
);
export const txSender: Address = "0xb98Ef0896C9f1A175B97078f40097ea9fdf18588";
export const L2DiamondProxy: Address =
  "0x1908e2BF4a88F91E4eF0DC72f02b8Ea36BEa2319"; // Interact via Proxy
export const L2ERC20Bridge: Address =
  "0x00ff932A6d70E2B8f1Eb4919e1e09C1923E7e57b";
export const L1ERC20Bridge: Address =
  "0x927DdFcc55164a59E0F33918D13a2D559bC10ce7";
export let chainidGoerli: number | undefined = 5; // ChainID of Goerli Testnet
export let providerL1: ethers.providers.Provider =
  ethers.getDefaultProvider("goerli");

export const l2Bridge = new ethers.Contract(
  L2ERC20Bridge,
  IL2BridgeFactory.abi,
  zkSyncProvider
);

export const l1Bridge = new ethers.Contract(
  l2Bridge.l1Bridge(),
  IL1BridgeFactory.abi,
  providerL1
);

export const zksync = new ethers.Contract(
  L2DiamondProxy,
  IZKSyncFactory.abi,
  providerL1
);

export let unsignedWithdrawTxL1: UnsignedTransaction = {
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

export let unsignedWithdrawTxL2: UnsignedTransaction = {
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

export async function finalizeWithdrawalParams(
  withdrawalHash: BytesLike,
  index: number = 0,
  zkSyncProvider: Provider
) {
  const { log, l1BatchTxId } = await _getWithdrawalLog(
    withdrawalHash,
    index,
    zkSyncProvider
  );
  const { l2ToL1LogIndex } = await _getWithdrawalL2ToL1Log(
    withdrawalHash,
    index,
    zkSyncProvider
  );
  const senderFromL2 = ethers.utils.hexDataSlice(log.topics[1], 12);
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
    senderFromL2,
    proof: proof.proof,
  };
}

export async function _getWithdrawalLog(
  withdrawalHash: BytesLike,
  index: number = 0,
  zkSyncProvider: Provider
) {
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

export async function _getWithdrawalL2ToL1Log(
  withdrawalHash: BytesLike,
  index: number = 0,
  zkSyncProvider: Provider
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

export let initWithdrawL2: WithdrawTXL2 = {
  token: "",
  amount: 0,
  to: "" || undefined,
  bridgeAddress: "" || undefined,
  overrides: {} || undefined,
};
