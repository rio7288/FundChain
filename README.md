# FundChain campaign publishing integration

This batch adds the first verified on-chain publishing flow. It does not yet implement donations, milestone voting, releases or refunds.

## 1. Copy files

Copy the `frontend/src/services/blockchain.js` file into the same path in your frontend.

Copy these backend files into the corresponding paths:
- `backend/src/services/chain-verification.service.js`
- `backend/src/controllers/campaign-publish.controller.js`
- `backend/src/routes/campaign-publish.routes.js`

## 2. Backend environment

Add these to `backend/.env` (never frontend `.env`):
```
SEPOLIA_RPC_URL=YOUR_SEPOLIA_RPC_URL
FUNDCHAIN_CONTRACT_ADDRESS=0xD827085FaC2b04088f6f4F9Aa330D21d64fDd809
```
Do not add a private key to the backend. The user signs transactions in MetaMask.

## 3. Register the route

In `backend/src/server.js`, add:
```
import campaignPublishRoutes from "./routes/campaign-publish.routes.js";
```
Then, after the existing campaign routes:
```
app.use("/api/v1/campaigns", campaignPublishRoutes);
```

## 4. Required database fields

This integration expects the existing campaigns table to have:
- `contract_campaign_id`
- `contract_address`
- `transaction_hash`
- `status`

The uploaded campaign service/schema already use `target_amount_wei`, `deadline`, and milestone rows with `amount_wei`.

## 5. Update CreateCampaign.jsx

Import:
```
import { publishCampaignOnChain } from "../services/blockchain";
```

The `handlePublish` function must:
1. Save the draft with the existing `POST /campaigns` call.
2. Call `publishCampaignOnChain({ campaign: { ...result.campaign, targetEth: form.targetEth }, milestones, expectedWallet: wallet })`.
3. POST the returned `transactionHash`, `contractCampaignId`, and `creatorWallet` to `${API_URL}/campaigns/${result.campaign.id}/publish`, with the same Bearer session token.
4. Only navigate as published after the backend returns success.

If the MetaMask transaction is cancelled or fails, keep the saved draft. Do not delete its uploaded image or campaign row; show the draft ID and let the user retry publishing. Do not create a second draft on retry.

## 6. Important notes

- The backend verifies the receipt, contract address, creator, goal, deadline, milestone count and emitted campaign ID before setting status to `active`.
- The app URI `fundchain://supabase-campaign/<uuid>` is an internal reference, not IPFS storage.
- Run backend and frontend builds/tests after integration.
- This is not a full contract audit. Test on Sepolia only.
