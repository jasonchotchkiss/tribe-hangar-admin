// @ts-nocheck
import { useSmartObject, getDatahubGameInfo, getOwnedObjectsByType, getObjectWithJson } from "@evefrontier/dapp-kit";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { useState, useEffect } from "react";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { blake2b } from "@noble/hashes/blake2b";
import { ItemSearch } from "./ItemSearch";
import { ItemIcon } from "./ItemIcon";

const WORLD_PACKAGE_ID = import.meta.env.VITE_EVE_WORLD_PACKAGE_ID;
const CORP_HANGAR_PACKAGE_ID = import.meta.env.VITE_CORP_HANGAR_PACKAGE_ID;
const CORP_CONFIG_ID = import.meta.env.VITE_CORP_CONFIG_ID;

const client = new SuiJsonRpcClient({
    url: "https://fullnode.testnet.sui.io:443",
    network: "testnet",
});

type VaultItem = {
    type_id: string;
    name: string;
    quantity: number;
    iconUrl?: string;
};

type MemberStatus = {
    isMember: boolean;
    checked: boolean;
};

function computeOpenInventoryKey(storageUnitId: string): string {
    const idHex = storageUnitId.replace("0x", "");
    const idBytes = new Uint8Array(idHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    const openInventoryBytes = new TextEncoder().encode("open_inventory");
    const combined = new Uint8Array(idBytes.length + openInventoryBytes.length);
    combined.set(idBytes);
    combined.set(openInventoryBytes, idBytes.length);
    const hash = blake2b(combined, { dkLen: 32 });
    return "0x" + Array.from(hash).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function resolveCharacterInfo(walletAddress: string): Promise<{ characterId: string, ownerCapId: string } | null> {
    try {
        const profileType = `${WORLD_PACKAGE_ID}::character::PlayerProfile`;
        const ownedResult = await getOwnedObjectsByType(walletAddress, profileType);
        const nodes = ownedResult?.data?.address?.objects?.nodes;
        if (!nodes || nodes.length === 0) return null;
        const profileResult = await getObjectWithJson(nodes[0].address);
        const profileJson = profileResult?.data?.object?.asMoveObject?.contents?.json as any;
        if (!profileJson?.character_id) return null;
        const charResult = await client.getObject({
            id: profileJson.character_id,
            options: { showContent: true },
        });
        const charFields = (charResult.data?.content as any)?.fields;
        if (!charFields?.owner_cap_id) return null;
        return { characterId: profileJson.character_id, ownerCapId: charFields.owner_cap_id };
    } catch (err) {
        console.warn("Could not resolve character info for", walletAddress, err);
        return null;
    }
}

export function CorpVault() {
    const { assembly, loading, refetch } = useSmartObject();
    const { signAndExecuteTransaction } = useDAppKit();
    const account = useCurrentAccount();
    const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
    const [memberStatus, setMemberStatus] = useState<MemberStatus>({ isMember: false, checked: false });
    const [txStatus, setTxStatus] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState(false);

    const [contributeTypeId, setContributeTypeId] = useState("");
    const [contributeItemName, setContributeItemName] = useState("");
    const [contributeQuantity, setContributeQuantity] = useState("1");

    const [withdrawTypeId, setWithdrawTypeId] = useState("");
    const [withdrawQuantity, setWithdrawQuantity] = useState("1");

    useEffect(() => {
        if (account?.address) checkMembership(account.address);
    }, [account?.address]);

    useEffect(() => {
        if (assembly) loadVaultInventory();
    }, [assembly]);

    async function checkMembership(address: string) {
        try {
            const object = await client.getObject({
                id: CORP_CONFIG_ID,
                options: { showContent: true },
            });
            if (object.data?.content?.dataType === "moveObject") {
                const fields = object.data.content.fields as any;
                setMemberStatus({ isMember: fields.members.includes(address), checked: true });
            }
        } catch (err) {
            console.error("Failed to check membership:", err);
        }
    }

    async function loadVaultInventory() {
        if (!assembly) return;
        try {
            const openKey = computeOpenInventoryKey(assembly.id);
            const dynamicFields = assembly._raw?.dynamicFields?.nodes;
            if (!dynamicFields) return;

            const openInventoryField = dynamicFields.find((field: any) => {
                const fieldName = (field.name?.json || "").toLowerCase().replace("0x", "");
                return fieldName === openKey.toLowerCase().replace("0x", "");
            });

            if (openInventoryField) {
                const contents = openInventoryField.contents?.json?.value?.items?.contents || [];
                const items = await Promise.all(contents.map(async (entry: any) => {
                    const typeId = entry.key;
                    const quantity = entry.value?.quantity ?? 0;
                    try {
                        const info = await getDatahubGameInfo(parseInt(typeId));
                        return { type_id: typeId, name: info.name, quantity, iconUrl: info.iconUrl };
                    } catch {
                        return { type_id: typeId, name: `Type ${typeId}`, quantity };
                    }
                }));
                setVaultItems(items);
            } else {
                setVaultItems([]);
            }
        } catch (err) {
            console.error("Failed to load vault inventory:", err);
        }
    }

    function getContributeErrorMessage(err: any, itemName: string, storageName: string): string {
        const msg = err?.message || "";
        if (
            msg.includes("EInventoryInsufficientQuantity") ||
            msg.includes("Insufficient quantity") ||
            msg.includes("EItemDoesNotExist") ||
            msg.includes("Item not found")
        ) {
            return `⚠️ "${itemName}" not found in your personal storage slot. Please deposit it into "${storageName}" in game first, then try again.`;
        }
        if (msg.includes("ENotCorpMember")) return `❌ You are not a member of this corp.`;
        return `❌ Error: ${msg}`;
    }

    function getWithdrawErrorMessage(err: any, storageName: string): string {
        const msg = err?.message || "";
        if (
            msg.includes("EInventoryInsufficientQuantity") ||
            msg.includes("Insufficient quantity") ||
            msg.includes("EItemDoesNotExist") ||
            msg.includes("Item not found") ||
            msg.includes("EOpenStorageNotInitialized")
        ) {
            return `⚠️ Item not found in the corp vault. Check the vault contents and try again.`;
        }
        if (msg.includes("ENotCorpMember")) return `❌ You are not a member of this corp.`;
        return `❌ Error: ${msg}`;
    }

    async function handleContribute() {
        if (!account || !assembly || !contributeTypeId) return;
        setIsProcessing(true);
        setTxStatus("Building contribute transaction...");
        const storageName = assembly.typeDetails?.name || "Corp Storage";
        try {
            const charInfo = await resolveCharacterInfo(account.address);
            if (!charInfo) throw new Error("Could not find character for connected wallet. Make sure you are logged in with your in-game wallet.");
            const { characterId, ownerCapId: storageUnitOwnerCapId } = charInfo;
            const storageUnitId = assembly.id;
            const tx = new Transaction();
            tx.setSender(account.address);
            const [ownerCap, receipt] = tx.moveCall({
                target: `${WORLD_PACKAGE_ID}::character::borrow_owner_cap`,
                typeArguments: [`${WORLD_PACKAGE_ID}::storage_unit::StorageUnit`],
                arguments: [tx.object(characterId), tx.object(storageUnitOwnerCapId)],
            });
            tx.moveCall({
                target: `${CORP_HANGAR_PACKAGE_ID}::corp_hangar::contribute`,
                typeArguments: [`${WORLD_PACKAGE_ID}::storage_unit::StorageUnit`],
                arguments: [
                    tx.object(CORP_CONFIG_ID),
                    tx.object(storageUnitId),
                    tx.object(characterId),
                    ownerCap,
                    tx.pure.u64(parseInt(contributeTypeId)),
                    tx.pure.u32(parseInt(contributeQuantity)),
                ],
            });
            tx.moveCall({
                target: `${WORLD_PACKAGE_ID}::character::return_owner_cap`,
                typeArguments: [`${WORLD_PACKAGE_ID}::storage_unit::StorageUnit`],
                arguments: [tx.object(characterId), ownerCap, receipt],
            });
            setTxStatus("Waiting for EVE Vault approval...");
            await signAndExecuteTransaction({ transaction: tx });
            setTxStatus(`✅ ${contributeItemName} contributed to corp vault!`);
            setContributeTypeId("");
            setContributeItemName("");
            setContributeQuantity("1");
            setTimeout(async () => { await refetch(); }, 3000);
        } catch (err: any) {
            setTxStatus(getContributeErrorMessage(err, contributeItemName || contributeTypeId, storageName));
        } finally {
            setIsProcessing(false);
        }
    }

    async function handleWithdraw() {
        if (!account || !assembly || !withdrawTypeId) return;
        setIsProcessing(true);
        setTxStatus("Building withdrawal transaction...");
        const storageName = assembly.typeDetails?.name || "Corp Storage";
        try {
            const charInfo = await resolveCharacterInfo(account.address);
            if (!charInfo) throw new Error("Could not find character for connected wallet. Make sure you are logged in with your in-game wallet.");
            const { characterId } = charInfo;
            const storageUnitId = assembly.id;
            const tx = new Transaction();
            tx.setSender(account.address);
            const [ownerCap, receipt] = tx.moveCall({
                target: `${WORLD_PACKAGE_ID}::character::borrow_owner_cap`,
                typeArguments: [`${WORLD_PACKAGE_ID}::storage_unit::StorageUnit`],
                arguments: [tx.object(characterId), tx.object(charInfo.ownerCapId)],
            });
            const item = tx.moveCall({
                target: `${CORP_HANGAR_PACKAGE_ID}::corp_hangar::withdraw`,
                arguments: [
                    tx.object(CORP_CONFIG_ID),
                    tx.object(storageUnitId),
                    tx.object(characterId),
                    tx.pure.u64(parseInt(withdrawTypeId)),
                    tx.pure.u32(parseInt(withdrawQuantity)),
                ],
            });
            tx.moveCall({
                target: `${WORLD_PACKAGE_ID}::storage_unit::deposit_by_owner`,
                typeArguments: [`${WORLD_PACKAGE_ID}::storage_unit::StorageUnit`],
                arguments: [tx.object(storageUnitId), item, tx.object(characterId), ownerCap],
            });
            tx.moveCall({
                target: `${WORLD_PACKAGE_ID}::character::return_owner_cap`,
                typeArguments: [`${WORLD_PACKAGE_ID}::storage_unit::StorageUnit`],
                arguments: [tx.object(characterId), ownerCap, receipt],
            });
            setTxStatus("Waiting for EVE Vault approval...");
            await signAndExecuteTransaction({ transaction: tx });
            setTxStatus(`✅ Withdrawn from corp vault!`);
            setWithdrawTypeId("");
            setWithdrawQuantity("1");
            setTimeout(async () => { await refetch(); }, 3000);
        } catch (err: any) {
            setTxStatus(getWithdrawErrorMessage(err, storageName));
        } finally {
            setIsProcessing(false);
        }
    }

    if (loading || !assembly || !memberStatus.checked) return null;

    const inputStyle = {
        padding: "6px", backgroundColor: "#111", color: "#fff",
        border: "1px solid #444", fontFamily: "monospace", fontSize: "11px",
    };
    const btnStyle = (disabled: boolean) => ({
        padding: "6px 12px", backgroundColor: disabled ? "#444" : "#ff6600",
        color: "white", border: "none", cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "monospace", fontSize: "11px",
    });

    const storageName = assembly.typeDetails?.name || "Corp Storage";

    return (
        <div style={{ marginTop: "16px", padding: "16px", border: "1px solid #333", fontFamily: "monospace" }}>
            <h3 style={{ color: "#ff6600", marginBottom: "12px" }}>
                🏦 CORP VAULT
                <button onClick={() => { refetch(); loadVaultInventory(); }} style={{
                    marginLeft: "12px", padding: "2px 8px", backgroundColor: "#222",
                    color: "#888", border: "1px solid #444", cursor: "pointer",
                    fontFamily: "monospace", fontSize: "10px",
                }}>↻ refresh</button>
            </h3>

            {!memberStatus.isMember ? (
                <p style={{ color: "#888" }}>You are not a member of this corp.</p>
            ) : (
                <>
                    <p style={{ color: "#666", fontSize: "12px", marginBottom: "12px" }}>
                        Shared corp inventory — only accessible through this dApp
                    </p>

                    <div style={{ marginBottom: "16px" }}>
                        <h4 style={{ color: "#ff6600" }}>CONTENTS</h4>
                        {vaultItems.length === 0 ? (
                            <p style={{ color: "#888", fontSize: "12px" }}>Vault is empty</p>
                        ) : (
                            vaultItems.map((item, i) => (
                                <div key={i} style={{
                                    display: "flex", justifyContent: "space-between",
                                    alignItems: "center", padding: "6px 0",
                                    borderBottom: "1px solid #222",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        {true && (
                                            <ItemIcon iconUrl={item.iconUrl} name={item.name} size={24} />
                                        )}
                                        <div>
                                            <span style={{ color: "#fff", fontSize: "13px" }}>{item.name}</span>
                                            <span style={{ color: "#555", fontSize: "10px", marginLeft: "8px" }}>
                                                ID: {item.type_id}
                                            </span>
                                        </div>
                                    </div>
                                    <span style={{ color: "#ff6600", fontSize: "13px" }}>x{item.quantity}</span>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                        <h4 style={{ color: "#ff6600" }}>CONTRIBUTE TO VAULT</h4>
                        <p style={{ color: "#666", fontSize: "11px", marginBottom: "8px" }}>
                            Item must be deposited into <strong style={{ color: "#888" }}>{storageName}</strong> in game first
                        </p>
                        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                            <ItemSearch
                                placeholder="Search item name..."
                                onSelect={(typeId, name) => {
                                    setContributeTypeId(typeId);
                                    setContributeItemName(name);
                                }}
                            />
                            <input type="number" value={contributeQuantity}
                                onChange={(e) => setContributeQuantity(e.target.value)}
                                min="1" style={{ ...inputStyle, width: "60px" }} />
                            <button onClick={handleContribute}
                                disabled={isProcessing || !contributeTypeId}
                                style={btnStyle(isProcessing || !contributeTypeId)}>
                                CONTRIBUTE
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                        <h4 style={{ color: "#ff6600" }}>WITHDRAW FROM VAULT</h4>
                        <p style={{ color: "#666", fontSize: "11px", marginBottom: "8px" }}>
                            Items will be moved to your personal slot in <strong style={{ color: "#888" }}>{storageName}</strong>
                        </p>
                        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                            <ItemSearch
                                placeholder="Search item name..."
                                onSelect={(typeId) => setWithdrawTypeId(typeId)}
                            />
                            <input type="number" value={withdrawQuantity}
                                onChange={(e) => setWithdrawQuantity(e.target.value)}
                                min="1" style={{ ...inputStyle, width: "60px" }} />
                            <button onClick={handleWithdraw}
                                disabled={isProcessing || !withdrawTypeId}
                                style={btnStyle(isProcessing || !withdrawTypeId)}>
                                WITHDRAW
                            </button>
                        </div>
                    </div>

                    {txStatus && (
                        <div style={{
                            padding: "8px", backgroundColor: "#111", fontSize: "11px",
                            color: txStatus.startsWith("✅") ? "#00ff00" :
                                txStatus.startsWith("⚠️") ? "#ffaa00" :
                                    txStatus.startsWith("❌") ? "#ff4444" : "#ffffff",
                            lineHeight: "1.5",
                        }}>
                            {txStatus}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
