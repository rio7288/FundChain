# FundChain — Blockchain Crowdfunding MVP

FundChain is an educational crowdfunding dApp built with Solidity, Hardhat, React, Vite, and ethers.js. It is designed for local development and Sepolia testnet demonstrations, not for real funds.

## Features
- Create a campaign with title, story, optional image URL, ETH goal, and deadline
- Donate ETH through MetaMask
- Read campaigns from the deployed contract
- Creator withdrawal after the funding goal is reached
- Donor refund after deadline if the goal was not reached
- Event logs for campaign creation, donations, withdrawals, and refunds
- Dark, responsive React dashboard with demo preview mode

## Requirements
- Node.js 20+ for this starter; current Hardhat 2 releases may have their own engine requirements
- npm
- MetaMask browser extension

## 1. Install contract dependencies
From the project root:

```bash
npm install
npx hardhat compile
npx hardhat test
```

## 2. Run frontend preview
In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. Until a contract is deployed and configured, the UI shows sample campaigns and disables real actions.

## 3. Run the Node.js API
In another terminal from the project root, start the read-only campaign API:

```bash
npm run dev:api
```

The API uses `SEPOLIA_RPC_URL` from `.env` by default. Set `FUNDCHAIN_RPC_URL=http://127.0.0.1:8545` to read from a local Hardhat node instead. Vite proxies `/api` requests to this service during development. The API reads campaigns; MetaMask continues to sign all transactions in the browser.

## 4. Deploy locally
Use Hardhat's local network to test without real funds. For the simplest local workflow, start a local node in one terminal:

```bash
npx hardhat node
```

Then deploy in another terminal:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Add `localhost` to `networks` in `hardhat.config.js` if you want to use this route:

```js
localhost: { url: "http://127.0.0.1:8545" }
```

Connect MetaMask to the local chain (chain ID 31337) and import one of the *local-only* Hardhat test accounts. Never use these development keys on a public network.

## 5. Deploy to Sepolia testnet
1. Create a test-only wallet/account in MetaMask.
2. Obtain Sepolia test ETH from a reputable faucet.
3. Copy `.env.example` to `.env` and add a Sepolia RPC URL plus the private key for a dedicated test-only account.
4. Ensure `.env` is gitignored and never commit it or share it.
5. Run:

```bash
npm run deploy:sepolia
```

6. Copy the deployed address printed in the terminal to `frontend/src/contract.js` as `CONTRACT_ADDRESS`.
7. Restart the frontend and use MetaMask on Sepolia.

## Team work split
- **Member 1 — Smart contract:** contract logic, security checks, tests, deployment.
- **Member 2 — Frontend:** responsive UI, campaign creation form, campaign cards.
- **Member 3 — Web3 integration:** MetaMask, ethers.js transactions, error handling, explorer links.
- **Member 4 — QA/docs:** test cases, README, diagrams, demo script, presentation.

Use branches and pull requests; do not share private keys or commit `.env`.

## Important contract limitations
This is a student MVP and has not been audited. It uses a simple all-or-nothing funding goal. It does not verify campaign identities, prove real-world use of funds, implement milestone releases, or provide production-grade indexing. The campaign's `raisedWei` is a gross donation total and is not reduced when a failed campaign donor claims a refund. Do not deploy this as a real-money fundraising service without an independent security review and jurisdiction-specific legal review.
