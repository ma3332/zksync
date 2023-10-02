import { BigNumberish } from "@ethersproject/bignumber";
import { ethers } from "ethers";
import {
  BytesLike,
  arrayify,
  hexZeroPad,
  splitSignature,
} from "@ethersproject/bytes";
import { Provider, utils as utilsZK, types } from "zksync-web3";
import {
  TypedDataDomain,
  TypedDataField,
} from "@ethersproject/abstract-signer";
import { joinSignature } from "@ethersproject/bytes";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { Logger } from "@ethersproject/logger";
import artifact from "./MyERC20.json" assert { type: "json" };

import _ec from "elliptic";
import EC = _ec.ec;

const version = "properties/5.7.0";
const logger = new Logger(version);

// Some Fix Value for Testing
let zkSyncProvider: Provider;
let chainid: number | undefined = 280; // ChainID of ZKsync Testnet
const EIP712_TX_TYPE = 0x71;
const DEFAULT_GAS_PER_PUBDATA_LIMIT = 50000;

type Address = string;

type Eip712Meta = {
  gasPerPubdata?: BigNumberish;
  factoryDeps?: BytesLike[];
  customSignature?: BytesLike;
  paymasterParams?: PaymasterParams;
};

type PaymasterParams = {
  paymaster: Address;
  paymasterInput: BytesLike;
};

const eip712Types: Record<string, Array<TypedDataField>> = {
  Transaction: [
    { name: "txType", type: "uint256" },
    { name: "from", type: "uint256" },
    { name: "to", type: "uint256" },
    { name: "gasLimit", type: "uint256" },
    { name: "gasPerPubdataByteLimit", type: "uint256" },
    { name: "maxFeePerGas", type: "uint256" },
    { name: "maxPriorityFeePerGas", type: "uint256" },
    { name: "paymaster", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
    { name: "factoryDeps", type: "bytes32[]" },
    { name: "paymasterInput", type: "bytes" },
  ],
};

let eip712Domain: TypedDataDomain = {
  name: "zkSync",
  version: "2",
  chainId: chainid,
};

function getCurve() {
  let _curve;
  if (!_curve) {
    _curve = new EC("secp256k1");
  }
  return _curve;
}

zkSyncProvider = new Provider("https://testnet.era.zksync.dev");

const PRIVATE_KEY: string = "";
const address: Address = "0xb98Ef0896C9f1A175B97078f40097ea9fdf18588";

const EMPTY_WALLET_PUBLIC_KEY: Address =
  "0x993f6bFbf4E65B8490e8d9c74B8f26f4ac4DEc1E";
const EMPTY_WALLET_PRIVATE_KEY: string =
  "0x1a9ce7062356726901e33974ca2f7c2b6b3508022bff207415b805c204a9df5d";

const PAYMASTER_ADDRESS = "0x5Fb3f0d0F8FfD0969cDe97E64C7BAb51608aE090"; // already deployed - test only

const balance = await zkSyncProvider.getBalance(EMPTY_WALLET_PUBLIC_KEY);

const TOKEN_ADDRESS = "0x693F76A09521902Ce89D05EDBFC8143FB87Fe6f9";

const erc20Contract = new ethers.Contract(
  TOKEN_ADDRESS,
  artifact.abi,
  zkSyncProvider
);

// some usefull functions
function _fillCustomData(data?: Eip712Meta): Eip712Meta {
  const customData = { ...data };
  customData.gasPerPubdata ??= DEFAULT_GAS_PER_PUBDATA_LIMIT;
  customData.factoryDeps ??= [];
  return customData;
}

// Phase 1 - Getting All Data
// Minting erc20 using paymaster
const txPopulated = await erc20Contract.populateTransaction.mint(
  EMPTY_WALLET_PUBLIC_KEY,
  ethers.utils.parseEther("5")
);

const paymasterParams = utilsZK.getPaymasterParams(PAYMASTER_ADDRESS, {
  type: "ApprovalBased",
  token: TOKEN_ADDRESS,
  // set minimalAllowance as we defined in the paymaster contract
  minimalAllowance: ethers.BigNumber.from(1),
  // empty bytes as testnet paymaster does not use innerInput
  innerInput: new Uint8Array(),
});

const customData: Eip712Meta = {
  gasPerPubdata: utilsZK.DEFAULT_GAS_PER_PUBDATA_LIMIT,
  paymasterParams: paymasterParams,
};

let unsignedTx: types.TransactionRequest = {
  to: "" || undefined,
  from: "" || undefined,
  nonce: 0 || undefined,

  gasLimit: 0 || undefined,
  gasPrice: 0 || undefined,

  data: "" || undefined,
  value: 0 || undefined,
  chainId: 0,

  type: 0 || undefined,
  accessList: [] || undefined,

  maxPriorityFeePerGas: 0 || undefined,
  maxFeePerGas: 0 || undefined,

  customData: {} || undefined,
  ccipReadEnabled: true || false || undefined,
};

unsignedTx.from = EMPTY_WALLET_PUBLIC_KEY;
unsignedTx.to = TOKEN_ADDRESS;
unsignedTx.nonce = await zkSyncProvider.getTransactionCount(
  EMPTY_WALLET_PUBLIC_KEY
);
unsignedTx.gasPrice = await zkSyncProvider.getGasPrice();
unsignedTx.type = EIP712_TX_TYPE;
unsignedTx.data = txPopulated.data;
unsignedTx.chainId = chainid;
unsignedTx.value = 0;
unsignedTx.customData = _fillCustomData(customData);
unsignedTx.gasLimit = await zkSyncProvider.estimateGas({
  from: EMPTY_WALLET_PUBLIC_KEY,
  to: TOKEN_ADDRESS,
  data: txPopulated.data,
  type: EIP712_TX_TYPE,
});

function getSignInput(
  transaction: types.TransactionRequest
): Record<string, any> {
  const maxFeePerGas = transaction.maxFeePerGas || transaction.gasPrice;
  const maxPriorityFeePerGas = transaction.maxPriorityFeePerGas || maxFeePerGas;
  const gasPerPubdataByteLimit =
    transaction.customData?.gasPerPubdata || DEFAULT_GAS_PER_PUBDATA_LIMIT;
  const signInput = {
    txType: transaction.type,
    from: transaction.from,
    to: transaction.to,
    gasLimit: transaction.gasLimit,
    gasPerPubdataByteLimit: gasPerPubdataByteLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymaster:
      transaction.customData?.paymasterParams?.paymaster ||
      ethers.constants.AddressZero,
    nonce: transaction.nonce,
    value: transaction.value,
    data: transaction.data,
    factoryDeps:
      transaction.customData?.factoryDeps?.map((dep) =>
        utilsZK.hashBytecode(dep)
      ) || [],
    paymasterInput:
      transaction.customData?.paymasterParams?.paymasterInput || "0x",
  };
  return signInput;
}

const populated = await _TypedDataEncoder.resolveNames(
  eip712Domain,
  eip712Types,
  getSignInput(unsignedTx),
  (name: string) => {
    if (zkSyncProvider == null) {
      logger.throwError(
        "cannot resolve ENS names without a provider",
        Logger.errors.UNSUPPORTED_OPERATION,
        {
          operation: "resolveName",
          value: name,
        }
      );
    }
    return zkSyncProvider.resolveName(name);
  }
);

const digest = _TypedDataEncoder.hash(
  populated.domain,
  eip712Types,
  populated.value
);

const keyPair = getCurve().keyFromPrivate(arrayify(EMPTY_WALLET_PRIVATE_KEY));
const digestBytes = arrayify(digest);
if (digestBytes.length !== 32) {
  logger.throwArgumentError("bad digest length", "digest", digest);
}
// Sign in Wallet
const signatureWallet = keyPair.sign(digestBytes, { canonical: true });

// Concatenate Signature in App
const signatureCustomData = joinSignature(
  splitSignature({
    recoveryParam: signatureWallet.recoveryParam,
    r: hexZeroPad("0x" + signatureWallet.r.toString(16), 32),
    s: hexZeroPad("0x" + signatureWallet.s.toString(16), 32),
  })
);

unsignedTx.customData.customSignature = signatureCustomData;

// Broadcast to Blockchain
const txBytes = utilsZK.serialize(unsignedTx);
await zkSyncProvider.sendTransaction(txBytes);

console.log(
  `Paymaster ERC20 token balance is now ${await erc20Contract.balanceOf(
    PAYMASTER_ADDRESS
  )}`
);
