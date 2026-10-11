
# ⛓️ FundChain — Blockchain Crowdfunding Platform

A decentralized crowdfunding platform designed to make fundraising more transparent and accessible using blockchain technology and smart contracts.

🌐 **Live Demo:** [FundChain](https://fund-chain-ekub.vercel.app/)

📂 **GitHub Repository:** [rio7288/FundChain](https://github.com/rio7288/FundChain)

---

## 📌 About The Project

FundChain is a blockchain-based crowdfunding platform that enables users to create fundraising campaigns, contribute cryptocurrency, and track campaign progress through a web interface.

The project aims to improve transparency and trust in online fundraising by using blockchain technology and Solidity smart contracts to manage campaign rules and fund-related transactions.

It combines a modern Web3 interface with wallet integration and smart-contract functionality to demonstrate how decentralized applications can support crowdfunding.

## ✨ Features

- 🔗 **Wallet Integration** — Connect your cryptocurrency wallet using MetaMask.
- 🚀 **Campaign Creation** — Create fundraising campaigns with relevant details and funding goals.
- 💰 **Crypto Contributions** — Contribute ETH to eligible campaigns on the supported network.
- 📊 **Campaign Tracking** — View fundraising progress and campaign information.
- 🔐 **Smart Contract Logic** — Enforce campaign and fund-management rules through Solidity.
- ↩️ **Withdrawal and Refund Logic** — Support withdrawals and refunds according to the implemented contract conditions.
- 🎨 **Modern UI** — Dark-themed interface with a Web3-inspired design.
- 📱 **Responsive Design** — Designed to support different screen sizes.

> Note: Feature availability depends on the deployed smart contract and frontend integration.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React | Frontend interface |
| Vite | Frontend development and build tooling |
| Tailwind CSS | Styling and responsive layouts |
| Solidity | Smart contract development |
| Hardhat | Contract compilation, testing, and deployment |
| ethers.js | Blockchain interaction |
| MetaMask | Wallet connection and transaction approval |
| Ethereum Sepolia | Blockchain test network |
| JavaScript | Application logic |
| Vercel | Frontend hosting |

## 🏗️ Project Structure

```text
FundChain/
└── fundchain/
    ├── contracts/
    │   └── FundChain.sol
    ├── frontend/
    │   ├── src/
    │   │   ├── contract.js
    │   │   ├── main.jsx
    │   │   └── styles.css
    │   ├── index.html
    │   ├── package.json
    │   └── vite.config.js
    ├── scripts/
    │   └── deploy.js
    ├── test/
    │   └── FundChain.js
    ├── hardhat.config.js
    ├── package.json
    ├── server.js
    └── README.md
```

## ⚙️ Getting Started

### Prerequisites

Before running the project locally, make sure you have:

- [Node.js](https://nodejs.org/)
- npm
- [MetaMask](https://metamask.io/)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/rio7288/FundChain.git
```

### 2. Navigate to the Project Directory

```bash
cd FundChain/fundchain
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the project directory using the configuration expected by `hardhat.config.js`.

For example, deployment configuration may require a Sepolia RPC URL and a deployment wallet's private key. Use the exact variable names expected by the project configuration.

**Never commit your `.env` file, private key, or wallet recovery phrase to GitHub.**

### 5. Compile the Smart Contract

```bash
npx hardhat compile
```

### 6. Run Smart Contract Tests

```bash
npx hardhat test
```

### 7. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite in your browser.

> Follow the repository's actual configuration and scripts if they differ from these general steps.

## 🔄 How It Works

1. **Connect Wallet:** Connect MetaMask to the application.
2. **Select or Create a Campaign:** Browse existing campaigns or create a new fundraising campaign.
3. **Contribute:** Enter a contribution amount and approve the transaction through MetaMask.
4. **Track Progress:** View campaign details and fundraising progress.
5. **Manage Funds:** Withdraw funds or request refunds when the smart contract's conditions allow it.

Blockchain transactions may require gas fees on the selected network.

## 🌐 Network Information

FundChain is intended for development and testing on the **Ethereum Sepolia testnet**.

- **Network:** Ethereum Sepolia
- **Wallet:** MetaMask
- **Currency:** Sepolia test ETH

Sepolia test ETH is intended for testing and should not be treated as real-money funds.

## 🧪 Testing

The repository includes a Hardhat test file for the FundChain smart contract.

Recommended testing areas include:

- Campaign creation and validation
- Successful and unsuccessful contributions
- Campaign funding-goal conditions
- Authorized and unauthorized withdrawals
- Refund eligibility
- Invalid transaction handling
- Wallet and network compatibility

The presence of tests does not necessarily mean all scenarios have been tested or passed.

## 🔮 Future Improvements

- Persistent campaign and transaction history
- Decentralized storage using IPFS for campaign images and metadata
- Improved campaign discovery and filtering
- Enhanced transaction status and error handling
- Additional automated integration tests
- Stronger security testing and independent smart-contract review
- Improved accessibility and mobile experience

## 🔒 Security Disclaimer

FundChain is an educational project and should be treated as a testnet application unless its deployment and security have been independently verified.

- Do not use real funds for testing.
- Never share private keys or recovery phrases.
- Verify contract addresses and the active network before approving transactions.
- Smart contracts should undergo thorough security testing before production use.

## 👨‍💻 Contributors

Developed as a team-based Web3 crowdfunding project.

Contributions, suggestions, and feedback are welcome.

## 📄 License

No license has currently been specified for this repository. Add an appropriate open-source license if you intend to permit reuse or redistribution.

---

<p align="center">
  Built with ❤️ using Blockchain Technology
</p>
