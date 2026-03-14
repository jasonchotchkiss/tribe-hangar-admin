import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const client = new SuiJsonRpcClient({
    url: "https://fullnode.testnet.sui.io:443",
    network: "testnet",
});

async function main() {
    // Your in-game wallet address
    const walletAddress = "0x8a7d989f87efdc757eea482abbd039e3982adf1f5ebff0992c9e6095cee0335a";
    
    const result = await client.getOwnedObjects({
        owner: walletAddress,
        options: { showContent: true, showType: true },
    });
    
    for (const obj of result.data) {
        const type = obj.data?.type || "";
        if (type.includes("OwnerCap") || type.includes("owner_cap")) {
            console.log("Found OwnerCap:");
            console.log("  ID:", obj.data?.objectId);
            console.log("  Type:", type);
            console.log("  Fields:", JSON.stringify((obj.data?.content as any)?.fields, null, 2));
            console.log("");
        }
    }
}

main().catch(console.error);
