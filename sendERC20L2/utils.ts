import { BigNumberish } from "@ethersproject/bignumber";
import { ethers, BigNumber, UnsignedTransaction, BytesLike } from "ethers";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { Provider } from "zksync-web3";
import IERC20MetadataFactory from "../IERC20MetadataFactory.json" assert { type: "json" };
import IZKSyncFactory from "../IZKSyncFactory.json" assert { type: "json" };
import { utils as utilsZK } from "zksync-web3";
import IL1BridgeFactory from "../IL1BridgeFactory.json" assert { type: "json" };
import IL2BridgeFactory from "../IL2BridgeFactory.json" assert { type: "json" };

export let zkSyncProvider: Provider = new Provider(
  "https://testnet.era.zksync.dev"
);

export let chainid: number | undefined = 280; // ChainID of ZKsync Testnet

export let unsignedTx: UnsignedTransaction = {
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

