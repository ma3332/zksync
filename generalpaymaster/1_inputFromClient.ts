import { utils as utilsZK } from "zksync-web3";
import { zkSyncProvider } from "./utils.js";
import { ethers } from "ethers";
import NFTaddress from "./SampleSmartContract/NFT_address.json" assert { type: "json" };
import NFTabi from "./SampleSmartContract/compiled_NFT.json" assert { type: "json" };

// --------- This is input from Front End ------------
// --------- Example: User create an NFT -------------

const erc20Contract = new ethers.Contract(
  NFTaddress.NFTaddress,
  NFTabi["NFT.sol"]["NFT"]["abi"],
  zkSyncProvider
);
const tokenURI = "";
const txPopulated = await erc20Contract.populateTransaction.mintToken(tokenURI);

const sender = "";

export { sender, txPopulated, erc20Contract };
