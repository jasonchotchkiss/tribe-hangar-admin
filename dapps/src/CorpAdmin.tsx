// @ts-nocheck
import { useState, useEffect } from "react";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { getOwnedObjectsByType, getObjectWithJson, abbreviateAddress } from "@evefrontier/dapp-kit";

const CORP_CONFIG_ID = import.meta.env.VITE_CORP_CONFIG_ID;
const WORLD_PACKAGE_ID = import.meta.env.VITE_EVE_WORLD_PACKAGE_ID;
const API_URL = import.meta.env.VITE_API_URL || "";

const client = new SuiJsonRpcClient({
    url: "https://fullnode.testnet.sui.io:443",
    network: "testnet",
});

type TribeData = {
    name: string;
    denial_message: string;
    members: string[];
};

type MemberInfo = {
    address: string;
    name: string;
};

async function resolveCharacterName(walletAddress: string): Promise<string> {
    try {
        const profileType = `${WORLD_PACKAGE_ID}::character::PlayerProfile`;
        const ownedResult = await getOwnedObjectsByType(walletAddress, profileType);
        const nodes = ownedResult?.data?.address?.objects?.nodes;

        if (!nodes || nodes.length === 0) {
            return "No Character (Dev Wallet)";
        }

        const profileAddress = nodes[0].address;
        const profileResult = await getObjectWithJson(profileAddress);
        const profileJson = profileResult?.data?.object?.asMoveObject?.contents?.json as any;

        if (!profileJson?.character_id) {
            return "No Character (Dev Wallet)";
        }

        const charResult = await getObjectWithJson(profileJson.character_id);
        const charJson = charResult?.data?.object?.asMoveObject?.contents?.json as any;

        if (charJson?.metadata?.name) {
            return charJson.metadata.name;
        }

        return "Unknown Pilot";
    } catch (err) {
        console.warn("Could not resolve name for", walletAddress, err);
        return "Unknown Pilot";
    }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callApi(endpoint: string, body: object): Promise<void> {
    const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || "API request failed");
    }
}

export function TribeAdmin() {
    const [tribeData, setTribeData] = useState<TribeData | null>(null);
    const [memberInfo, setMemberInfo] = useState<MemberInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [newMember, setNewMember] = useState("");
    const [newTribeName, setNewTribeName] = useState("");
    const [status, setStatus] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [transferAddress, setTransferAddress] = useState("");

    async function fetchCorpData() {
        try {
            const object = await client.getObject({
                id: CORP_CONFIG_ID,
                options: { showContent: true },
            });
            if (object.data?.content?.dataType === "moveObject") {
                const fields = object.data.content.fields as any;
                const data = {
                    name: fields.name,
                    denial_message: fields.denial_message,
                    members: fields.members,
                };
                setTribeData(data);

                const infos = await Promise.all(
                    fields.members.map(async (addr: string) => ({
                        address: addr,
                        name: await resolveCharacterName(addr),
                    }))
                );
                setMemberInfo(infos);
            }
        } catch (err) {
            console.error("Failed to fetch corp data:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchCorpData();
    }, []);

    async function handleAddMember() {
        if (!newMember.trim()) return;
        setIsProcessing(true);
        setStatus("Adding member...");
        try {
            await callApi("/add-member", { address: newMember.trim() });
            setStatus(`✅ Member added: ${newMember}`);
            setNewMember("");
            await delay(2000);
            await fetchCorpData();
        } catch (err: any) {
            setStatus(`❌ Error: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    }

    async function handleRemoveMember(member: string) {
        setIsProcessing(true);
        setStatus(`Removing member...`);
        try {
            await callApi("/remove-member", { address: member });
            setStatus(`✅ Member removed`);
            await delay(2000);
            await fetchCorpData();
        } catch (err: any) {
            setStatus(`❌ Error: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    }

    async function handleUpdateTribeName() {
        if (!newTribeName.trim()) return;
        setIsProcessing(true);
        setStatus("Updating tribe name...");
        try {
            await callApi("/update-name", { name: newTribeName.trim() });
            setStatus(`✅ Tribe name updated`);
            setNewTribeName("");
            await delay(2000);
            await fetchCorpData();
        } catch (err: any) {
            setStatus(`❌ Error: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    }

    async function handleTransferAdmin() {
        if (!transferAddress.trim()) return;
        if (!window.confirm(`Transfer admin control to ${transferAddress}? You will lose all admin access.`)) return;
        setIsProcessing(true);
        setStatus("Transferring admin...");
        try {
            await callApi("/transfer-admin", { address: transferAddress.trim() });
            setStatus(`✅ AdminCap transferred to ${transferAddress}`);
            setTransferAddress("");
        } catch (err: any) {
            setStatus(`❌ Error: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    }

    if (loading) return (
        <div style={{ padding: "16px", fontFamily: "monospace", color: "#ff6600" }}>
            Loading tribe data...
        </div>
    );
    if (!tribeData) return <div>Failed to load tribe data</div>;

    return (
        <div style={{
            marginTop: "24px",
            padding: "16px",
            border: "1px solid #ff6600",
            fontFamily: "monospace",
        }}>
            <h2 style={{ color: "#ff6600", marginBottom: "16px" }}>
                ⚙ TRIBE HANGAR ADMIN
            </h2>

            <div style={{ marginBottom: "16px" }}>
                <p>Tribe: <strong>{tribeData.name}</strong></p>
                <p>Tribesmen: <strong>{tribeData.members.length}</strong></p>
            </div>

            <div style={{ marginBottom: "16px" }}>
                <h3 style={{ color: "#ff6600" }}>TRIBESMEN</h3>
                {memberInfo.length === 0 ? (
                    <p style={{ color: "#888" }}>No tribesmen yet</p>
                ) : (
                    memberInfo.map((member, i) => (
                        <div key={i} style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 0",
                            borderBottom: "1px solid #333",
                        }}>
                            <div>
                                <div style={{ color: "#ff6600", fontSize: "14px" }}>
                                    {member.name}
                                </div>
                                <div style={{
                                    color: "#666",
                                    fontSize: "11px",
                                    cursor: "help",
                                    title: member.address,
                                }}>
                                    {abbreviateAddress(member.address)}
                                </div>
                            </div>
                            <button
                                onClick={() => handleRemoveMember(member.address)}
                                disabled={isProcessing}
                                style={{
                                    padding: "4px 10px",
                                    backgroundColor: "#440000",
                                    color: "#ff4444",
                                    border: "1px solid #ff4444",
                                    cursor: "pointer",
                                    fontFamily: "monospace",
                                    fontSize: "11px",
                                    marginLeft: "16px",
                                }}
                            >
                                REMOVE
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div style={{ marginBottom: "16px" }}>
                <h3 style={{ color: "#ff6600" }}>ADD TRIBESMAN</h3>
                <div style={{ display: "flex", gap: "8px" }}>
                    <input
                        type="text"
                        value={newMember}
                        onChange={(e) => setNewMember(e.target.value)}
                        placeholder="0x... wallet address"
                        style={{
                            flex: 1,
                            padding: "8px",
                            backgroundColor: "#111",
                            color: "#fff",
                            border: "1px solid #444",
                            fontFamily: "monospace",
                            fontSize: "12px",
                        }}
                    />
                    <button
                        onClick={handleAddMember}
                        disabled={isProcessing || !newMember.trim()}
                        style={{
                            padding: "8px 16px",
                            backgroundColor: isProcessing ? "#444" : "#ff6600",
                            color: "white",
                            border: "none",
                            cursor: isProcessing ? "not-allowed" : "pointer",
                            fontFamily: "monospace",
                        }}
                    >
                        ADD
                    </button>
                </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
                <h3 style={{ color: "#ff6600" }}>TRIBE NAME</h3>
                <div style={{ display: "flex", gap: "8px" }}>
                    <input
                        type="text"
                        value={newTribeName}
                        onChange={(e) => setNewTribeName(e.target.value)}
                        placeholder="Enter tribe name..."
                        style={{
                            flex: 1,
                            padding: "8px",
                            backgroundColor: "#111",
                            color: "#fff",
                            border: "1px solid #444",
                            fontFamily: "monospace",
                            fontSize: "12px",
                        }}
                    />
                    <button
                        onClick={handleUpdateTribeName}
                        disabled={isProcessing || !newTribeName.trim()}
                        style={{
                            padding: "8px 16px",
                            backgroundColor: isProcessing ? "#444" : "#ff6600",
                            color: "white",
                            border: "none",
                            cursor: isProcessing ? "not-allowed" : "pointer",
                            fontFamily: "monospace",
                        }}
                    >
                        SAVE
                    </button>
                </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
                <h3 style={{ color: "#ff6600" }}>TRANSFER ADMIN</h3>
                <p style={{ color: "#888", fontSize: "12px", marginBottom: "8px" }}>
                    Transfers the AdminCap to another wallet. You will lose admin access.
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                    <input
                        type="text"
                        value={transferAddress}
                        onChange={(e) => setTransferAddress(e.target.value)}
                        placeholder="0x... new admin wallet address"
                        style={{
                            flex: 1,
                            padding: "8px",
                            backgroundColor: "#111",
                            color: "#fff",
                            border: "1px solid #444",
                            fontFamily: "monospace",
                            fontSize: "12px",
                        }}
                    />
                    <button
                        onClick={handleTransferAdmin}
                        disabled={isProcessing || !transferAddress.trim()}
                        style={{
                            padding: "8px 16px",
                            backgroundColor: isProcessing ? "#444" : "#880000",
                            color: "white",
                            border: "1px solid #ff4444",
                            cursor: isProcessing ? "not-allowed" : "pointer",
                            fontFamily: "monospace",
                        }}
                    >
                        TRANSFER
                    </button>
                </div>
            </div>

            {status && (
                <div style={{
                    padding: "8px",
                    backgroundColor: "#111",
                    fontSize: "12px",
                    color: status.startsWith("✅") ? "#00ff00" :
                        status.startsWith("❌") ? "#ff4444" : "#ffffff",
                }}>
                    {status}
                </div>
            )}
        </div>
    );
}
