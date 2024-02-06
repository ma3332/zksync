import { resWithdrawL1 } from "./6b_L1signInWalletETH.js";
import { unsignedWithdrawTxL1 } from "./5b_L1generateHashETH.js";
import { SignatureLike } from "@ethersproject/bytes";
import { Provider, utils as utilsZK } from "zksync-web3";
import { zkSyncProvider } from "./utils.js";

// Step 2: After 24h hour Finalize withdraw in L1
const signatureWithdrawL1Broadcast: SignatureLike = {
  r: resWithdrawL1.r,
  s: resWithdrawL1.s,
  _vs: resWithdrawL1._vs,
  recoveryParam: resWithdrawL1.recoveryParam,
  v: resWithdrawL1.v,
};

const txWithdrawBytes = utilsZK.serialize(
  unsignedWithdrawTxL1,
  signatureWithdrawL1Broadcast
);

zkSyncProvider.sendTransaction(txWithdrawBytes);
