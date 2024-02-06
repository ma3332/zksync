import { resWithdrawETHL2 } from "./3b_L2signInWalletETH.js";
import { unsignedWithdrawTxL2 } from "./2b_L2generateHashETH.js";
import { SignatureLike } from "@ethersproject/bytes";
import { Provider, utils as utilsZK } from "zksync-web3";
import { zkSyncProvider } from "./utils.js";

// Broadcast txApproval to Blockchain
const signatureWithdrawL2Broadcast: SignatureLike = {
  r: resWithdrawETHL2.r,
  s: resWithdrawETHL2.s,
  _vs: resWithdrawETHL2._vs,
  recoveryParam: resWithdrawETHL2.recoveryParam,
  v: resWithdrawETHL2.v,
};

const txWithdrawBytes = utilsZK.serialize(
  unsignedWithdrawTxL2,
  signatureWithdrawL2Broadcast
);
const resTxWithdrawETHL2 = await zkSyncProvider.sendTransaction(
  txWithdrawBytes
);

export { resTxWithdrawETHL2 };
