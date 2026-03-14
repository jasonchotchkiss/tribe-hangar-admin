import { Transaction } from "@mysten/sui/transactions";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const privateKey = process.env.ADMIN_PRIVATE_KEY as string;
    const builderPackageId = process.env.BUILDER_PACKAGE_ID as string;
    const corpConfigId = process.env.EXTENSION_CONFIG_ID as string;
    const adminCapId = process.env.ADMIN_CAP_ID as string;

    if (!privateKey) throw new Error("ADMIN_PRIVATE_KEY not set in .env");
    if (!builderPackageId) throw new Error("BUILDER_PACKAGE_ID not set in .env");
    if (!corpConfigId) throw new Error("EXTENSION_CONFIG_ID not set in .env");
    if (!adminCapId) throw new Error("ADMIN_CAP_ID not set in .env");

    const client = new SuiJsonRpcClient({
        url: "https://fullnode.testnet.sui.io:443",
        network: "testnet",
    });
    const { secretKey } = decodeSuiPrivateKey(privateKey);
    const keypair = Ed25519Keypair.fromSecretKey(secretKey);
    const senderAddress = keypair.getPublicKey().toSuiAddress();

    // ⬇️ Change this to your new denial message
    const newMessage = "Access denied. You are not a member of this corp.";

    console.log("Admin address:", senderAddress);
    console.log("New denial message:", newMessage);

    const tx = new Transaction();
    tx.setSender(senderAddress);

    tx.moveCall({
        target: `${builderPackageId}::corp_hangar::update_denial_message`,
        arguments: [
            tx.object(corpConfigId),
            tx.object(adminCapId),
            tx.pure.string(newMessage),
        ],
    });

    const txBytes = await tx.build({ client });
    const { signature } = await keypair.signTransaction(txBytes);

    const result = await client.executeTransactionBlock({
        transactionBlock: txBytes,
        signature,
        options: { showEffects: true },
    });

    console.log("\n✅ Denial message updated successfully!");
    console.log("Transaction digest:", result.digest);
}

main().catch(console.error);
