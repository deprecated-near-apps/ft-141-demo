const contractName = "dev-1614282578076-7902606";

module.exports = function getConfig() {
  let config = {
    networkId: "testnet",
    nodeUrl: "https://rpc.testnet.near.org",
    walletUrl: "https://wallet.testnet.near.org",
    helperUrl: "https://helper.testnet.near.org",
    contractName,
  };

  if (process.env.REACT_APP_ENV !== undefined) {
    config = {
      ...config,
      GAS: "200000000000000",
      DEFAULT_NEW_ACCOUNT_AMOUNT: "5",
      GUESTS_ACCOUNT_SECRET:
        "7UVfzoKZL4WZGF98C3Ue7tmmA6QamHCiB1Wd5pkxVPAc7j6jf3HXz5Y9cR93Y68BfGDtMLQ9Q29Njw5ZtzGhPxv",
      contractMethods: {
        changeMethods: [
          "new",
          "storage_deposit",
          "storage_withdraw",
          "near_deposit",
          "near_deposit_with_storage",
          "near_withdraw",
          "ft_transfer",
          "ft_transfer_call",
          "add_guest",
          "get_predecessor",
          "upgrade_guest",
          "make_proposal",
          "fund_proposal",
          "remove_proposal",
        ],
        viewMethods: [
          "storage_minimum_balance",
          "storage_balance_of",
          "ft_balance_of",
          "get_proposal",
          "get_guest",
        ],
      },
    };
  }

  if (process.env.REACT_APP_ENV === "prod") {
    config = {
      ...config,
      networkId: "mainnet",
      nodeUrl: "https://rpc.mainnet.near.org",
      walletUrl: "https://wallet.near.org",
      helperUrl: "https://helper.mainnet.near.org",
      contractName: "near",
    };
  }

  return config;
};
