import { resWithdrawL2 } from "./3a_L2signInWalletERC20.js";
import { unsignedWithdrawTxL2 } from "./2a_L2generateHashERC20.js";
import { SignatureLike } from "@ethersproject/bytes";
import { Provider, utils as utilsZK } from "zksync-web3";
import { zkSyncProvider } from "./utils.js";

// Broadcast txApproval to Blockchain
const signatureWithdrawL2Broadcast: SignatureLike = {
  r: resWithdrawL2.r,
  s: resWithdrawL2.s,
  _vs: resWithdrawL2._vs,
  recoveryParam: resWithdrawL2.recoveryParam,
  v: resWithdrawL2.v,
};

const txWithdrawBytes = utilsZK.serialize(
  unsignedWithdrawTxL2,
  signatureWithdrawL2Broadcast
);
const resTxWithdrawL2 = await zkSyncProvider.sendTransaction(txWithdrawBytes);

export { resTxWithdrawL2 };
