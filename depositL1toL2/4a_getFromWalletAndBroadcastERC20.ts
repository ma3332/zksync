import { resApprove, resDeposit } from "./3a_signInWalletERC20.js";
import { unsignedApproveTxL1, unsignedTxL1 } from "./2a_generateHashERC20.js";
import { SignatureLike } from "@ethersproject/bytes";
import { Provider, utils as utilsZK } from "zksync-web3";
import { zkSyncProvider } from "./utils.js";

// Broadcast txApproval to Blockchain
const signatureApprovalBroadcast: SignatureLike = {
  r: resApprove.r,
  s: resApprove.s,
  _vs: resApprove._vs,
  recoveryParam: resApprove.recoveryParam,
  v: resApprove.v,
};

const txApprovalBytes = utilsZK.serialize(
  unsignedApproveTxL1,
  signatureApprovalBroadcast
);
const resTxApproval = await zkSyncProvider.sendTransaction(txApprovalBytes);
await resTxApproval.wait();

// Broadcast txDepositERC20 to Blockchain
const signatureDepositBroadcast: SignatureLike = {
  r: resDeposit.r,
  s: resDeposit.s,
  _vs: resDeposit._vs,
  recoveryParam: resDeposit.recoveryParam,
  v: resDeposit.v,
};

const txDepositBytes = utilsZK.serialize(
  unsignedTxL1,
  signatureDepositBroadcast
);
const resTxDepositERC20 = await zkSyncProvider.sendTransaction(txDepositBytes);
await zkSyncProvider.getPriorityOpResponse(resTxDepositERC20);
