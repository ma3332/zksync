import { BigNumberish } from "@ethersproject/bignumber";
import { ethers, BigNumber, BytesLike, UnsignedTransaction } from "ethers";
import { arrayify, hexZeroPad, splitSignature } from "@ethersproject/bytes";
import { Provider, utils as utilsZK, types } from "zksync-web3";
import { SignatureLike } from "@ethersproject/bytes";
import { serialize as serializeL1 } from "@ethersproject/transactions";
import { keccak256 } from "@ethersproject/keccak256";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { Logger } from "@ethersproject/logger";
import _ec from "elliptic";
import IZKSyncFactory from "./IZKSyncFactory.json" assert { type: "json" };
import IL1BridgeFactory from "./IL1BridgeFactory.json" assert { type: "json" };
import IERC20MetadataFactory from "./IERC20MetadataFactory.json" assert { type: "json" };
import EC = _ec.ec;
const version = "properties/5.7.0";
const logger = new Logger(version);

// Some Fix Value for Testing
let zkSyncProvider: Provider;
let providerL1: ethers.providers.Provider;
let chainid: number | undefined = 280; // ChainID of ZKsync Testnet
let chainidGoerli: number | undefined = 5; // ChainID of Goerli Testnet

type Address = string;

function getCurve() {
  let _curve;
  if (!_curve) {
    _curve = new EC("secp256k1");
  }
  return _curve;
}

type TXL1toL2 = {
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

zkSyncProvider = new Provider("https://testnet.era.zksync.dev");
providerL1 = ethers.getDefaultProvider("goerli");

const PRIVATE_KEY_SENDER: string =
  "";
const txSender: Address = "0xb98Ef0896C9f1A175B97078f40097ea9fdf18588";

const ERC20_TOKEN_ADDRESS = "0xADaB7DA44cc648D703645AbAa0d31BacE5DA6c5a";

const L1BridgeAddress = "0x927DdFcc55164a59E0F33918D13a2D559bC10ce7";

const L2DiamondProxy = "0x1908e2BF4a88F91E4eF0DC72f02b8Ea36BEa2319"; // Interact via Proxy

let unsignedTXL1toL2: TXL1toL2 = {
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

async function getL1BridgeContracts() {
  return {
    erc20: new ethers.Contract(
      L1BridgeAddress,
      IL1BridgeFactory.abi,
      providerL1
    ),
  };
}

async function getMainContract() {
  return new ethers.Contract(L2DiamondProxy, IZKSyncFactory.abi, providerL1);
}

async function getERC20Contract(token: Address) {
  return new ethers.Contract(token, IERC20MetadataFactory.abi, providerL1);
}

const bridgeContracts = await getL1BridgeContracts();

async function getDepositTx(unsignedTXL1toL2: TXL1toL2): Promise<any> {
  if (unsignedTXL1toL2.bridgeAddress) {
    bridgeContracts.erc20.attach(unsignedTXL1toL2.bridgeAddress);
  }

  const { ...tx } = unsignedTXL1toL2;
  tx.to ??= txSender;
  tx.operatorTip ??= BigNumber.from(0);
  tx.overrides ??= {};
  tx.gasPerPubdataByte ??= utilsZK.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT;
  tx.l2GasLimit ??= await utilsZK.estimateDefaultBridgeDepositL2Gas(
    providerL1,
    zkSyncProvider,
    tx.token,
    tx.amount,
    tx.to,
    txSender,
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

async function insertGasPrice(
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

async function getRequestExecuteTx(transaction: {
  contractAddress: Address;
  calldata: BytesLike;
  l2GasLimit?: BigNumberish;
  l2Value?: BigNumberish;
  factoryDeps?: ethers.BytesLike[];
  operatorTip?: BigNumberish;
  gasPerPubdataByte?: BigNumberish;
  refundRecipient?: Address;
  overrides?: ethers.PayableOverrides;
}): Promise<ethers.PopulatedTransaction> {
  const zksyncContract = await getMainContract();

  const { ...tx } = transaction;
  tx.l2Value ??= BigNumber.from(0);
  tx.operatorTip ??= BigNumber.from(0);
  tx.factoryDeps ??= [];
  tx.overrides ??= {};
  tx.gasPerPubdataByte ??= utilsZK.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT;
  tx.refundRecipient ??= txSender;
  tx.l2GasLimit ??= await zkSyncProvider.estimateL1ToL2Execute(transaction);

  const {
    contractAddress,
    l2Value,
    calldata,
    l2GasLimit,
    factoryDeps,
    operatorTip,
    overrides,
    gasPerPubdataByte,
    refundRecipient,
  } = tx;

  await insertGasPrice(providerL1, overrides);
  const gasPriceForEstimation = overrides.maxFeePerGas || overrides.gasPrice;

  const baseCost = await getBaseCost({
    gasPrice: await gasPriceForEstimation,
    gasPerPubdataByte,
    gasLimit: l2GasLimit,
  });

  overrides.value ??= baseCost.add(operatorTip).add(l2Value);

  await utilsZK.checkBaseCost(baseCost, overrides.value);

  return await zksyncContract.populateTransaction.requestL2Transaction(
    contractAddress,
    l2Value,
    calldata,
    l2GasLimit,
    utilsZK.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
    factoryDeps,
    refundRecipient,
    overrides
  );
}

async function getBaseCost(params: {
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

/*
requestExecuteTx/ depositTx = 
{
  data: '0xeb672419000000000000000000000000b98ef0896c9f1a175b97078f40097ea9fdf1858800000000000000000000000000000000000000000000000000b1a2bc2ec5000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000011366000000000000000000000000000000000000000000000000000000000000003200000000000000000000000000000000000000000000000000000000000000100000000000000000000000000b98ef0896c9f1a175b97078f40097ea9fdf1858800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  to: '0x1908e2BF4a88F91E4eF0DC72f02b8Ea36BEa2319',
  maxFeePerGas: BigNumber { _hex: '0x59682f0f', _isBigNumber: true },
  maxPriorityFeePerGas: BigNumber { _hex: '0x59682f00', _isBigNumber: true },
  accessList: [],
  value: BigNumber { _hex: '0xb3a3b46418e000', _isBigNumber: true },
  customData: {},
  ccipReadEnabled: true
}
*/

let unsignedTxL1: UnsignedTransaction = {
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

let unsignedApproveTxL1: UnsignedTransaction = {
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

// Input from Front End
// unsignedTXL1toL2.token = utilsZK.ETH_ADDRESS;
// unsignedTXL1toL2.amount = ethers.utils.parseEther("0.05");

unsignedTXL1toL2.token = ERC20_TOKEN_ADDRESS;
unsignedTXL1toL2.amount = ethers.utils.parseEther("1000");
unsignedTXL1toL2.approveERC20 = true;

if (
  unsignedTXL1toL2.approveERC20 == false ||
  unsignedTXL1toL2.approveERC20 == undefined ||
  unsignedTXL1toL2.token == utilsZK.ETH_ADDRESS
) {
  const depositTx = await getDepositTx(unsignedTXL1toL2);

  const requestExecuteTx = await getRequestExecuteTx(depositTx);

  unsignedTxL1.to = requestExecuteTx.to;
  unsignedTxL1.nonce = await providerL1.getTransactionCount(txSender);
  unsignedTxL1.gasPrice = requestExecuteTx.maxFeePerGas;
  unsignedTxL1.maxFeePerGas = requestExecuteTx.maxFeePerGas;
  unsignedTxL1.maxPriorityFeePerGas = requestExecuteTx.maxPriorityFeePerGas;
  unsignedTxL1.type = 2; // no accessList, no maxPriorityFeePerGas, no maxFeePerGas
  unsignedTxL1.data = requestExecuteTx.data;
  unsignedTxL1.chainId = chainidGoerli;
  unsignedTxL1.value = requestExecuteTx.value;
  unsignedTxL1.gasLimit = await zkSyncProvider.estimateGas({
    from: txSender,
    to: requestExecuteTx.to,
    data: requestExecuteTx.data,
    type: 2,
  });

  const digest = keccak256(serializeL1(unsignedTxL1));

  const keyPair = getCurve().keyFromPrivate(arrayify(PRIVATE_KEY_SENDER));
  const digestBytes = arrayify(digest);
  if (digestBytes.length !== 32) {
    logger.throwArgumentError("bad digest length", "digest", digest);
  }
  // Sign in Wallet
  const signatureWallet = keyPair.sign(digestBytes, { canonical: true });

  // Concatenate Signature in App
  const sigSplit = splitSignature({
    v: signatureWallet.recoveryParam,
    r: hexZeroPad("0x" + signatureWallet.r.toString(16), 32),
    s: hexZeroPad("0x" + signatureWallet.s.toString(16), 32),
  });

  const signatureBroadcast: SignatureLike = {
    r: sigSplit.r,
    s: sigSplit.s,
    _vs: sigSplit._vs,
    recoveryParam: sigSplit.recoveryParam,
    v: sigSplit.v,
  };

  // Broadcast to Blockchain
  const txBytes = utilsZK.serialize(unsignedTxL1, signatureBroadcast);
  const resTx = await providerL1.sendTransaction(txBytes);
  await zkSyncProvider.getPriorityOpResponse(resTx);
} else if (unsignedTXL1toL2.approveERC20 == true) {
  let overrides = {
    bridgeAddress:
      unsignedTXL1toL2.bridgeAddress ?? bridgeContracts.erc20.address,
    ...unsignedTXL1toL2.approveOverrides,
  };
  let bridgeAddress = overrides.bridgeAddress;
  const erc20contract = await getERC20Contract(unsignedTXL1toL2.token);

  if (bridgeAddress == null) {
    bridgeAddress = (await zkSyncProvider.getDefaultBridgeAddresses()).erc20L1;
  } else {
    delete overrides.bridgeAddress;
  }

  const tx = await erc20contract.populateTransaction.approve(
    bridgeAddress,
    unsignedTXL1toL2.amount,
    overrides
  );

  // Perform Approve() of ERC20
  const feeData = await providerL1.getFeeData();
  unsignedApproveTxL1.to = ERC20_TOKEN_ADDRESS;
  unsignedApproveTxL1.nonce = await providerL1.getTransactionCount(txSender);
  unsignedApproveTxL1.maxFeePerGas = feeData.maxPriorityFeePerGas;
  unsignedApproveTxL1.gasPrice = feeData.maxPriorityFeePerGas;
  unsignedApproveTxL1.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
  unsignedApproveTxL1.type = 2; // no accessList, no maxPriorityFeePerGas, no maxFeePerGas
  unsignedApproveTxL1.data = tx.data;
  unsignedApproveTxL1.chainId = chainidGoerli;
  unsignedApproveTxL1.value = 0;
  unsignedApproveTxL1.gasLimit = await providerL1.estimateGas({
    from: txSender,
    to: ERC20_TOKEN_ADDRESS,
    data: tx.data,
    type: 2,
  });
  const keyPair = getCurve().keyFromPrivate(arrayify(PRIVATE_KEY_SENDER));

  const digestApproval = keccak256(serializeL1(unsignedApproveTxL1));

  const digestApprovalBytes = arrayify(digestApproval);
  if (digestApprovalBytes.length !== 32) {
    logger.throwArgumentError("bad digest length", "digest", digestApproval);
  }

  const depositTx = await getDepositTx(unsignedTXL1toL2);

  unsignedTxL1.to = depositTx.to;
  unsignedTxL1.nonce = await providerL1.getTransactionCount(txSender);
  unsignedTxL1.gasPrice = depositTx.maxFeePerGas;
  unsignedTxL1.maxFeePerGas = depositTx.maxFeePerGas;
  unsignedTxL1.maxPriorityFeePerGas = depositTx.maxPriorityFeePerGas;
  unsignedTxL1.type = 2; // no accessList, no maxPriorityFeePerGas, no maxFeePerGas
  unsignedTxL1.data = depositTx.data;
  unsignedTxL1.chainId = chainidGoerli;
  unsignedTxL1.value = depositTx.value;
  unsignedTxL1.gasLimit = await zkSyncProvider.estimateGas({
    from: txSender,
    to: depositTx.to,
    data: depositTx.data,
    type: 2,
  });

  const digestDepositERC20 = keccak256(serializeL1(unsignedTxL1));

  const digestDepositERC20Bytes = arrayify(digestDepositERC20);
  if (digestDepositERC20Bytes.length !== 32) {
    logger.throwArgumentError(
      "bad digest length",
      "digest",
      digestDepositERC20
    );
  }

  // Sign in Wallet for Approval Transaction
  const signatureApproval = keyPair.sign(digestApprovalBytes, {
    canonical: true,
  });

  // Sign in Wallet for Deposit Transaction
  const signatureDeposit = keyPair.sign(digestDepositERC20Bytes, {
    canonical: true,
  });

  // Concatenate Approval Signature in App
  const sigApprovalSplit = splitSignature({
    v: signatureApproval.recoveryParam,
    r: hexZeroPad("0x" + signatureApproval.r.toString(16), 32),
    s: hexZeroPad("0x" + signatureApproval.s.toString(16), 32),
  });

  const signatureApprovalBroadcast: SignatureLike = {
    r: sigApprovalSplit.r,
    s: sigApprovalSplit.s,
    _vs: sigApprovalSplit._vs,
    recoveryParam: sigApprovalSplit.recoveryParam,
    v: sigApprovalSplit.v,
  };

  // Broadcast to Blockchain
  const txApprovalBytes = utilsZK.serialize(
    unsignedApproveTxL1,
    signatureApprovalBroadcast
  );
  const resTxApproval = await providerL1.sendTransaction(txApprovalBytes);

  await resTxApproval.wait();

  // Concatenate Deposit Signature in App
  const sigDepositSplit = splitSignature({
    v: signatureDeposit.recoveryParam,
    r: hexZeroPad("0x" + signatureDeposit.r.toString(16), 32),
    s: hexZeroPad("0x" + signatureDeposit.s.toString(16), 32),
  });

  const signatureDepositBroadcast: SignatureLike = {
    r: sigDepositSplit.r,
    s: sigDepositSplit.s,
    _vs: sigDepositSplit._vs,
    recoveryParam: sigDepositSplit.recoveryParam,
    v: sigDepositSplit.v,
  };

  // Broadcast to Blockchain
  const txDepositBytes = utilsZK.serialize(
    unsignedTxL1,
    signatureDepositBroadcast
  );
  const resTxDepositERC20 = await providerL1.sendTransaction(txDepositBytes);
  await zkSyncProvider.getPriorityOpResponse(resTxDepositERC20);
}
