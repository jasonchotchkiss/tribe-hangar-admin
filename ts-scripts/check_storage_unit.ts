import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const client = new SuiJsonRpcClient({
    url: "https://fullnode.testnet.sui.io:443",
    network: "testnet",
});

async function main() {
    const storageUnitId = "0x05b99f4b28fc1724bcaafafd0b52a248da171d65cd1769d8a437bb25fb8731b2";
    
    const result = await client.getObject({
        id: storageUnitId,
        options: { showContent: true, showType: true, showOwner: true },
    });
    
    console.log("Type:", result.data?.type);
    console.log("Owner:", JSON.stringify(result.data?.owner, null, 2));
    console.log("Fields:", JSON.stringify((result.data?.content as any)?.fields, null, 2));
}

main().catch(console.error);
