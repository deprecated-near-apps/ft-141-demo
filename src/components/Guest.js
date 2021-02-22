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

export const Guest = ({ near, update, localKeys, guestTokenBalance = '0', guestNEAR = '0' }) => {
    if (!near.connection) return null;

    const [username, setUsername] = useState('');

    useEffect(() => {
        if (!localKeys) loadKeys();
        fetch('http://localhost:3000').catch((e) => alert('Server Started?\n' + e.toString()));
    }, []);

    const loadKeys = async () => {
        const { seedPhrase, accountId, accessPublic, accessSecret } = get(LOCAL_KEYS, {});
        if (!accessSecret) return;
        const keyPair = KeyPair.fromString(accessSecret);
        console.log(keyPair)
        // const keyValid = await checkAccessKey(keyPair);
        // if (!keyValid) {
        // 	del(LOCAL_KEYS);
        // 	return;
        // }
        update('localKeys', { seedPhrase, accountId, accessPublic, accessSecret });
        const guestAccount = createGuestAccount(near, KeyPair.fromString(accessSecret));
        const contract = getContract(guestAccount);
        const storageBalance = await contract.storage_balance_of({ account_id: accountId });
        console.log('guest storage:', storageBalance);
        const guestTokenBalance = await contract.ft_balance_of({ account_id: accountId });
        update('guestTokenBalance', guestTokenBalance);
        const guest = await new Account(near.connection, accountId);
        try {
            update('guestNEAR', (await guest.state()).amount);
        } catch(e) {
            console.warn(e)
        }
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

    const handleRemove = async() => {
        update('loading', true);
        del(LOCAL_KEYS, localKeys)
        update('localKeys', {});
        loadKeys();
        update('loading', false);
    }


    return <>

        <h2>4. Transfer to a Guest Account (optional)</h2>

        {
            localKeys && localKeys.accountId
                ?
                <>
                    <h3>Your Guest Account</h3>
                    <p>Account ID: {localKeys.accountId}</p>
                    {guestTokenBalance === '0' && <h4>Transfer tokens to this account from your wallet above!</h4>}
                </>
                :
                <>
                    <h3>Set Up a Guest Account</h3>
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

        {
            guestNEAR !== '0' && 
            <>
                <h2>CONGRATULATIONS YOU HAVE NEAR!</h2>
                <p>NEAR Balance: {formatNearAmount(guestNEAR, 2)}</p>
                <h2>
                    5. Last Step - Wallet Login
		        </h2>
                <p>
                Sign into your guest account using your Seed Phrase here: <a target="_blank" href="https://wallet.testnet.near.org/recover-seed-phrase">https://wallet.testnet.near.org/recover-seed-phrase</a>.
                </p>
                <p>
                    Seed Phrase (shown here only for convenience):<br />
                    <input value={ localKeys.seedPhrase } />
                </p>
                <p>
                    Guess what? You have NEAR and you got it by receiving wrapped NEAR tokens to an address that had NO NEAR (native NEAR tokens) to begin with!
                </p>

                <h2>
                    6. (Optional) Start Another Guest Account
                    <p>Make sure you write down your seed phrase if you want to use the current account again.</p>
                    <button onClick={() => handleRemove()}>Remove Guest Account</button>
		        </h2>
            </>
        }

        
    </>;
};

