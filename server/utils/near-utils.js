const fs = require("fs");
const nearAPI = require("near-api-js");
const getConfig = require("../../src/config");
const {
  nodeUrl,
  networkId,
  contractName,
  contractMethods,
  GUESTS_ACCOUNT_SECRET,
} = getConfig();
const {
  Near,
  Account,
  Contract,
  KeyPair,
  keyStores: { InMemoryKeyStore },
  utils: {
    format: { parseNearAmount },
  },
} = nearAPI;

console.log(
  "Loading Credentials:\n",
  `${process.env.HOME}/.near-credentials/${networkId}/${contractName}.json`
);
const credentials = JSON.parse(
  fs.readFileSync(
    `${process.env.HOME}/.near-credentials/${networkId}/${contractName}.json`
  )
);

const keyStore = new InMemoryKeyStore();
keyStore.setKey(
  networkId,
  contractName,
  KeyPair.fromString(credentials.private_key)
);
const near = new Near({
  networkId,
  nodeUrl,
  deps: { keyStore },
});
const { connection } = near;
const contractAccount = new Account(connection, contractName);
contractAccount.addAccessKey = (publicKey) =>
  contractAccount.addKey(
    publicKey,
    contractName,
    contractMethods.changeMethods,
    parseNearAmount("0.1")
  );
const contract = new Contract(contractAccount, contractName, contractMethods);

/// guests.contractName account and contract
const guestAccountId = "guests." + contractName;
const guestAccount = new nearAPI.Account(connection, guestAccountId);
const newKeyPair = KeyPair.fromString(GUESTS_ACCOUNT_SECRET);
keyStore.setKey(networkId, guestAccountId, newKeyPair);

module.exports = {
  near,
  keyStore,
  connection,
  contract,
  contractName,
  contractAccount,
  guestAccount,
};
