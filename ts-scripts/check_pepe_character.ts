import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import * as dotenv from "dotenv";
dotenv.config();

const client = new SuiJsonRpcClient({
    url: "https://fullnode.testnet.sui.io:443",
    network: "testnet",
});

async function main() {
    const characterId = "0x149570fc9d4df5591e1dafdc265aab849b9eba7ec63594c7ae71d5834f13c925";
    
    const result = await client.getObject({
        id: characterId,
        options: { showContent: true, showType: true, showOwner: true },
    });
    
    console.log("Type:", result.data?.type);
    console.log("Fields:", JSON.stringify((result.data?.content as any)?.fields, null, 2));
}

main().catch(console.error);
