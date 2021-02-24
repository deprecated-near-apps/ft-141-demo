import React, { useContext, useEffect } from 'react';

import { appStore, onAppMount } from './state/app';

import { Wallet } from './components/Wallet';
import { Contract } from './components/Contract';
import { Guest } from './components/Guest';
import { Proposals } from './components/Proposals';
import { MakeProposal } from './components/MakeProposal';
import NearLogo from 'url:./img/near_icon.svg';

import './App.scss';

const App = () => {
	const { state, dispatch, update } = useContext(appStore);

	const { 
        loading, tabIndex,
        near, wallet, account,
        localKeys, tokenBalance,
        guestTokenBalance, guestNEAR, guestIsReal
    } = state;

	const onMount = () => {
		dispatch(onAppMount());
	};
	useEffect(onMount, []);

	if (loading) {
		return <div className="loading">
			<img src={NearLogo} />
		</div>;
	}

	return (
		<div className="root">

            <div className="tab-controls">
                {
                    ['Proposals', 'Guest', 'Wallet'].map((str, i) => 
                        <div key={i}
                            className={tabIndex === i ? 'active' : ''}
                            onClick={() => update('tabIndex', i)}
                        >{str}</div>
                    )
                }
            </div>

            <div className={['tab', tabIndex === 0 ? 'active' : ''].join(' ')}>

                <Proposals {...{ near, update, account, localKeys }} />

            </div>
            <div className={['tab', tabIndex === 1 ? 'active' : ''].join(' ')}>

                <MakeProposal {...{ near, update, localKeys, guestIsReal }} />
                <Guest {...{ near, update, localKeys, guestTokenBalance, guestNEAR, guestIsReal }} />

            </div>
            <div className={['tab', tabIndex === 2 ? 'active' : ''].join(' ')}>
                
                <Contract {...{ near, update, localKeys, wallet, account, tokenBalance }} />
                <h2>Sign In with NEAR Wallet</h2>
                <p>Sign in with a wallet that already has NEAR tokens, and you will be presented with an option to purchase tokens you can then fund proposals with.</p>
                <Wallet {...{ wallet, account }} />

            </div>
			
		</div>
	);
};

export default App;
