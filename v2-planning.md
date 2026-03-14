# Tribe Hangar Admin — v2.0.0 Planning Document
**Multi-Tenant dApp Refactor**
*Author: Jason C. Hotchkiss*
*Date: March 2026*

---

## Overview

Currently, each tribe that wants to use Tribe Hangar Admin must deploy their own Vercel instance with their own environment variables. This creates friction for adoption — every new tribe needs a server, a Vercel account, and technical setup.

The goal of v2.0.0 is to make the dApp **multi-tenant** — a single public deployment that any EVE Frontier tribe can use with their own storage unit and tribe config, without deploying anything themselves.

---

## How It Works Today (v1.x)

The dApp is hardcoded to a specific storage unit and corp config via Vite environment variables:

```
VITE_OBJECT_ID=0x05b9...          # hardcoded storage unit
VITE_CORP_CONFIG_ID=0xf034...     # hardcoded corp config
VITE_ADMIN_CAP_ID=0x8dae...       # hardcoded admin cap
VITE_CORP_HANGAR_PACKAGE_ID=...   # hardcoded contract
```

This means every tribe needs their own Vercel deployment.

---

## How It Should Work (v2.0)

The dApp should have a **landing/setup screen** where the user provides their Storage Unit ID. From there, the dApp:

1. Looks up the storage unit on-chain
2. Verifies the corp hangar extension is authorized
3. Reads the corp config ID from the extension data
4. Loads the vault and admin UI dynamically

One deployed dApp URL serves any tribe. No per-tribe configuration needed.

---

## What Needs to Change

### 1. Remove hardcoded environment variables from the dApp

The following variables need to be removed from `.env` and replaced with dynamic lookups:
- `VITE_OBJECT_ID` — replaced by user input
- `VITE_CORP_CONFIG_ID` — looked up from the storage unit's extension data
- `VITE_ADMIN_CAP_ID` — no longer needed in the frontend at all (only the backend needs it)

The following variables stay:
- `VITE_EVE_WORLD_PACKAGE_ID` — same for all users
- `VITE_CORP_HANGAR_PACKAGE_ID` — same for all users (our deployed contract)
- `VITE_CORP_HANGAR_ORIGINAL_ID` — same for all users

### 2. Add a Storage Unit ID input screen

When the user connects their wallet but hasn't entered a storage unit ID, show a simple input:

```
Enter your Storage Unit ID:
[ 0x05b9...                    ] [ LOAD ]
```

- Validate that the ID is a valid storage unit
- Validate that the corp hangar extension is authorized on it
- If valid, load the vault UI
- Store the ID in browser `localStorage` so the user doesn't have to re-enter it

### 3. Look up Corp Config ID dynamically

The corp config ID is already stored in the storage unit's extension field on-chain. The dApp can read it directly from the `CorpConfig` object linked to the storage unit rather than hardcoding it.

The current `AssemblyInfo.tsx` already reads the extension field — this logic needs to be extended to also find the associated `CorpConfig`.

### 4. Redesign the backend API for multi-tenant use

Currently the backend API hardcodes the `ADMIN_CAP_ID` and `CORP_CONFIG_ID` in its `.env`. For multi-tenant use, these need to be passed in per-request, and the API needs to verify that the caller is actually the admin before executing transactions.

**Option A — Each tribe runs their own API instance (simplest)**
Keep the current architecture. Each tribe still needs their own backend API, but they no longer need their own Vercel dApp. This is a significant improvement — they need a server but not Vercel expertise.

**Option B — Shared backend with per-request admin verification (complex)**
A single backend API that any tribe can call, but requires the caller to prove they hold the AdminCap. This is technically complex and requires careful security design.

**Recommendation: Start with Option A.** It eliminates the Vercel barrier while keeping the backend simple and secure.

### 5. Update Vercel serverless functions

The Vercel serverless functions also hardcode `CORP_CONFIG_ID` and `ADMIN_CAP_ID`. For the shared dApp deployment, these functions need to either:
- Accept the IDs as request parameters (with appropriate validation)
- Or be removed in favor of each tribe running their own backend API (Option A above)

---

## User Flow for v2.0

### First-time setup (tribe admin)

1. Deploy contract (same as today)
2. Run `create_corp.ts` to create their tribe instance (same as today)
3. Set up their own backend API (same as today — this is the one thing that still requires a server)
4. Authorize hangar on their storage unit via the shared dApp
5. Share the dApp URL with their members — no custom deployment needed

### Member experience

1. Go to the shared dApp URL (e.g. `https://ccplz-vault.vercel.app`)
2. Enter their storage unit ID (or the admin shares a direct link with the ID pre-filled)
3. Connect EVE Vault wallet
4. Contribute and withdraw as normal

### Deep linking

To make member onboarding even easier, support a URL parameter for the storage unit ID:

```
https://ccplz-vault.vercel.app?unit=0x05b9...
```

This way the admin can share a single link that takes members directly to the right storage unit without any manual input.

---

## Files That Need to Change

| File | Change needed |
|------|--------------|
| `App.tsx` | Add storage unit ID input screen, handle URL param |
| `WalletStatus.tsx` | Pass storage unit ID down to child components |
| `AssemblyInfo.tsx` | Accept storage unit ID as prop instead of env var |
| `CorpVault.tsx` | Accept corp config ID as prop instead of env var, look up dynamically |
| `CorpAdmin.tsx` | Accept corp config ID and admin cap ID as props, call tribe's own backend API |
| `dapps/.env` | Remove `VITE_OBJECT_ID`, `VITE_CORP_CONFIG_ID`, `VITE_ADMIN_CAP_ID` |
| `dapps/api/*.ts` | Update serverless functions to accept IDs per-request or remove |
| `vercel.json` | No changes needed |

---

## New Files Needed

| File | Purpose |
|------|---------|
| `dapps/src/StorageUnitInput.tsx` | The landing screen with storage unit ID input |
| `dapps/src/hooks/useStorageUnit.ts` | Hook to manage storage unit ID state and localStorage persistence |
| `dapps/src/hooks/useCorpConfig.ts` | Hook to look up corp config ID dynamically from storage unit |

---

## Nice-to-Have Features for v2.0

- **Deep link support** — `?unit=0x...` URL parameter pre-fills the storage unit ID
- **Recent units** — localStorage stores the last few storage unit IDs the user has visited
- **Tribe directory** — an on-chain or off-chain registry of all tribe hangars so users can browse and find one to join
- **QR code** — generate a QR code for the storage unit deep link, printable for in-game use

---

## What Does NOT Change in v2.0

- The Move smart contract — no upgrades needed
- The backend API structure — each tribe still runs their own
- The member contribute/withdraw flow — works exactly the same
- The admin functions — works exactly the same
- Vercel hosting — the shared dApp is still deployed on Vercel

---

## Estimated Complexity

This is a moderate refactor. The core logic already works — it's mainly about making the storage unit ID and corp config ID dynamic rather than hardcoded. Estimated changes touch about 6-8 files with no new blockchain logic required.

The most complex part is the dynamic corp config lookup — verifying that a given storage unit has the corp hangar extension authorized and finding the associated `CorpConfig` object. This requires reading on-chain data that we already know how to read (we do it in `AssemblyInfo.tsx` today).

---

*Tribe Hangar Admin v2.0.0 Planning Document*
*Jason C. Hotchkiss | Conflict Curators [CCPlz]*
*Vibe coded with Claude by Anthropic*
