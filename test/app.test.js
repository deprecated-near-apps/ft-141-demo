const nearAPI = require('near-api-js');
const testUtils = require('./test-utils');
const getConfig = require('../src/config');
const BN = require('bn.js');

const { KeyPair, Account, Contract, utils: { format: { parseNearAmount }} } = nearAPI;
const { 
	getAccountBalance,
	connection, initContract, getAccount, getContract,
	contract, contractAccount, contractName, contractMethods, createAccessKeyAccount
} = testUtils;
const { networkId, GAS } = getConfig();

jasmine.DEFAULT_TIMEOUT_INTERVAL = 50000;

describe('deploy contract ' + contractName, () => {
	let alice, contractAlice,
		bob, accountBob, contractBob,
		guest,
		guestAccount,
		storageMinimum;

	beforeAll(async () => {
		const { guestAccount: ga } = await initContract();
		guestAccount = ga;
		alice = await getAccount();
		console.log('\n\n', alice.accountId, '\n\n');
		contractAlice = await getContract(alice);
		// bob = await getAccount();
		// contractBob = await getContract(bob);

		/// create guest account
		bob = 'g' + Date.now() + '.' + contractName;
		console.log('\n\n', bob, '\n\n');
		const keyPair = KeyPair.fromRandom('ed25519');
		const public_key = keyPair.publicKey.toString();
		await guestAccount.addKey(public_key, contractName, contractMethods.changeMethods, parseNearAmount('0.1'));
		try {
			await contract.add_guest({ account_id: bob, public_key }, GAS);
		} catch(e) {
			console.warn(e);
		}
		connection.signer.keyStore.setKey(networkId, guestAccount.accountId, keyPair);
	    accountBob = new Account(connection, guestAccount.accountId);
		contractBob = new Contract(accountBob, contractName, { ...contractMethods });
		/// register alice account for storage
		storageMinimum = await contractAlice.storage_minimum_balance({});
		await contractAlice.storage_deposit({}, GAS, storageMinimum);
		// await contractBob.storage_deposit({}, GAS, storageMinimum);
		// storage may already be paid for contract
		try {
			await contract.storage_deposit({}, GAS, storageMinimum);
		} catch(e) {}
	});

	test('alice deposits NEAR to get wNEAR', async () => {
		const storageBalance = await contractAlice.storage_balance_of({ account_id: alice.accountId });
		expect(storageBalance.total).toEqual(storageMinimum);
		await contractAlice.near_deposit({}, GAS, parseNearAmount('1'));
		const wNEAR = await contractAlice.ft_balance_of({ account_id: alice.accountId });
		expect(wNEAR).toEqual(parseNearAmount('1'));
	});

	test('check that bob is a guest', async () => {
		const predecessor = await contractBob.get_predecessor({}, GAS);
		console.log('\n\n', bob, '\n\n');
		expect(predecessor).toEqual(bob);
	});

	test('alice transfers wNEAR to bob', async () => {
		await contractAlice.ft_transfer({ receiver_id: bob, amount: parseNearAmount('0.5'), msg: 'test' }, GAS, 1);
		const wNEAR = await contractAlice.ft_balance_of({ account_id: alice.accountId });
		expect(wNEAR).toEqual(parseNearAmount('0.5'));
		const wNEARBob = await contractAlice.ft_balance_of({ account_id: bob });
		expect(wNEARBob).toEqual(parseNearAmount('0.5'));
	});

	test('bob upgrades self with wNEAR', async () => {
		const keyPair = KeyPair.fromRandom('ed25519');
		const public_key = keyPair.publicKey.toString();
		connection.signer.keyStore.setKey(networkId, bob, keyPair);
		await contractBob.upgrade_guest({ public_key }, GAS);
		/// update account and contract for bob (bob now pays gas)
		accountBob = new Account(connection, bob);
		contractBob = new Contract(accountBob, contractName, { ...contractMethods });
		const state = await accountBob.state();
		expect(state.amount).toEqual(parseNearAmount('0.5'));
		const wNEARBob = await contractBob.ft_balance_of({ account_id: bob });
		expect(wNEARBob).toEqual('0');
	});

	test('alice can send NEAR to bob', async () => {
		await contractAlice.near_withdraw({ amount: parseNearAmount('0.5') }, GAS, 1);
		await alice.sendMoney(bob, parseNearAmount('0.5'));
		accountBob = new Account(connection, bob);
		const state = await accountBob.state();
		expect(state.amount).toEqual(parseNearAmount('1'));
	});

});