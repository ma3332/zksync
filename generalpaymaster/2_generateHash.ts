import { Provider, utils as utilsZK, types } from "zksync-web3";
import { arrayify } from "@ethersproject/bytes";
import { Logger } from "@ethersproject/logger";
import { _TypedDataEncoder } from "@ethersproject/hash";
import {
  paymasterParams,
  _fillCustomData,
  zkSyncProvider,
  EIP712_TX_TYPE,
  chaindZK,
  customData,
  getSignInput,
  logger,
  eip712Domain,
  eip712Types,
} from "./utils.js";
import { sender, txPopulated, erc20Contract } from "./1_inputFromClient.js";

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

unsignedTx.from = sender;
unsignedTx.to = erc20Contract.address;
unsignedTx.nonce = await zkSyncProvider.getTransactionCount(sender);
unsignedTx.gasPrice = await zkSyncProvider.getGasPrice();
unsignedTx.type = EIP712_TX_TYPE;
unsignedTx.data = txPopulated.data;
unsignedTx.chainId = chaindZK;
unsignedTx.value = 0;
unsignedTx.customData = _fillCustomData(customData);
unsignedTx.gasLimit = await zkSyncProvider.estimateGas({
  from: sender,
  to: erc20Contract.address,
  data: txPopulated.data,
  type: EIP712_TX_TYPE,
});

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

const digestBytes = arrayify(digest);
if (digestBytes.length !== 32) {
  logger.throwArgumentError("bad digest length", "digest", digest);
}

export { digestBytes, unsignedTx };
