
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
use near_sdk::{ext_contract, env, near_bindgen, PublicKey, AccountId, Balance, Promise, PromiseResult, StorageUsage};
use near_sdk::serde::Serialize;

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

const ON_CREATE_ACCOUNT_CALLBACK_GAS: u64 = 20_000_000_000_000;
/// 0.1 Fee to make account
const ACCESS_KEY_ALLOWANCE: u128 = 100_000_000_000_000_000_000_000;
const SPONSOR_FEE: u128 = 100_000_000_000_000_000_000_000;
const FUNDING_AMOUNT: u128 = 500_000_000_000_000_000_000_000;
const NO_DEPOSIT: Balance = 0;

#[derive(Serialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Proposal {
    text: String,
    amount: U128,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct Contract {
    /// Owner AccountID
    pub owner_id: AccountId,
    
    /// PublicKey -> AccountId.
    pub guests: LookupMap<PublicKey, AccountId>, //mally.dev-1614278832408-7883215
    
    /// AccountId -> String.
    pub proposals: LookupMap<AccountId, Proposal>, //mally.dev-1614278832408-7883215

    /// AccountID -> Account balance.
    pub accounts: LookupMap<AccountId, Balance>, //mally.dev-1614278832408-7883215

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
            proposals: LookupMap::new(b"ma".to_vec()),
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
    /// only the owner / server should be able to do this to avoid unwanted storage usage in creating new guest records
    pub fn add_guest(&mut self, account_id: AccountId, public_key: Base58PublicKey) {
        assert!(env::predecessor_account_id() == self.owner_id, "must be owner_id");
        if self.accounts.insert(&account_id, &0).is_some() {
            env::panic(b"The account is already registered");
        }
        if self.guests.insert(&public_key.into(), &account_id).is_some() {
            env::panic(b"guest account already added");
        }
    }

    pub fn upgrade_guest(&mut self,
        public_key: Base58PublicKey,
        access_key: Base58PublicKey,
        method_names: String
    ) -> Promise {
        let pk = env::signer_account_pk();
        let account_id = self.guests.get(&pk).expect("not a guest");
        let amount = self.accounts.get(&account_id).expect("no balance");
        let fees = SPONSOR_FEE + FUNDING_AMOUNT + u128::from(self.storage_minimum_balance());
        assert!(amount > fees, "not enough to upgrade and pay fees");
        self.internal_withdraw(&account_id, fees);
        self.total_supply -= fees;
        env::log(format!("Withdraw {} NEAR from {}", amount, account_id).as_bytes());
        // create the guest account
        // transfer FUNDING_AMOUNT in NEAR to the new account
        // remaining wNEAR still belongs to user
        Promise::new(account_id.clone())
            .create_account()
            .add_full_access_key(public_key.into())
            .add_access_key(
                access_key.into(),
                ACCESS_KEY_ALLOWANCE,
                env::current_account_id(),
                method_names.as_bytes().to_vec(),
            )
            .transfer(FUNDING_AMOUNT)
            .then(ext_self::on_account_created(
                account_id,
                pk,
                
                &env::current_account_id(),
                NO_DEPOSIT,
                ON_CREATE_ACCOUNT_CALLBACK_GAS,
            ))
    }

    /// proposals (makeshift impl)
    pub fn make_proposal(&mut self, text: String, amount: U128) {
        let account_id = self.get_predecessor();
        if self.proposals.insert(&account_id, &Proposal{
            text,
            amount,
        }).is_some() {
            env::panic(b"only one proposal at a time");
        }
    }

    #[payable]
    pub fn fund_proposal(&mut self, owner_id: ValidAccountId) {
        let proposal = self.proposals.remove(&owner_id.clone().into()).expect("no proposal");
        self.ft_transfer(owner_id, proposal.amount, Some("funding".to_string()));
    }

    pub fn fund_proposal_guest(&mut self, owner_id: ValidAccountId) {
        // should panic if "no guest" (signer is not a guest)
        self.guests.get(&env::signer_account_pk()).expect("no guest");
        let proposal = self.proposals.remove(&owner_id.clone().into()).expect("no proposal");
        self.ft_transfer_unsafe(owner_id, proposal.amount, Some("funding".to_string()));
    }

    pub fn remove_proposal(&mut self, owner_id: AccountId) {
        let account_id = self.get_predecessor();
        assert!(owner_id == account_id);
        self.proposals.remove(&owner_id).expect("no proposal");
    }

    /// after the account is created we'll delete all the guests activity, they will have to resign in
    pub fn on_account_created(&mut self, account_id: AccountId, public_key: PublicKey) -> bool {
        let creation_succeeded = is_promise_success();
        if creation_succeeded {
            self.guests.remove(&public_key);
            self.proposals.remove(&account_id);
        }
        creation_succeeded
    }

    /// View Methods

    pub fn get_proposal(&self, owner_id: AccountId) -> Proposal {
        self.proposals.get(&owner_id).expect("no proposal")
    }

    pub fn get_guest(&self, public_key: Base58PublicKey) -> AccountId {
        self.guests.get(&public_key.into()).expect("no guest")
    }
}

/// Callback for after upgrade_guest
#[ext_contract(ext_self)]
pub trait ExtContract {
    fn on_account_created(&mut self, account_id: AccountId, public_key: PublicKey) -> bool;
}

fn is_promise_success() -> bool {
    assert_eq!(
        env::promise_results_count(),
        1,
        "Contract expected a result on the callback"
    );
    match env::promise_result(0) {
        PromiseResult::Successful(_) => true,
        _ => false,
    }
}
