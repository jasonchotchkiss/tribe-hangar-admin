/// Corp Hangar - A multi-corp Storage Unit extension.
///
/// Any corp can deploy their own hangar by calling create_corp().
/// Each corp gets their own CorpConfig and AdminCap.
/// Only corp members can deposit or withdraw items.
/// Uses open_inventory which is ONLY accessible through this extension.
#[allow(lint(self_transfer))]
module corp_hangar::corp_hangar;

use std::string::String;
use world::{
    character::Character,
    storage_unit::{Self, StorageUnit},
    inventory::Item,
    access::OwnerCap
};

// === Errors ===
#[error(code = 0)]
const ENotCorpMember: vector<u8> = b"Character is not a corp member";
#[error(code = 1)]
const EWrongCorp: vector<u8> = b"AdminCap does not match this corp";

// === Auth witness ===
public struct CorpAuth has drop {}

// === Structs ===
public struct CorpConfig has key {
    id: UID,
    name: String,
    denial_message: String,
    members: vector<address>,
}

public struct AdminCap has key, store {
    id: UID,
    corp_id: ID,
}

// === Corp Creation ===
public fun create_corp(
    name: String,
    denial_message: String,
    ctx: &mut TxContext,
) {
    let config = CorpConfig {
        id: object::new(ctx),
        name,
        denial_message,
        members: vector::empty<address>(),
    };

    let admin_cap = AdminCap {
        id: object::new(ctx),
        corp_id: object::id(&config),
    };

    transfer::transfer(admin_cap, ctx.sender());
    transfer::share_object(config);
}

// === Admin Functions ===
fun assert_admin(config: &CorpConfig, admin_cap: &AdminCap) {
    assert!(admin_cap.corp_id == object::id(config), EWrongCorp);
}

public fun add_member(
    config: &mut CorpConfig,
    admin_cap: &AdminCap,
    member: address,
) {
    assert_admin(config, admin_cap);
    if (!vector::contains(&config.members, &member)) {
        vector::push_back(&mut config.members, member);
    }
}

public fun remove_member(
    config: &mut CorpConfig,
    admin_cap: &AdminCap,
    member: address,
) {
    assert_admin(config, admin_cap);
    let (found, index) = vector::index_of(&config.members, &member);
    if (found) {
        vector::remove(&mut config.members, index);
    }
}

public fun update_denial_message(
    config: &mut CorpConfig,
    admin_cap: &AdminCap,
    new_message: String,
) {
    assert_admin(config, admin_cap);
    config.denial_message = new_message;
}

public fun update_name(
    config: &mut CorpConfig,
    admin_cap: &AdminCap,
    new_name: String,
) {
    assert_admin(config, admin_cap);
    config.name = new_name;
}

public fun authorize_hangar(
    storage_unit: &mut StorageUnit,
    owner_cap: &OwnerCap<StorageUnit>,
) {
    storage_unit::authorize_extension<CorpAuth>(storage_unit, owner_cap);
}

// === Corp Member Functions ===

/// Deposit an item directly into the corp vault (open inventory).
/// Item must already be on-chain in the storage unit.
public fun deposit(
    config: &CorpConfig,
    storage_unit: &mut StorageUnit,
    character: &Character,
    item: Item,
    ctx: &mut TxContext,
) {
    assert!(
        vector::contains(&config.members, &ctx.sender()),
        ENotCorpMember
    );
    storage_unit::deposit_to_open_inventory<CorpAuth>(
        storage_unit,
        character,
        item,
        CorpAuth {},
        ctx,
    );
}

/// Move items from your owner slot into the corp vault in one transaction.
/// This is the primary deposit method — takes items from your personal storage
/// and contributes them to the shared corp pool.
public fun contribute<T: key>(
    config: &CorpConfig,
    storage_unit: &mut StorageUnit,
    character: &Character,
    owner_cap: &OwnerCap<T>,
    type_id: u64,
    quantity: u32,
    ctx: &mut TxContext,
) {
    assert!(
        vector::contains(&config.members, &ctx.sender()),
        ENotCorpMember
    );
    // Withdraw from member's owner slot
    let item = storage_unit::withdraw_by_owner<T>(
        storage_unit,
        character,
        owner_cap,
        type_id,
        quantity,
        ctx,
    );
    // Deposit into shared corp vault
    storage_unit::deposit_to_open_inventory<CorpAuth>(
        storage_unit,
        character,
        item,
        CorpAuth {},
        ctx,
    );
}

/// Withdraw from the corp vault into member's owned inventory.
public fun withdraw(
    config: &CorpConfig,
    storage_unit: &mut StorageUnit,
    character: &Character,
    type_id: u64,
    quantity: u32,
    ctx: &mut TxContext,
): Item {
    assert!(
        vector::contains(&config.members, &ctx.sender()),
        ENotCorpMember
    );
    storage_unit::withdraw_from_open_inventory<CorpAuth>(
        storage_unit,
        character,
        CorpAuth {},
        type_id,
        quantity,
        ctx,
    )
}

// === View Functions ===
public fun is_member(config: &CorpConfig, addr: address): bool {
    vector::contains(&config.members, &addr)
}

public fun members(config: &CorpConfig): &vector<address> {
    &config.members
}

public fun name(config: &CorpConfig): &String {
    &config.name
}

public fun denial_message(config: &CorpConfig): &String {
    &config.denial_message
}
