const nearAPI = require('near-api-js');
const testUtils = require('./test-utils');
const getConfig = require('../src/config');

const { KeyPair, Account, utils: { format: { parseNearAmount }} } = nearAPI;
const { 
	connection, initContract, getAccount, getContract,
	contract, contractAccount, contractName, contractMethods, createAccessKeyAccount
} = testUtils;
const { GAS } = getConfig();

jasmine.DEFAULT_TIMEOUT_INTERVAL = 50000;

describe('deploy contract ' + contractName, () => {
	let alice, bob, contractAlice, contractBob, storageMinimum;

	beforeAll(async () => {
		alice = await getAccount();
		contractAlice = await getContract(alice);
		bob = await getAccount();
		contractBob = await getContract(bob);
		await initContract(alice.accountId);
	});

	test('check deposit near to get wNEAR', async () => {
		storageMinimum = await contractAlice.storage_minimum_balance({});
		await contractAlice.storage_deposit({}, GAS, storageMinimum);
		const storageBalance = await contractAlice.storage_balance_of({ account_id: alice.accountId });
		expect(storageBalance.total).toEqual(storageMinimum);
		await contractAlice.near_deposit({}, GAS, parseNearAmount('1'));
		const wNEAR = await contractAlice.ft_balance_of({ account_id: alice.accountId });
		expect(wNEAR).toEqual(parseNearAmount('1'));
	});

	test('check transfer wNEAR', async () => {
        await contractBob.storage_deposit({}, GAS, storageMinimum);
		await contractAlice.ft_transfer({ receiver_id: bob.accountId, amount: parseNearAmount('0.5'), msg: 'test' }, GAS, 1);
        const wNEAR = await contractAlice.ft_balance_of({ account_id: alice.accountId });
		expect(wNEAR).toEqual(parseNearAmount('0.5'));
		const wNEARBob = await contractAlice.ft_balance_of({ account_id: bob.accountId });
		expect(wNEARBob).toEqual(parseNearAmount('0.5'));
	});

	test('check withdraw wNEAR', async () => {
		await contractBob.near_withdraw({ amount: parseNearAmount('0.5') }, GAS, 1);
		const wNEAR = await contractBob.ft_balance_of({ account_id: bob.accountId });
		expect(wNEAR).toEqual('0');
	});

});