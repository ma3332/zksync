import { BigNumberish } from "@ethersproject/bignumber";
import { ethers, BigNumber, UnsignedTransaction, BytesLike } from "ethers";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { Provider } from "zksync-web3";
import IERC20MetadataFactory from "../IERC20MetadataFactory.json" assert { type: "json" };
import IZKSyncFactory from "../IZKSyncFactory.json" assert { type: "json" };
import IL1BridgeFactory from "../IL1BridgeFactory.json" assert { type: "json" };
import { utils as utilsZK } from "zksync-web3";

export type Address = string;

export type TXL1toL2 = {
  token: Address;
  amount: BigNumberish;
  to?: Address;
  operatorTip?: BigNumberish;
  bridgeAddress?: Address;
  approveERC20?: Boolean;
  l2GasLimit?: BigNumberish;
  gasPerPubdataByte?: BigNumberish;
  overrides?: ethers.PayableOverrides;
  approveOverrides?: ethers.Overrides;
};

export let unsignedTXL1toL2: TXL1toL2 = {
  token: "",
  amount: 0,
  to: "" || undefined,
  operatorTip: 0 || undefined,
  bridgeAddress: "" || undefined,
  approveERC20: true || undefined,
  l2GasLimit: 0 || undefined,
  gasPerPubdataByte: 0 || undefined,
  overrides: {
    gasLimit: 0 || undefined,
    gasPrice: 0 || undefined,
    maxFeePerGas: 0 || undefined,
    maxPriorityFeePerGas: 0 || undefined,
    nonce: 0 || undefined,
    type: 0 || undefined,
    accessList: [] || undefined,
    customData: {} || undefined,
    ccipReadEnabled: true || false || undefined,
    value: 0 || undefined,
  },
  approveOverrides: {} || undefined,
};

export let unsignedTxL1: UnsignedTransaction = {
  to: "" || undefined,
  nonce: 0 || undefined,

  gasLimit: 0 || undefined,
  gasPrice: 0 || undefined,

  data: "" || undefined,
  value: 0 || undefined,
  chainId: 0,

  type: 0 || undefined,

  maxPriorityFeePerGas: 0 || undefined,
  maxFeePerGas: 0 || undefined,
};

export let unsignedApproveTxL1: UnsignedTransaction = {
  to: "" || undefined,
  nonce: 0 || undefined,

  gasLimit: 0 || undefined,
  gasPrice: 0 || undefined,

  data: "" || undefined,
  value: 0 || undefined,
  chainId: 0,

  type: 0 || undefined,

  maxPriorityFeePerGas: 0 || undefined,
  maxFeePerGas: 0 || undefined,
};

export const L1BridgeAddress = "0x927DdFcc55164a59E0F33918D13a2D559bC10ce7"; // Testnet

export const L2DiamondProxy = "0x1908e2BF4a88F91E4eF0DC72f02b8Ea36BEa2319"; // Interact via Proxy

export let zkSyncProvider: Provider = new Provider(
  "https://testnet.era.zksync.dev"
);

export let providerL1: ethers.providers.Provider =
  ethers.getDefaultProvider("goerli");

export async function getERC20Contract(token: Address) {
  return new ethers.Contract(token, IERC20MetadataFactory.abi, providerL1);
}

export async function getMainContract() {
  return new ethers.Contract(L2DiamondProxy, IZKSyncFactory.abi, providerL1);
}

export const bridgeContracts = new ethers.Contract(
  L1BridgeAddress,
  IL1BridgeFactory.abi,
  providerL1
);

export async function insertGasPrice(
  l1Provider: ethers.providers.Provider,
  overrides: ethers.PayableOverrides
) {
  if (!overrides.gasPrice && !overrides.maxFeePerGas) {
    const l1FeeData = await l1Provider.getFeeData();

    // Sometimes baseFeePerGas is not available, so we use gasPrice instead.
    const baseFee = l1FeeData.lastBaseFeePerGas || l1FeeData.gasPrice;

    // ethers.js by default uses multiplcation by 2, but since the price for the L2 part
    // will depend on the L1 part, doubling base fee is typically too much.
    const maxFeePerGas = baseFee
      .mul(3)
      .div(2)
      .add(l1FeeData.maxPriorityFeePerGas);

    overrides.maxFeePerGas = maxFeePerGas;
    overrides.maxPriorityFeePerGas = l1FeeData.maxPriorityFeePerGas;
  }
}

// Some Fix Value for Testing
export const chainidGoerli: number | undefined = 5; // ChainID of Goerli Testnet

export async function getDepositTx(unsignedTXL1toL2: TXL1toL2): Promise<any> {
  if (unsignedTXL1toL2.bridgeAddress) {
    bridgeContracts.erc20.attach(unsignedTXL1toL2.bridgeAddress);
  }

  const { ...tx } = unsignedTXL1toL2;
  tx.to ??= "";
  tx.operatorTip ??= BigNumber.from(0);
  tx.overrides ??= {};
  tx.gasPerPubdataByte ??= utilsZK.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT;
  tx.l2GasLimit ??= await utilsZK.estimateDefaultBridgeDepositL2Gas(
    providerL1,
    zkSyncProvider,
    tx.token,
    tx.amount,
    tx.to,
    "",
    tx.gasPerPubdataByte
  );

  const { to, token, amount, operatorTip, overrides } = tx;

  await insertGasPrice(providerL1, overrides);
  const gasPriceForEstimation = overrides.maxFeePerGas || overrides.gasPrice;

  const zksyncContract = await getMainContract();

  const baseCost = await zksyncContract.l2TransactionBaseCost(
    await gasPriceForEstimation,
    tx.l2GasLimit,
    tx.gasPerPubdataByte
  );

  if (token == utilsZK.ETH_ADDRESS) {
    overrides.value ??= baseCost.add(operatorTip).add(amount);

    return {
      contractAddress: to,
      calldata: "0x",
      l2Value: amount,
      // For some reason typescript can not deduce that we've already set the
      // tx.l2GasLimit
      l2GasLimit: tx.l2GasLimit!,
      ...tx,
    };
  } else {
    const args: [Address, Address, BigNumberish, BigNumberish, BigNumberish] = [
      to,
      token,
      amount,
      tx.l2GasLimit,
      tx.gasPerPubdataByte,
    ];

    overrides.value ??= baseCost.add(operatorTip);
    await utilsZK.checkBaseCost(baseCost, overrides.value);

    // TODO: compatibility layer: using the old API which uses msg.sender as the
    // refund recipient, to make the SDK compatible with the old contracts.
    // const contract = bridgeContracts.erc20 as ethers.Contract;
    return await bridgeContracts.erc20.populateTransaction.deposit(
      ...args,
      overrides
    );
  }
}

export async function getBaseCost(params: {
  gasLimit: BigNumberish;
  gasPerPubdataByte?: BigNumberish;
  gasPrice?: BigNumberish;
}): Promise<BigNumber> {
  const zksyncContract = await getMainContract();
  const parameters = { ...utilsZK.layer1TxDefaults(), ...params };
  parameters.gasPrice ??= await providerL1.getGasPrice();
  parameters.gasPerPubdataByte ??=
    utilsZK.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT;

  return BigNumber.from(
    await zksyncContract.l2TransactionBaseCost(
      parameters.gasPrice,
      parameters.gasLimit,
      parameters.gasPerPubdataByte
    )
  );
}
