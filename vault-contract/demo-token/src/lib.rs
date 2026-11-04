//! tROBIN: a testnet stand-in for $ROBIN so anyone can try the ROBIN Vault.
//! Standard NEP-141 token plus a faucet that tops any account up to 1,000 tROBIN.
use near_contract_standards::fungible_token::events::FtMint;
use near_contract_standards::fungible_token::metadata::{FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC};
use near_contract_standards::fungible_token::{FungibleToken, FungibleTokenCore, FungibleTokenResolver};
use near_contract_standards::storage_management::{StorageBalance, StorageBalanceBounds, StorageManagement};
use near_sdk::collections::LazyOption;
use near_sdk::json_types::U128;
use near_sdk::{env, log, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, PromiseOrValue};

const ONE: u128 = 1_000_000_000_000_000_000; // 18 decimals
const DRIP: u128 = 250 * ONE;
const CAP: u128 = 1000 * ONE;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract { token: FungibleToken, metadata: LazyOption<FungibleTokenMetadata> }

#[derive(BorshStorageKey)]
#[near]
enum StorageKey { FungibleToken, Metadata }

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        let metadata = FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(), name: "ROBIN (testnet demo)".to_string(), symbol: "tROBIN".to_string(),
            icon: None, reference: None, reference_hash: None, decimals: 18 };
        Self { token: FungibleToken::new(StorageKey::FungibleToken), metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)) }
    }
    /// Free demo tokens: 250 tROBIN per call, up to 1,000 per account. Registers the account if needed.
    pub fn faucet(&mut self) -> U128 {
        let a = env::predecessor_account_id();
        if !self.token.accounts.contains_key(&a) { self.token.internal_register_account(&a); }
        let bal = self.token.internal_unwrap_balance_of(&a);
        require!(bal < CAP, "you already have 1,000 tROBIN");
        let amt = core::cmp::min(DRIP, CAP - bal);
        self.token.internal_deposit(&a, amt);
        FtMint { owner_id: &a, amount: U128(amt), memo: Some("faucet") }.emit();
        U128(amt)
    }
    /// Pays storage for an account from the contract balance (so the vault and the burn address can be registered for free).
    pub fn register(&mut self, account_id: AccountId) { if !self.token.accounts.contains_key(&account_id) { self.token.internal_register_account(&account_id); } }
}

#[near]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        if !self.token.accounts.contains_key(&receiver_id) { self.token.internal_register_account(&receiver_id); }
        self.token.ft_transfer(receiver_id, amount, memo)
    }
    #[payable]
    fn ft_transfer_call(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>, msg: String) -> PromiseOrValue<U128> {
        if !self.token.accounts.contains_key(&receiver_id) { self.token.internal_register_account(&receiver_id); }
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }
    fn ft_total_supply(&self) -> U128 { self.token.ft_total_supply() }
    fn ft_balance_of(&self, account_id: AccountId) -> U128 { self.token.ft_balance_of(account_id) }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, amount: U128) -> U128 {
        let (used, burned) = self.token.internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        if burned > 0 { log!("{} burned", burned); }
        used.into()
    }
}

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>) -> StorageBalance { self.token.storage_deposit(account_id, registration_only) }
    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance { self.token.storage_withdraw(amount) }
    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool { self.token.internal_storage_unregister(force).is_some() }
    fn storage_balance_bounds(&self) -> StorageBalanceBounds { self.token.storage_balance_bounds() }
    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> { self.token.storage_balance_of(account_id) }
}

#[near]
impl FungibleTokenMetadataProvider for Contract { fn ft_metadata(&self) -> FungibleTokenMetadata { self.metadata.get().unwrap() } }
