const contractName = 'dev-1613961314306-8335889';

module.exports = function getConfig() {
	let config = {
		networkId: 'default',
		nodeUrl: 'https://rpc.testnet.near.org',
		walletUrl: 'https://wallet.testnet.near.org',
		helperUrl: 'https://helper.testnet.near.org',
		contractName,
	};
    
	if (process.env.REACT_APP_ENV !== undefined) {
		config = {
			...config,
			GAS: '200000000000000',
			DEFAULT_NEW_ACCOUNT_AMOUNT: '5',
			GUESTS_ACCOUNT_SECRET: '7UVfzoKZL4WZGF98C3Ue7tmmA6QamHCiB1Wd5pkxVPAc7j6jf3HXz5Y9cR93Y68BfGDtMLQ9Q29Njw5ZtzGhPxv',
			contractMethods: {
				changeMethods: ['new', 'storage_deposit', 'storage_withdraw', 'near_deposit', 'near_withdraw', 'near_guest_withdraw', 'ft_transfer', 'ft_transfer_call', 'add_guest', 'get_predecessor', 'upgrade_guest'],
				viewMethods: ['storage_minimum_balance', 'storage_balance_of', 'ft_balance_of'],
			},
		};
	}
    
	if (process.env.REACT_APP_ENV === 'prod') {
		config = {
			...config,
			networkId: 'mainnet',
			nodeUrl: 'https://rpc.mainnet.near.org',
			walletUrl: 'https://wallet.near.org',
			helperUrl: 'https://helper.mainnet.near.org',
			contractName: 'near',
		};
	}

	return config;
};
