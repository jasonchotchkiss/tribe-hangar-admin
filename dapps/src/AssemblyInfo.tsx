// @ts-nocheck
import { useSmartObject } from "@evefrontier/dapp-kit";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";

const WORLD_PACKAGE_ID = import.meta.env.VITE_EVE_WORLD_PACKAGE_ID;
const CORP_HANGAR_PACKAGE_ID = import.meta.env.VITE_CORP_HANGAR_PACKAGE_ID;
// Original ID is used for type identity in Sui - stays constant across upgrades
const CORP_HANGAR_ORIGINAL_ID = import.meta.env.VITE_CORP_HANGAR_ORIGINAL_ID || 
    "61c7b5a5c0e04102384bd3fc66a6adfc5de678e08ff8c8a3db4ced10d97760c8";

export function AssemblyInfo() {
  const { assembly, loading, error, refetch } = useSmartObject();
  const { signAndExecuteTransaction } = useDAppKit();
  const account = useCurrentAccount();
  const [txStatus, setTxStatus] = useState<string>("");
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  if (loading) return <div>Loading assembly...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!assembly) return <div>No assembly found</div>;

  const extension = assembly._raw.contents.json.extension;
  const extensionName = extension && typeof extension === 'object'
    ? (extension as any)?.fields?.name || JSON.stringify(extension)
    : null;

  // Type identity uses original-id, not the upgraded package ID
  const isAuthorized = extensionName?.includes(
    CORP_HANGAR_ORIGINAL_ID.replace("0x", "")
  );

  async function handleAuthorizeHangar() {
    if (!account || !assembly) {
      setTxStatus("Please connect your wallet first.");
      return;
    }

    try {
      setIsAuthorizing(true);
      setTxStatus("Building transaction...");

      const characterId = assembly.character.id;
      const storageUnitId = assembly.id;
      const storageUnitOwnerCapId = assembly._raw.contents.json.owner_cap_id;

      const tx = new Transaction();
      tx.setSender(account.address);

      const [storageUnitOwnerCap, receipt] = tx.moveCall({
        target: `${WORLD_PACKAGE_ID}::character::borrow_owner_cap`,
        typeArguments: [`${WORLD_PACKAGE_ID}::storage_unit::StorageUnit`],
        arguments: [
          tx.object(characterId),
          tx.object(storageUnitOwnerCapId),
        ],
      });

      tx.moveCall({
        target: `${CORP_HANGAR_PACKAGE_ID}::corp_hangar::authorize_hangar`,
        arguments: [
          tx.object(storageUnitId),
          storageUnitOwnerCap,
        ],
      });

      tx.moveCall({
        target: `${WORLD_PACKAGE_ID}::character::return_owner_cap`,
        typeArguments: [`${WORLD_PACKAGE_ID}::storage_unit::StorageUnit`],
        arguments: [
          tx.object(characterId),
          storageUnitOwnerCap,
          receipt,
        ],
      });

      setTxStatus("Waiting for EVE Vault approval...");
      const result = await signAndExecuteTransaction({ transaction: tx });
      console.log("Transaction result:", result);
      setTxStatus(`✅ Corp Hangar authorized!`);

      setTimeout(async () => {
        await refetch();
      }, 5000);

    } catch (err: any) {
      console.error("Authorization error:", err);
      setTxStatus(`❌ Error: ${err.message}`);
    } finally {
      setIsAuthorizing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <p>Name: {assembly.typeDetails?.name}</p>
      <p>Type: {assembly.type}</p>
      <p>State: {assembly.state}</p>
      <p>ID: {assembly.id}</p>
      {assembly.character && <p>Owner: {assembly.character.name}</p>}
      <p>
        Corp Hangar Extension: {isAuthorized ? "✅ Authorized" : extensionName ? "⚠️ Different extension registered" : "❌ Not authorized"}
        {" "}
        <button
          onClick={() => refetch()}
          style={{
            padding: "2px 8px",
            backgroundColor: "#222",
            color: "#888",
            border: "1px solid #444",
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: "10px",
          }}
        >
          ↻
        </button>
      </p>

      {!isAuthorized && (
        <div style={{ marginTop: "16px" }}>
          <button
            onClick={handleAuthorizeHangar}
            disabled={isAuthorizing}
            style={{
              padding: "10px 20px",
              backgroundColor: isAuthorizing ? "#444" : "#ff6600",
              color: "white",
              border: "none",
              cursor: isAuthorizing ? "not-allowed" : "pointer",
              fontFamily: "monospace",
              fontSize: "14px",
            }}
          >
            {isAuthorizing ? "AUTHORIZING..." : "AUTHORIZE CORP HANGAR"}
          </button>
        </div>
      )}

      {txStatus && (
        <div style={{
          marginTop: "8px",
          padding: "8px",
          backgroundColor: "#111",
          fontFamily: "monospace",
          fontSize: "12px",
          wordBreak: "break-all",
          color: txStatus.startsWith("✅") ? "#00ff00" :
                 txStatus.startsWith("❌") ? "#ff4444" : "#ffffff",
        }}>
          {txStatus}
        </div>
      )}
    </div>
  );
}
