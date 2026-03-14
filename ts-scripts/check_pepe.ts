import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import * as dotenv from "dotenv";
dotenv.config();

const client = new SuiJsonRpcClient({
    url: "https://fullnode.testnet.sui.io:443",
    network: "testnet",
});

const WORLD_PACKAGE_ID = "0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c";

async function main() {
    const pepeAddress = "0x92f7e30e2fd433641186d84c67cc2894bfed7832219131b1fd1b6b20b9ad53ad";

    // Find PEPE's PlayerProfile
    const ownedObjects = await client.getOwnedObjects({
        owner: pepeAddress,
        options: { showContent: true, showType: true },
    });

    console.log("All objects owned by PEPE:");
    for (const obj of ownedObjects.data) {
        console.log("  ID:", obj.data?.objectId);
        console.log("  Type:", obj.data?.type);
        const fields = (obj.data?.content as any)?.fields;
        if (fields) console.log("  Fields:", JSON.stringify(fields, null, 2));
        console.log("");
    }
}

main().catch(console.error);
