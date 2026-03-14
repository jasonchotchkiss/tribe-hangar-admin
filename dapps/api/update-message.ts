import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Transaction } from "@mysten/sui/transactions";

const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    try {
        const { secretKey } = decodeSuiPrivateKey(process.env.ADMIN_PRIVATE_KEY!);
        const keypair = Ed25519Keypair.fromSecretKey(secretKey);

        const tx = new Transaction();
        tx.moveCall({
            target: `${process.env.CORP_HANGAR_PACKAGE}::corp_hangar::update_denial_message`,
            arguments: [
                tx.object(process.env.CORP_CONFIG_ID!),
                tx.object(process.env.ADMIN_CAP_ID!),
                tx.pure.string(message),
            ],
        });

        const result = await client.signAndExecuteTransaction({
            signer: keypair,
            transaction: tx,
            options: { showEffects: true },
        });

        if (result.effects?.status?.status !== "success") {
            throw new Error(result.effects?.status?.error || "Transaction failed");
        }

        res.json({ success: true, digest: result.digest });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}
