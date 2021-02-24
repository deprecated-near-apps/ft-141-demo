import React, { useState, useEffect } from 'react';
import * as nearAPI from 'near-api-js';
import { get, set, del } from '../utils/storage';
import { generateSeedPhrase } from 'near-seed-phrase';
import {
    networkId,
    contractName,
    contractMethods,
    createGuestAccount,
    postJson,
    postSignedJson,
    getContract,
    GAS,
} from '../utils/near-utils';

const LOCAL_KEYS = '__LOCAL_KEYS';

const {
    KeyPair, Account, Contract,
    utils: { PublicKey, format: { formatNearAmount } }
} = nearAPI;

export const Guest = ({ near, update, localKeys, guestTokenBalance = '0', guestNEAR = '0', guestIsReal = false }) => {
    if (!near.connection) return null;

    const [username, setUsername] = useState('');

    useEffect(() => {
        if (!localKeys) loadKeys();
        fetch('http://localhost:3000').catch((e) => alert('Server Started?\n' + e.toString()));
    }, [localKeys, guestIsReal]);

    const loadKeys = async () => {
        const { seedPhrase, accountId, accessPublic, accessSecret } = get(LOCAL_KEYS, {});
        if (!accessSecret) return;
        const keyPair = KeyPair.fromString(accessSecret);
        console.log(keyPair)

        const guestAccount = createGuestAccount(near, KeyPair.fromString(accessSecret));
        const contract = getContract(guestAccount);

        let guestIsReal = false
        try {
            guestIsReal = await contract.get_guest({ public_key: accessPublic })
        } catch (e) {
            console.warn(e)
        }

        const storageBalance = await contract.storage_balance_of({ account_id: accountId });
        console.log('guest storage:', storageBalance);
        const guestTokenBalance = await contract.ft_balance_of({ account_id: accountId });
        const guest = await new Account(near.connection, accountId);
        
        // do updates
        await update('localKeys', { seedPhrase, accountId, accessPublic, accessSecret });
        try {
            update('guestNEAR', (await guest.state()).amount);
        } catch (e) {
            update('guestNEAR', '0');
            console.warn(e)
        }
        update('guestIsReal', guestIsReal)
        update('guestTokenBalance', guestTokenBalance);
    };

    const handleAddGuest = async () => {
        if (!username.length) {
            alert('please enter a username')
            return
        }
        update('loading', true);
        const account_id = username + '.' + contractName
        const { secretKey, publicKey } = generateSeedPhrase();
        /// WARNING THIS ENDPOINT NOT PROTECTED
        let result
        try {
            result = await postJson({
                url: 'http://localhost:3000/add-guest',
                data: {
                    account_id,
                    public_key: publicKey
                }
            });
        } catch (e) {
            if (/key is already added/.test(e.error)) {
                alert(account_id + ' is already added')
                update('loading', false);
                return
            }
        }
        if (result.addKey && result.add_guest === '') {
            const keys = {
                accountId: account_id,
                accessPublic: publicKey,
                accessSecret: secretKey
            };
            update('localKeys', keys);
            set(LOCAL_KEYS, keys);
        } else {
            alert('Something happened. Try "Get New App Key" again!');
        }
        loadKeys();
        update('loading', false);
    };

    const handleUpgrade = async () => {

        const { seedPhrase, secretKey, publicKey } = generateSeedPhrase();

        /// update account and contract for bob (bob now pays gas)
        const keyPair = KeyPair.fromString(secretKey);
        const public_key = publicKey.toString();
        const accountId = localKeys.accountId

        const guestAccount = createGuestAccount(near, KeyPair.fromString(localKeys.accessSecret));
        const contract = getContract(guestAccount);
        update('loading', true);
        try {
            await contract.upgrade_guest({ public_key }, GAS);
        } catch (e) {
            console.warn(e);
        }
        near.connection.signer.keyStore.setKey(networkId, accountId, keyPair);
        localKeys.seedPhrase = seedPhrase
        set(LOCAL_KEYS, localKeys)
        update('localKeys', localKeys);
        loadKeys();
        update('loading', false);
    };

    const handleRemove = async () => {
        update('loading', true);
        del(LOCAL_KEYS, localKeys)
        await update('', {
            localKeys: { accountId: null, accessSecret: null },
            guestNEAR: '0',
            guestTokenBalance: '0',
            guestIsReal: false,
        })
        await loadKeys();
        update('loading', false);
    }

    return <>
        {
            localKeys && localKeys.accountId && guestIsReal
                ?
                <>
                    <h3>Your Guest Account</h3>
                    <p>Account ID: {localKeys.accountId}</p>
                    <>
                        <h3>Start Another Guest Account</h3>
                        <p>(Optional) write down your seed phrase before you remove this guest account.</p>
                        <button onClick={() => handleRemove()}>Remove Guest Account</button>
                    </>
                </>
                :
                <>
                    <h3>Create Guest Account</h3>
                    <p>Creates a key pair to interact with the app. Normally you would set up your wallet and add an access key for the app.</p>
                    <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
                    <br />
                    <button onClick={() => handleAddGuest()}>Get New Account</button>
                </>
        }

        {
            guestTokenBalance !== '0' &&
            <>
                <p>Token Balance: {formatNearAmount(guestTokenBalance, 2)}</p>
                <p>Alright, your guest account, {localKeys.accountId} has wNEAR (wrapped NEAR tokens). Click below to "unwrap them" which will put NEAR into your guest account.</p>
                <button onClick={() => handleUpgrade()}>Sell wNEAR and Create My Account</button>

            </>
        }

        {   guestNEAR !== '0' &&
            <>
                <h2>CONGRATULATIONS</h2>
                <p>You Have NEAR!</p>
                <p><a href="https://explorer.testnet.near.org/accounts/test221111.dev-1614116050290-8679933" target="_blank">{localKeys.accountId}</a></p>
                <p>NEAR Balance: {formatNearAmount(guestNEAR, 2)}</p>
                <h3>
                    Wallet Login
                </h3>
                <p>
                    Sign into your NEAR account using your Seed Phrase here: <a target="_blank" href="https://wallet.testnet.near.org/recover-seed-phrase">https://wallet.testnet.near.org/recover-seed-phrase</a>.
                </p>
                <p>
                    Seed Phrase (shown here only for convenience):<br />
                    <input defaultValue={localKeys.seedPhrase} />
                </p>
                <p>
                    Guess what? You have NEAR and you got it by receiving wrapped NEAR tokens to an address that had NO NEAR (native NEAR tokens) to begin with!
                </p>
                <button onClick={() => handleRemove()}>Ok I'm Good Remove the Guest Account</button>
            </>
        }
    </>;
};

