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

    const storageUnitId = "0x05b99f4b28fc1724bcaafafd0b52a248da171d65cd1769d8a437bb25fb8731b2";
    const ownerCapId = "0x678f34409f1a31eef723398f903e03b031d4d86d296f02b4d3accb4fd1f3f3e2";

    console.log("Signer address:", senderAddress);
    console.log("Storage Unit ID:", storageUnitId);
    console.log("Owner Cap ID:", ownerCapId);
    console.log("\nAuthorizing corp_hangar extension on storage unit...");

    const tx = new Transaction();
    tx.setSender(senderAddress);

    tx.moveCall({
        target: `${builderPackageId}::corp_hangar::authorize_hangar`,
        arguments: [
            tx.object(storageUnitId),
            tx.object(ownerCapId),
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

    console.log("\n✅ Corp hangar authorized successfully!");
    console.log("Transaction digest:", result.digest);
    console.log("\nYour storage unit now enforces corp member access!");
}

main().catch(console.error);
