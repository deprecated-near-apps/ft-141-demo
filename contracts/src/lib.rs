
#![feature(str_split_once)]

/**
* wNear NEP-141 Token contract
*
* The aim of the contract is to enable the wrapping of the native NEAR token into a NEP-141 compatible token.
* It supports methods `near_deposit` and `near_withdraw` that wraps and unwraps NEAR tokens.
* They are effectively mint and burn underlying wNEAR tokens.
*
* lib.rs is the main entry point.
* fungible_token_core.rs implements NEP-146 standard
* storage_manager.rs implements NEP-145 standard for allocating storage per account
* fungible_token_metadata.rs implements NEP-148 standard for providing token-specific metadata.
* w_near.rs contains interfaces for depositing and withdrawing
* internal.rs contains internal methods for fungible token.
*/

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::json_types::{ValidAccountId, U128, Base58PublicKey};
use near_sdk::{env, near_bindgen, PublicKey, AccountId, Balance, Promise, StorageUsage};

pub use crate::fungible_token_core::*;
pub use crate::fungible_token_metadata::*;
use crate::internal::*;
pub use crate::storage_manager::*;
pub use crate::w_near::*;

mod fungible_token_core;
mod fungible_token_metadata;
mod internal;
mod storage_manager;
mod w_near;

#[global_allocator]
static ALLOC: near_sdk::wee_alloc::WeeAlloc<'_> = near_sdk::wee_alloc::WeeAlloc::INIT;

const SPONSOR_FEE: u128 = 0;

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct Contract {
    /// Owner AccountID
    pub owner_id: AccountId,
    
    /// PublicKey -> AccountId.
    pub guests: LookupMap<PublicKey, AccountId>,
    
    /// AccountId -> String.
    pub messages: LookupMap<AccountId, String>,

    /// AccountID -> Account balance.
    pub accounts: LookupMap<AccountId, Balance>,

    /// Total supply of the all token.
    pub total_supply: Balance,

    /// The storage size in bytes for one account.
    pub account_storage_usage: StorageUsage,
}

impl Default for Contract {
    fn default() -> Self {
        env::panic(b"Contract is not initialized");
    }
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {
        assert!(!env::state_exists(), "Already initialized");
        let mut this = Self {
            owner_id: env::predecessor_account_id(),
            guests: LookupMap::new(b"ga".to_vec()),
            accounts: LookupMap::new(b"aa".to_vec()),
            total_supply: 0,
            account_storage_usage: 0,
        };
        let initial_storage_usage = env::storage_usage();
        let tmp_account_id = unsafe { String::from_utf8_unchecked(vec![b'a'; 64]) };
        this.accounts.insert(&tmp_account_id, &0u128);
        this.account_storage_usage = env::storage_usage() - initial_storage_usage;
        this.accounts.remove(&tmp_account_id);
        this
    }

    pub fn get_predecessor(&mut self) -> AccountId {
        let predecessor = env::predecessor_account_id();
        let (first, last) = predecessor.split_once(".").unwrap();
        if first == "guests" && last == self.owner_id {
            self.guests.get(&env::signer_account_pk()).expect("not a guest")
        } else {
            predecessor
        }
    }

    /// add account_id to guests for get_predecessor and to storage to receive tokens
    pub fn add_guest(&mut self, account_id: AccountId, public_key: Base58PublicKey) {
        assert!(env::predecessor_account_id() == self.owner_id, "must be owner_id");
        if self.guests.insert(&public_key.into(), &account_id).is_some() {
            env::panic(b"guest account already added");
        }
        if self.accounts.insert(&account_id, &0).is_some() {
            env::panic(b"The account is already registered");
        }
    }

    pub fn upgrade_guest(&mut self, public_key: Base58PublicKey) -> Promise {
        let account_id = self.guests.get(&env::signer_account_pk()).expect("not a guest"); // SAME ACCOUNT_ID ✔️ 
        let amount = self.accounts.get(&account_id).expect("no balance");
        /// decrement wNEAR of guest
        self.internal_withdraw(&account_id, amount);
        self.total_supply -= amount;
        env::log(format!("Withdraw {} NEAR from {}", amount, account_id).as_bytes());
        /// create the guest account (for real) and transfer their wNEAR balance - SPONSOR FEE in NEAR to the new account
        Promise::new(account_id)
            .create_account()
            .add_full_access_key(public_key.into())
            .transfer(amount - SPONSOR_FEE)
            // .then(ext_self::on_account_created(
            //     ... github.com/near/near-linkdrop/ ...
            //     ... REMOVE GUEST MAPPING IN CALLBACK !!! ...
            // ))
    }
}
