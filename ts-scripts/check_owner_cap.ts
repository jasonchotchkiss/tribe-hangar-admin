import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const client = new SuiJsonRpcClient({
    url: "https://fullnode.testnet.sui.io:443",
    network: "testnet",
});

async function main() {
    const ownerCapId = "0xda7c6c1bfe7dc5bd9ec58fd403e7a99a2173367bd99188f9d5d1e76003e1655e";
    const result = await client.getObject({
        id: ownerCapId,
        options: { showContent: true, showType: true, showOwner: true },
    });
    console.log("Type:", result.data?.type);
    console.log("Owner:", JSON.stringify(result.data?.owner, null, 2));
    console.log("Fields:", JSON.stringify(result.data?.content, null, 2));
}

main().catch(console.error);
