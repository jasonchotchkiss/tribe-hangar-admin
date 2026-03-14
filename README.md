# Tribe Hangar Admin

A blockchain-enforced shared inventory system for EVE Frontier. Create a shared tribe vault inside any storage unit — accessible only through this dApp, not through the game client directly. Tribe members can contribute items to the vault and withdraw them using a searchable item picker.

**Live example:** [https://ccplz-vault.vercel.app](https://ccplz-vault.vercel.app)

---

## What Does It Do?

In EVE Frontier, storage units have a hidden inventory space called the **open inventory** that cannot be accessed through the game client at all. This project uses a smart contract to unlock that space as a shared tribe vault.

- Tribe members deposit items into the storage unit via the game client as normal
- They then use the dApp to **contribute** those items into the shared vault
- Any tribe member can **withdraw** items from the vault back to their personal slot
- Non-members are rejected
- The tribe admin can add/remove members, update the tribe name, and transfer admin control — all from the dApp

---

## What You Need Before Starting

- **EVE Frontier account** with a character in the game
- **EVE Vault browser extension** installed — this is your in-game wallet for signing transactions. Get it from the EVE Frontier website.
- **A storage unit** deployed somewhere in the game world
- **An Ubuntu Linux server** (or any Linux machine) with internet access — this runs the admin backend. A cheap VPS works fine.
- **A Windows or Mac computer** for running the game and browser
- **A Vercel account** (free) for hosting the dApp publicly — [https://vercel.com](https://vercel.com)
- **Node.js v20** and **pnpm** installed on your Linux server
- **Sui CLI** installed on your Linux server

> **Note:** You do not need to write any code or understand blockchain to follow this guide. Every step uses commands you can copy and paste. If something goes wrong, an AI assistant can help you debug it — just share the error message.

---

## Overview of the Pieces

There are four parts to this system:

| Part               | What it is                                           | Where it runs                      |
| ------------------ | ---------------------------------------------------- | ---------------------------------- |
| Smart contract     | The on-chain logic that controls vault access        | Sui blockchain (Stillness testnet) |
| TypeScript scripts | Command-line tools for initial setup                 | Your Linux server                  |
| Backend API        | Holds your admin key securely, handles admin actions | Your Linux server (always running) |
| dApp               | The web interface tribe members use                  | Vercel (public URL)                |

---

## Step 1 — Set Up Your Linux Server

SSH into your Linux server and run these commands one at a time.

**Install Node.js v20:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Install pnpm:**
```bash
npm install -g pnpm
```

**Install Sui CLI:**
```bash
curl -fsSL https://raw.githubusercontent.com/MystenLabs/sui/main/scripts/install_sui.sh | bash
```
Then restart your terminal session, or run `source ~/.bashrc`.

**Verify everything installed:**
```bash
node --version    # should show v20.x.x
pnpm --version    # should show a version number
sui --version     # should show sui x.x.x
```

---

## Step 2 — Get the Code

```bash
cd ~
git clone https://github.com/evefrontier/builder-scaffold.git
cd builder-scaffold
pnpm install
```

---

## Step 3 — Create a Sui Wallet for Admin

This wallet lives on your server and holds admin control over the tribe vault. It is separate from your in-game EVE Vault wallet.

```bash
sui client new-address ed25519
```

This prints out a wallet address that looks like `0x39f1...`. Save it somewhere — this is your **admin wallet address**.

**Fund it with testnet SUI** (needed to pay for blockchain transactions):
```bash
sui client faucet
```

**Check your balance:**
```bash
sui client balance
```

You should see some SUI tokens. If not, wait a minute and try again.

---

## Step 4 — Configure the Stillness Environment

EVE Frontier runs on a specific testnet environment called "Stillness." You need to point the Sui CLI at it.

```bash
sui client new-env --alias testnet_stillness --rpc https://fullnode.testnet.sui.io:443
sui client switch --env testnet_stillness
```

---

## Step 5 — Deploy the Smart Contract

```bash
cd ~/builder-scaffold/move-contracts/corp_hangar
sui move build -e testnet_stillness
sui move publish -e testnet_stillness --gas-budget 100000000
```

The output will include a long list of object IDs. Look for these and save them:

- **Package ID** — listed under `Published Objects`, looks like `0xe4bd...`
- This is your `CORP_HANGAR_PACKAGE`

> **Important:** Also note the `original-id` from `Published.toml` in the same folder after publishing. This is different from the Package ID and is needed later.

---

## Step 6 — Create Your Tribe Instance

```bash
cd ~/builder-scaffold/ts-scripts
```

Open the file `.env` in this folder (create it if it doesn't exist) and add:
```
ADMIN_PRIVATE_KEY=your_sui_private_key_here
CORP_HANGAR_PACKAGE=0xe4bd...   # from Step 5
```

To get your private key:
```bash
sui keytool export --key-identity your_address_here
```

Now create your tribe:
```bash
npx ts-node create_corp.ts "Your Tribe Name" "You are not a member of this tribe."
```

The output gives you two more important IDs to save:
- **Corp Config ID** — the shared on-chain object for your tribe
- **Admin Cap ID** — your admin capability object (whoever holds this controls the tribe)

---

## Step 7 — Set Up the dApp

```bash
cd ~/builder-scaffold/dapps
cp .env.example .env
```

Open `.env` and fill in all the values:
```
VITE_EVE_WORLD_PACKAGE_ID=0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c
VITE_CORP_HANGAR_PACKAGE=0xe4bd...        # your Package ID from Step 5
VITE_CORP_CONFIG_ID=0xf034...             # from Step 6
VITE_STORAGE_UNIT_ID=0x05b9...           # your storage unit's object ID (find in game)
VITE_CHARACTER_ID=0x73b3...              # your character's object ID (find in game)
VITE_API_URL=                            # leave blank — Vercel serverless functions handle this
```

> **Finding your Storage Unit ID and Character ID:** In EVE Frontier, interact with your storage unit and press F. The URL or object inspector will show the object ID. You can also find it via the Sui explorer by searching your wallet address.

---

## Step 8 — Set Up the Backend API

The backend API holds your admin private key securely on your server. It never touches the frontend.

```bash
mkdir ~/corp-storage-api
cd ~/corp-storage-api
npm init -y
npm install express @mysten/sui dotenv
npm install -D typescript @types/express ts-node
```

Create a file called `index.ts` in this folder. Copy the backend API code from the project repository into it.

Create a `.env` file in the same folder:
```
ADMIN_PRIVATE_KEY=your_sui_private_key_here
CORP_CONFIG_ID=0xf034...
ADMIN_CAP_ID=0x8dae...
CORP_HANGAR_PACKAGE=0xe4bd...
```

**Install pm2** to keep the API running permanently:
```bash
npm install -g pm2
pm2 start ts-node --name corp-storage-api -- index.ts
pm2 save
pm2 startup
```

Run the command that `pm2 startup` prints out (it will look like a long `sudo env ...` command). This makes the API auto-start if your server reboots.

**Check it's running:**
```bash
pm2 status
```

You should see `corp-storage-api` with status `online`.

---

## Step 9 — Deploy the dApp to Vercel

**Install the Vercel CLI:**
```bash
npm install -g vercel
```

**Deploy:**
```bash
cd ~/builder-scaffold/dapps
vercel --prod
```

Follow the prompts. When asked for a project name, choose something memorable like `my-tribe-vault`.

After deploying, go to your Vercel project dashboard at [https://vercel.com](https://vercel.com) and add these **environment variables** (under Settings → Environment Variables):

| Name                  | Value                |
| --------------------- | -------------------- |
| `ADMIN_PRIVATE_KEY`   | your Sui private key |
| `CORP_CONFIG_ID`      | your Corp Config ID  |
| `ADMIN_CAP_ID`        | your Admin Cap ID    |
| `CORP_HANGAR_PACKAGE` | your package ID      |

After adding them, redeploy:
```bash
vercel --prod
```

Your dApp is now live at a public URL like `https://my-tribe-vault.vercel.app`.

---

## Step 10 — Authorize the Vault on Your Storage Unit

Open your dApp in the browser. Connect your EVE Vault wallet. You should see your storage unit info.

Click **AUTHORIZE HANGAR**. This registers the smart contract as the controller of your storage unit's vault. You only need to do this once.

---

## Step 11 — Link the dApp In-Game

1. Go to your storage unit in the game
2. Press **F** to interact → choose **Edit Assembly**
3. Paste your public dApp URL into the **DAPP LINK** field
4. Save

Now anyone who interacts with your storage unit can launch the dApp directly from the game.

---

## Step 12 — Add Tribe Members

Open your dApp and scroll down to **TRIBE HANGAR ADMIN**. Under **ADD TRIBESMAN**, paste a member's wallet address and click **ADD**.

Their wallet address is their EVE Vault wallet — they can find it by opening EVE Vault and copying the address shown.

---

## How Members Use the Vault

> **Important:** Every wallet that interacts with the blockchain needs a small amount of testnet SUI to pay for transaction fees (called "gas"). This includes tribe members. Before using the dApp for the first time, every member must fund their wallet from the testnet faucet — it's free and takes less than a minute.
>
> **Get testnet SUI here:** https://faucet.sui.io — paste your EVE Vault wallet address and click request.

Once funded, a member can:clear

1. **Deposit items** into the storage unit via the game client (drag items from ship → storage unit as normal)
2. Open the dApp and connect their EVE Vault wallet
3. Use **CONTRIBUTE** to move items from their personal slot into the shared tribe vault
4. Use **WITHDRAW** to take items out of the tribe vault back to their personal slot

> Items in the tribe vault are **invisible from the game client**. This is intentional — the dApp is the only way to see and interact with the vault contents.

---

## Admin Functions

All admin functions are in the **TRIBE HANGAR ADMIN** section at the bottom of the dApp. Only the wallet holding the Admin Cap can use these.

| Function       | What it does                                                         |
| -------------- | -------------------------------------------------------------------- |
| TRIBESMEN      | Lists all current members with remove buttons                        |
| ADD TRIBESMAN  | Add a wallet address to the member list                              |
| TRIBE NAME     | Update the tribe's display name                                      |
| TRANSFER ADMIN | Send the AdminCap to another wallet — **you will lose admin access** |

---

## Important Notes

**The tribe name is just a label.** It has no connection to any official in-game tribe registry. When you found your official tribe in-game, just update the name in the dApp to match.

**Two wallets, two roles.** Your server admin wallet (created in Step 3) holds the AdminCap and pays gas for admin transactions. Your in-game EVE Vault wallet is your character identity used for contributing and withdrawing items. Both are necessary.

**Items must be in the storage unit first.** Players must deposit items into the storage unit via the game client before they can contribute them to the vault. The dApp cannot pull items directly from a ship or personal inventory.

**The open inventory is truly isolated.** Items in the tribe vault cannot be accessed through the game client under any circumstances. Only the dApp can see and move them.

**This runs on Stillness testnet.** EVE Frontier is currently in early access and runs on a test blockchain environment. Nothing here uses real money.

---

## Troubleshooting

**"API request failed" when adding a member**
- Check that your backend API is running: `pm2 status`
- If it shows `errored`, restart it: `pm2 restart corp-storage-api`
- Check the logs: `pm2 logs corp-storage-api`

**Items not showing in the vault after contributing**
- Wait about 5–10 seconds and refresh the dApp. Blockchain state takes a moment to propagate.

**EVE Vault won't connect**
- Make sure you have the EVE Vault browser extension installed and are logged in
- Try refreshing the page or clearing site data

**"Wrong environment" errors when deploying the contract**
- Always include `-e testnet_stillness` in your `sui move build` and `sui move publish` commands

**Vercel deployment fails**
- Check the build log in your Vercel dashboard for the specific error
- The most common fix is making sure all environment variables are set correctly in Vercel settings

---

## Getting Help

The EVE Frontier builder community is active in the official EVE Frontier Discord server in the builder channels. Most questions can also be answered by reading the source code in the `evefrontier/world-contracts` repository — the Move source files are the authoritative reference for what's possible.

---

## Related

- [tribe-hangar-api](https://github.com/jasonchotchkiss/tribe-hangar-api) — The backend API that securely holds the admin key and handles all admin transactions

---

*Built by Jason C. Hotchkiss (aka Sebastian Lance | Conflict Curators [CCPlz])*
*Vibe coded with Claude by Anthropic*
