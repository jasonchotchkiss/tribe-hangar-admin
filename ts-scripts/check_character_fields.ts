import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const client = new SuiJsonRpcClient({
    url: "https://fullnode.testnet.sui.io:443",
    network: "testnet",
});

async function main() {
    const characterId = "0x73b3039bb4b23313fba9a733d79c62ef88c1e0a9e15ad79f8db5e4b5dc9ffd76";
    
    const result = await client.getDynamicFields({
        parentId: characterId,
    });
    
    console.log("Dynamic fields on character:");
    for (const field of result.data) {
        console.log("  Name:", JSON.stringify(field.name));
        console.log("  Type:", field.objectType);
        console.log("  ID:", field.objectId);
        console.log("");
    }
}

main().catch(console.error);
