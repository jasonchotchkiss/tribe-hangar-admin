import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const client = new SuiJsonRpcClient({
    url: "https://fullnode.testnet.sui.io:443",
    network: "testnet",
});

async function main() {
    const inventoryKeys = [
        "0x678f34409f1a31eef723398f903e03b031d4d86d296f02b4d3accb4fd1f3f3e2",
        "0xe88c508cc31f2a10f5d1d88093b03418df09b062a105be7d426c7336e6457603",
        "0x1891c1a2e31c8eec14eaedf8f93f13d80be0d31f92322b33715dfb23c9a5866a",
        "0x582197b875befa5c443811b0da49d4bc657f5bbe50fc1d6c5fe38455691a84e3",
    ];

    for (const id of inventoryKeys) {
        const result = await client.getObject({
            id,
            options: { showContent: true, showType: true, showOwner: true },
        });
        console.log("ID:", id);
        console.log("Type:", result.data?.type);
        console.log("Owner:", JSON.stringify(result.data?.owner, null, 2));
        console.log("Fields:", JSON.stringify((result.data?.content as any)?.fields, null, 2));
        console.log("");
    }
}

main().catch(console.error);
