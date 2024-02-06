import { signatureCustomData } from "./3_signInWallet.js";
import { unsignedTx } from "./2_generateHash.js";
import { SignatureLike } from "@ethersproject/bytes";
import { Provider, utils as utilsZK } from "zksync-web3";
import { zkSyncProvider } from "./utils.js";
import { joinSignature } from "@ethersproject/bytes";

const joinSign = joinSignature(signatureCustomData);

unsignedTx.customData.customSignature = joinSign;

// Broadcast to Blockchain
const txBytes = utilsZK.serialize(unsignedTx);
zkSyncProvider.sendTransaction(txBytes);
