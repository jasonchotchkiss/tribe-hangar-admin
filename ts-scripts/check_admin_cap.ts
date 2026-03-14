import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import * as dotenv from "dotenv";
dotenv.config();

const client = new SuiJsonRpcClient({
    url: "https://fullnode.testnet.sui.io:443",
    network: "testnet",
});

async function main() {
    const adminCapId = "0x8dae91886811ace164ce99cfdbea4d77cdc9265b27d913c1b16f329cc9f28deb";
    const result = await client.getObject({
        id: adminCapId,
        options: { showContent: true, showType: true, showOwner: true },
    });
    console.log("Type:", result.data?.type);
    console.log("Owner:", JSON.stringify(result.data?.owner, null, 2));
    console.log("Fields:", JSON.stringify((result.data?.content as any)?.fields, null, 2));
}

main().catch(console.error);
