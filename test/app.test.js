const nearAPI = require('near-api-js');
const testUtils = require('./test-utils');
const getConfig = require('../src/config');
const BN = require('bn.js');

const { KeyPair, Account, utils: { format: { parseNearAmount }} } = nearAPI;
const { 
    getAccountBalance,
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
		storageMinimum = await contractAlice.storage_minimum_balance({});
		await contractAlice.storage_deposit({}, GAS, storageMinimum);
        await contractBob.storage_deposit({}, GAS, storageMinimum);
        // storage may already be paid for contract
        try {
            await contract.storage_deposit({}, GAS, storageMinimum);
        } catch(e) {}
	});

	test('check deposit near to get wNEAR', async () => {
		const storageBalance = await contractAlice.storage_balance_of({ account_id: alice.accountId });
		expect(storageBalance.total).toEqual(storageMinimum);
		await contractAlice.near_deposit({}, GAS, parseNearAmount('1'));
		const wNEAR = await contractAlice.ft_balance_of({ account_id: alice.accountId });
		expect(wNEAR).toEqual(parseNearAmount('1'));
	});

	test('check transfer wNEAR', async () => {
		await contractAlice.ft_transfer({ receiver_id: bob.accountId, amount: parseNearAmount('0.5'), msg: 'test' }, GAS, 1);
        const wNEAR = await contractAlice.ft_balance_of({ account_id: alice.accountId });
		expect(wNEAR).toEqual(parseNearAmount('0.5'));
		const wNEARBob = await contractAlice.ft_balance_of({ account_id: bob.accountId });
		expect(wNEARBob).toEqual(parseNearAmount('0.5'));
	});

    /// one way to "refund" is transfer call back to contract and it will take tokens and return near
    test('check transfer_call wNEAR', async () => {
        const balance = await getAccountBalance(alice.accountId)
        await contractAlice.ft_transfer_call({ receiver_id: contractName, amount: parseNearAmount('0.1'), msg: 'test' }, GAS, 1);
        const balanceAfter = await getAccountBalance(alice.accountId)
		expect(new BN(balanceAfter.total).gt(new BN(balance.total))).toEqual(true);
	});

    /// the other way is to call near_withdraw on the token specific methods
	test('check withdraw wNEAR', async () => {
		await contractBob.near_withdraw({ amount: parseNearAmount('0.5') }, GAS, 1);
		const wNEAR = await contractBob.ft_balance_of({ account_id: bob.accountId });
		expect(wNEAR).toEqual('0');
	});

});