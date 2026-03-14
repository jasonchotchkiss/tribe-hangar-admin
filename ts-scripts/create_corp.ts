import { Transaction } from "@mysten/sui/transactions";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const privateKey = process.env.ADMIN_PRIVATE_KEY as string;
    const builderPackageId = process.env.BUILDER_PACKAGE_ID as string;

    if (!privateKey) throw new Error("ADMIN_PRIVATE_KEY not set in .env");
    if (!builderPackageId) throw new Error("BUILDER_PACKAGE_ID not set in .env");

    const client = new SuiJsonRpcClient({
        url: "https://fullnode.testnet.sui.io:443",
        network: "testnet",
    });
    const { secretKey } = decodeSuiPrivateKey(privateKey);
    const keypair = Ed25519Keypair.fromSecretKey(secretKey);
    const senderAddress = keypair.getPublicKey().toSuiAddress();

    console.log("Signer address:", senderAddress);
    console.log("Package ID:", builderPackageId);

    const corpName = "Sebastian Lance Corp";
    const denialMessage = "Access denied. You are not a member of this corp.";

    console.log(`\nCreating corp: "${corpName}"`);
    console.log(`Denial message: "${denialMessage}"`);

    const tx = new Transaction();
    tx.setSender(senderAddress);
    tx.moveCall({
        target: `${builderPackageId}::corp_hangar::create_corp`,
        arguments: [
            tx.pure.string(corpName),
            tx.pure.string(denialMessage),
        ],
    });

    const txBytes = await tx.build({ client });
    const { signature } = await keypair.signTransaction(txBytes);

    const result = await client.executeTransactionBlock({
        transactionBlock: txBytes,
        signature,
        options: {
            showObjectChanges: true,
            showEffects: true,
        },
    });

    console.log("\n✅ Corp created successfully!");
    console.log("Transaction digest:", result.digest);
    console.log("\nCreated objects:");
    result.objectChanges?.forEach((change) => {
        if (change.type === "created") {
            console.log(`  - Type: ${change.objectType}`);
            console.log(`    ID:   ${change.objectId}`);
        }
    });
}

main().catch(console.error);
