# FundChain

A blockchain-powered crowdfunding platform built to make fundraising
more transparent, accountable, and trustworthy.

FundChain allows creators to publish fundraising campaigns and
contributors to support projects. It combines a web application, a
backend API, Supabase services, and Ethereum smart contracts.

## Live Project

-   **Website:** https://fund-chain-w6cs.vercel.app/
-   **GitHub:** https://github.com/rio7288/FundChain

## Features

-   **Campaign management:** Create and manage fundraising campaigns.
-   **Wallet integration:** Connect MetaMask to interact with the
    blockchain.
-   **On-chain contributions:** Record donations through Ethereum smart
    contracts.
-   **Milestone-based withdrawals:** Structure fund withdrawals around
    campaign milestones.
-   **Donor voting:** Support voting on milestone approvals.
-   **Refund mechanisms:** Include refund functionality for applicable
    campaign outcomes.
-   **Transaction transparency:** Track donation transactions on the
    blockchain.
-   **User accounts:** Authentication and campaign-management
    functionality.
-   **Campaign visibility:** Creators can control whether eligible
    campaigns are listed in public discovery.

> FundChain is currently configured for the Ethereum Sepolia test
> network. Use testnet ETH only; do not send real funds.

## Technology Stack

  Area                          Technologies
  ----------------------------- ---------------------------
  Frontend                      React, Vite, Tailwind CSS
  Backend                       Node.js, Express.js
  Database and authentication   Supabase
  Smart contracts               Solidity, Hardhat
  Blockchain interaction        Ethers.js
  Wallet                        MetaMask
  Network                       Ethereum Sepolia

## Project Structure

The repository is organized into frontend, backend, and Supabase
database resources.

``` text
FundChain/
├── frontend/       # React + Vite application
├── backend/        # Node.js + Express API
└── supabase/       # SQL migrations and database changes
```

Smart-contract source and configuration files are maintained in the
repository; their exact locations may vary as the project evolves.

## Getting Started

### Prerequisites

Install the following before running the project:

-   Node.js and npm
-   Git
-   A Supabase project
-   MetaMask browser extension
-   Sepolia testnet ETH for blockchain testing

### 1. Clone the repository

``` bash
git clone https://github.com/rio7288/FundChain.git
cd FundChain
```

### 2. Configure the frontend

``` bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` directory and add the
environment variables required by the frontend.

Example variable names (use the actual values from your own Supabase and
deployment configuration):

``` env
VITE_API_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Start the frontend:

``` bash
npm run dev
```

### 3. Configure the backend

Open a second terminal:

``` bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory and configure the
required server, Supabase, and blockchain environment variables.

Start the backend using the script defined in `backend/package.json`.
For example, if the project defines a `dev` script:

``` bash
npm run dev
```

Do not copy production secrets into source control.

## Supabase Setup

1.  Create a Supabase project.
2.  Configure the frontend and backend environment variables with the
    appropriate project credentials.
3.  Review the SQL migration files in the `supabase/` directory.
4.  Apply the required migrations in the Supabase SQL Editor, in the
    appropriate order, before using features that depend on them.
5.  Confirm that Row Level Security (RLS) policies allow only the
    intended access.

The campaign visibility migration currently included in this repository
is:

``` text
supabase/20261109_campaign_visibility.sql
```

It adds the `is_listed` campaign field and the `set_campaign_visibility`
database function. Committing a migration file to GitHub does not
automatically execute it in Supabase.

## Blockchain Setup

1.  Install and configure MetaMask.
2.  Switch MetaMask to **Ethereum Sepolia**.
3.  Use Sepolia test ETH only.
4.  Configure the contract addresses and RPC settings required by the
    application.
5.  Deploy the smart contracts to Sepolia if they have not already been
    deployed.
6.  Update the frontend and backend environment variables with the
    correct deployed contract addresses and network configuration.

Never commit private keys, seed phrases, RPC credentials, or
service-role keys.

## Deployment

The project has been deployed using:

-   **Frontend:** Vercel
-   **Backend:** Render
-   **Database and authentication:** Supabase
-   **Blockchain:** Ethereum Sepolia

Live frontend: https://fund-chain-w6cs.vercel.app/

Set the required environment variables in the Vercel and Render
dashboards. Redeploy after changing deployment environment variables.

## Security Notes

-   Never commit `.env` files.
-   Never expose a wallet private key or seed phrase.
-   Keep Supabase service-role credentials on the server only.
-   Validate campaign ownership and permissions on the backend and
    database.
-   Treat Sepolia as a test network; this project configuration is not
    an instruction to send real funds.

## Contributing

Contributions, suggestions, and bug reports are welcome.

1.  Fork the repository.
2.  Create a feature branch.
3.  Make and test your changes.
4.  Commit your changes with a clear message.
5.  Open a pull request describing the changes.

## Disclaimer

FundChain is an educational and development project. It is configured
for Ethereum Sepolia testing. Smart-contract behavior, security, and
deployment configuration should be independently reviewed before any
production or real-value use.

------------------------------------------------------------------------

**Be part of what comes next.**
