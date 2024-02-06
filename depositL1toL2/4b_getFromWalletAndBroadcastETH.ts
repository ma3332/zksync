import { res } from "./3b_signInWalletETH.js";
import { unsignedTxL1 } from "./2b_generateHashETH.js";
import { SignatureLike } from "@ethersproject/bytes";
import { utils as utilsZK } from "zksync-web3";
import { zkSyncProvider } from "./utils.js";

// Broadcast txDepositETH to Blockchain
const signatureDepositEthBroadcast: SignatureLike = {
  r: res.r,
  s: res.s,
  _vs: res._vs,
  recoveryParam: res.recoveryParam,
  v: res.v,
};

const txDepositEthBytes = utilsZK.serialize(
  unsignedTxL1,
  signatureDepositEthBroadcast
);

zkSyncProvider.sendTransaction(txDepositEthBytes);
