import { utils as utilsZK } from "zksync-web3";

// --------- This is input from Front End ------------
const sender = "";
const nativeCoin = utilsZK.ETH_ADDRESS;
const ERC20token = "";
const withdrawAmtETH = "";
const withdrawAmtERC20 = "";
const recipient = "";

export {
  sender,
  withdrawAmtETH,
  nativeCoin,
  ERC20token,
  withdrawAmtERC20,
  recipient,
};
