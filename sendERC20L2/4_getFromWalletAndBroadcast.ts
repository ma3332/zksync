import { res } from "./3_signInWallet.js";
import { unsignedTx } from "./2_generateHash.js";
import { SignatureLike } from "@ethersproject/bytes";
import { Provider, utils as utilsZK } from "zksync-web3";
import { zkSyncProvider } from "./utils.js";

const signatureBroadcast: SignatureLike = {
  r: res.r,
  s: res.s,
  _vs: res._vs,
  recoveryParam: res.recoveryParam,
  v: res.v,
};

// Broadcast to Blockchain
const txBytes = utilsZK.serialize(unsignedTx, signatureBroadcast);
zkSyncProvider.sendTransaction(txBytes);
