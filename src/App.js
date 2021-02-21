import React, { useContext, useEffect } from 'react';

import { appStore, onAppMount } from './state/app';

import { Wallet } from './components/Wallet';
import { Contract } from './components/Contract';
import { Guest } from './components/Guest';

import './App.css';

const App = () => {
    const { state, dispatch, update } = useContext(appStore);

    const { near, wallet, account, localKeys, loading, tokenBalance, guestTokenBalance } = state;

    const onMount = () => {
        dispatch(onAppMount());
    };
    useEffect(onMount, []);

    if (loading) {
        return <div className="root">
            <h3>Workin on it!</h3>
        </div>;
    }

    return (
        <div className="root">
            <h2>1. Sign In with NEAR Wallet</h2>
            <p>Sign in with a wallet that already has NEAR tokens, and you will be presented above with an option to purchase the message created by the guest account.</p>
            <Wallet {...{ wallet, account }} />
            {
                account && <>
                    <Contract {...{ near, update, localKeys, wallet, account, tokenBalance }} />
                    {
                        tokenBalance !== '0' &&
                        <Guest {...{ near, update, localKeys, guestTokenBalance }} />
                    }
                </>
            }
        </div>
    );
};

export default App;
