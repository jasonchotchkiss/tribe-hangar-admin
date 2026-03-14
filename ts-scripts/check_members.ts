import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const corpConfigId = process.env.EXTENSION_CONFIG_ID as string;

    if (!corpConfigId) throw new Error("EXTENSION_CONFIG_ID not set in .env");

    const client = new SuiJsonRpcClient({
        url: "https://fullnode.testnet.sui.io:443",
        network: "testnet",
    });

    console.log("Fetching corp config:", corpConfigId);

    const object = await client.getObject({
        id: corpConfigId,
        options: { showContent: true },
    });

    if (object.data?.content?.dataType === "moveObject") {
        const fields = object.data.content.fields as any;
        console.log("\n🏢 Corp Name:", fields.name);
        console.log("🚫 Denial Message:", fields.denial_message);
        console.log("\n👥 Members:");
        if (fields.members.length === 0) {
            console.log("  No members yet.");
        } else {
            fields.members.forEach((addr: string, i: number) => {
                console.log(`  ${i + 1}. ${addr}`);
            });
        }
        console.log(`\nTotal members: ${fields.members.length}`);
    }
}

main().catch(console.error);
