import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const client = new SuiJsonRpcClient({
        url: "https://fullnode.testnet.sui.io:443",
        network: "testnet",
    });

    const address = "0x8a7d989f87efdc757eea482abbd039e3982adf1f5ebff0992c9e6095cee0335a";
    console.log("Looking up objects for:", address);

    const result = await client.getOwnedObjects({
        owner: address,
        options: { showType: true, showContent: true },
        limit: 20,
    });

    result.data.forEach((obj: any) => {
        console.log("\n -", obj.data?.objectId);
        console.log("   Type:", obj.data?.type);
        if (obj.data?.content?.fields) {
            console.log("   Fields:", JSON.stringify(obj.data.content.fields, null, 2));
        }
    });

    console.log(`\nTotal shown: ${result.data.length}`);
    console.log("Has more:", result.hasNextPage);
}

main().catch(console.error);
