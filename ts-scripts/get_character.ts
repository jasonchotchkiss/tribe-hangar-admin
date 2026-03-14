import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const client = new SuiJsonRpcClient({
        url: "https://fullnode.testnet.sui.io:443",
        network: "testnet",
    });

    const characterId = "0x73b3039bb4b23313fba9a733d79c62ef88c1e0a9e15ad79f8db5e4b5dc9ffd76";
    console.log("Looking up character:", characterId);

    const result = await client.getObject({
        id: characterId,
        options: { showContent: true, showType: true, showOwner: true },
    });

    console.log("\nCharacter object:");
    console.log("Type:", result.data?.type);
    console.log("Owner:", JSON.stringify(result.data?.owner, null, 2));
    console.log("Fields:", JSON.stringify(result.data?.content, null, 2));
}

main().catch(console.error);
