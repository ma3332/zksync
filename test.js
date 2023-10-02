import { Provider } from "zksync-web3";

const zkSyncProvider = new Provider("https://testnet.era.zksync.dev");

console.log(await zkSyncProvider.getMainContractAddress());
